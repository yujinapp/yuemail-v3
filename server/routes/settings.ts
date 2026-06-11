/**
 * /api/email/autoconfig + /api/email/verify routes (F10).
 *
 *  GET  /api/email/autoconfig?email=a@b.c
 *       -> { ok, source, provider?, username, imap, smtp, note? }
 *       -> 422 { ok: false, error } on invalid address / unsupported provider
 *
 *  POST /api/email/verify
 *       body (all optional): { imap: {host,port,user,pass,secure},
 *                              smtp: {host,port,user,pass,secure} }
 *       Missing fields fall back to the vault, so the UI can test the
 *       form as typed (before saving) or the stored credentials (empty
 *       form). Plaintext credentials flow loopback-only and are never
 *       persisted nor echoed back.
 *       -> { ok, imap: {ok, error?}, smtp: {ok, error?} }
 *
 * ASCII-only.
 */
import type { Express, Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { autoconfigure } from '../autoconfig.js';
import { getKey } from '../vault.js';

interface ServerOverride {
  host?:   unknown;
  port?:   unknown;
  user?:   unknown;
  pass?:   unknown;
  secure?: unknown;
}

interface EffectiveConfig {
  host:   string;
  port:   number;
  user:   string;
  pass:   string;
  secure: boolean;
}

interface VerifyOutcome {
  ok:     boolean;
  error?: string;
}

const VERIFY_TIMEOUT_MS = 10000;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/** Merge form overrides with vault values, field by field. */
async function effectiveConfig(cat: 'imap' | 'smtp', over?: ServerOverride): Promise<EffectiveConfig | undefined> {
  const host = str(over?.host) ?? await getKey(cat + '.host');
  const portRaw = str(String(over?.port ?? '')) ?? await getKey(cat + '.port');
  const user = str(over?.user) ?? await getKey(cat + '.user');
  const pass = str(over?.pass) ?? await getKey(cat + '.pass');
  if (!host || !portRaw || !user || !pass) return undefined;
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) return undefined;

  let secure: boolean;
  if (typeof over?.secure === 'boolean') {
    secure = over.secure;
  } else {
    const secStr = await getKey(cat + '.secure');
    /* Same defaults the send/inbox routes apply. */
    secure = cat === 'imap'
      ? (secStr ?? 'true').toLowerCase() !== 'false'
      : (secStr ?? '').toLowerCase() === 'true' || port === 465;
  }
  return { host, port, user, pass, secure };
}

function shortError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.split('\n')[0]?.slice(0, 200) ?? 'error desconocido';
}

async function verifySmtp(cfg: EffectiveConfig): Promise<VerifyOutcome> {
  const transporter = nodemailer.createTransport({
    host:   cfg.host,
    port:   cfg.port,
    secure: cfg.secure,
    auth:   { user: cfg.user, pass: cfg.pass },
    connectionTimeout: VERIFY_TIMEOUT_MS,
    greetingTimeout:   VERIFY_TIMEOUT_MS,
    socketTimeout:     VERIFY_TIMEOUT_MS,
  });
  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: shortError(err) };
  } finally {
    transporter.close();
  }
}

async function verifyImap(cfg: EffectiveConfig): Promise<VerifyOutcome> {
  const client = new ImapFlow({
    host:   cfg.host,
    port:   cfg.port,
    secure: cfg.secure,
    auth:   { user: cfg.user, pass: cfg.pass },
    logger: false,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout de conexion (' + VERIFY_TIMEOUT_MS / 1000 + 's)')), VERIFY_TIMEOUT_MS);
  });
  try {
    await Promise.race([client.connect(), timeout]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: shortError(err) };
  } finally {
    if (timer) clearTimeout(timer);
    /* logout() can hang on a half-open connection (e.g. after the race
     * timed out while connect() was still pending), so bound it and then
     * destroy the socket unconditionally -- same hard cap SMTP gets via
     * its socketTimeout. */
    try {
      await Promise.race([
        client.logout(),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    } catch { /* ignore */ }
    try { client.close(); } catch { /* ignore */ }
  }
}

export function registerSettingsRoutes(app: Express): void {
  app.get('/api/email/autoconfig', async (req: Request, res: Response) => {
    const email = typeof req.query['email'] === 'string' ? req.query['email'] : '';
    const result = await autoconfigure(email);
    if (!result.ok) {
      res.status(422).json(result);
      return;
    }
    res.json(result);
  });

  app.post('/api/email/verify', async (req: Request, res: Response) => {
    const body = req.body as { imap?: ServerOverride; smtp?: ServerOverride } | undefined;
    const [imapCfg, smtpCfg] = await Promise.all([
      effectiveConfig('imap', body?.imap),
      effectiveConfig('smtp', body?.smtp),
    ]);
    const [imap, smtp] = await Promise.all([
      imapCfg ? verifyImap(imapCfg) : Promise.resolve<VerifyOutcome>({ ok: false, error: 'IMAP sin configurar' }),
      smtpCfg ? verifySmtp(smtpCfg) : Promise.resolve<VerifyOutcome>({ ok: false, error: 'SMTP sin configurar' }),
    ]);
    res.json({ ok: imap.ok && smtp.ok, imap, smtp });
  });
}
