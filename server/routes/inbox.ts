/**
 * /api/inbox/* routes (F7 + PND-024).
 *
 * GET /api/inbox/list?limit=N -> last N envelopes (default 20, max 100).
 *   Uses imapflow to read envelopes only; no body fetch.
 * GET /api/inbox/fetch/:uid -> full email (headers, body, CC, BCC) for forward.
 *   Returns { ok: true, from, cc, bcc, subject, body_text, date }
 *
 * Returns { ok: false, error: 'IMAP not configured' } when vault is missing
 * IMAP credentials.
 *
 * ASCII-only.
 */
import type { Express, Request, Response } from 'express';
import { ImapFlow } from 'imapflow';
import { getCategoryStatus, getKey } from '../vault.js';
import { upsertSender, upsertCC } from '../contacts.js';

export function registerInboxRoutes(app: Express): void {
  app.get('/api/inbox/list', async (req: Request, res: Response) => {
    const status = await getCategoryStatus();
    if (!status.imap.configured) {
      res.status(400).json({
        ok: false,
        error: 'IMAP not configured. Run `yuemail vault setup` to configure your IMAP server.',
        missing: status.imap.missing,
      });
      return;
    }

    const host    = await getKey('imap.host');
    const portStr = await getKey('imap.port');
    const user    = await getKey('imap.user');
    const pass    = await getKey('imap.pass');
    const secStr  = await getKey('imap.secure');
    if (!host || !portStr || !user || !pass) {
      res.status(400).json({ ok: false, error: 'IMAP not configured (missing decrypted credential)' });
      return;
    }
    const port = Number(portStr);
    if (!Number.isFinite(port) || port <= 0) {
      res.status(400).json({ ok: false, error: 'imap.port is not a positive integer' });
      return;
    }
    const secure = (secStr ?? 'true').toLowerCase() !== 'false';

    const limitRaw = Number(req.query['limit'] ?? 20);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 100) : 20;

    const client = new ImapFlow({
      host,
      port,
      secure,
      auth: { user, pass },
      logger: false,
    });

    const envelopes: Array<{ uid: number; from: string; subject: string; date: string }> = [];

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const mbox = client.mailbox as { exists?: number } | undefined;
        const total = (mbox && typeof mbox.exists === 'number') ? mbox.exists : 0;
        if (total === 0) {
          res.json({ ok: true, envelopes: [] });
          return;
        }
        const start = Math.max(1, total - limit + 1);
        const range = start + ':' + total;
        /* Auto-register senders, CC recipients, and BCC in the address book
         * so the person can later reply / write by NAME instead of spelling
         * the address out (PND-022, PND-024). Best-effort: contact writes
         * must never break the inbox read, so failures are swallowed. */
        const seenSenders = new Map<string, string>();
        const seenCC = new Map<string, string>();
        for await (const msg of client.fetch(range, { uid: true, envelope: true })) {
          const env = msg.envelope;
          const fromList = (env?.from ?? []) as Array<{ name?: string; address?: string }>;
          const first = fromList[0] ?? {};
          const fromStr = (first.name ?? '') + (first.address ? ' <' + first.address + '>' : '');
          if (first.address) seenSenders.set(first.address, first.name ?? '');
          /* Extract CC recipients (PND-024). */
          const ccList = (env?.cc ?? []) as Array<{ name?: string; address?: string }>;
          for (const cc of ccList) {
            if (cc.address) seenCC.set(cc.address, cc.name ?? '');
          }
          envelopes.push({
            uid:     Number(msg.uid ?? 0),
            from:    fromStr.trim(),
            subject: env?.subject ?? '(sin asunto)',
            date:    env?.date ? new Date(env.date).toISOString() : '',
          });
        }
        envelopes.sort((a, b) => b.uid - a.uid);
        for (const [address, name] of seenSenders) {
          try { await upsertSender({ name, email: address }); } catch { /* never break the inbox read */ }
        }
        for (const [address, name] of seenCC) {
          try { await upsertCC({ name, email: address }); } catch { /* never break the inbox read */ }
        }
        res.json({ ok: true, envelopes });
      } finally {
        lock.release();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: 'IMAP fetch failed: ' + message });
    } finally {
      try { await client.logout(); } catch { /* ignore */ }
    }
  });

  app.get('/api/inbox/fetch/:uid', async (req: Request, res: Response) => {
    const status = await getCategoryStatus();
    if (!status.imap.configured) {
      res.status(400).json({
        ok: false,
        error: 'IMAP not configured.',
      });
      return;
    }

    const host    = await getKey('imap.host');
    const portStr = await getKey('imap.port');
    const user    = await getKey('imap.user');
    const pass    = await getKey('imap.pass');
    const secStr  = await getKey('imap.secure');
    if (!host || !portStr || !user || !pass) {
      res.status(400).json({ ok: false, error: 'IMAP not configured (missing credential)' });
      return;
    }
    const port = Number(portStr);
    if (!Number.isFinite(port) || port <= 0) {
      res.status(400).json({ ok: false, error: 'imap.port is not a positive integer' });
      return;
    }
    const secure = (secStr ?? 'true').toLowerCase() !== 'false';
    const uid = Number(req.params['uid'] ?? 0);
    if (!Number.isFinite(uid) || uid <= 0) {
      res.status(400).json({ ok: false, error: 'Invalid UID' });
      return;
    }

    const client = new ImapFlow({
      host,
      port,
      secure,
      auth: { user, pass },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const msg = await client.fetchOne(uid, { uid: true, envelope: true, source: true });
        if (!msg) {
          res.status(404).json({ ok: false, error: 'Message not found' });
          return;
        }
        const env = msg.envelope;
        const fromList = (env?.from ?? []) as Array<{ name?: string; address?: string }>;
        const ccList = (env?.cc ?? []) as Array<{ name?: string; address?: string }>;
        const bccList = (env?.bcc ?? []) as Array<{ name?: string; address?: string }>;
        const first = fromList[0] ?? {};
        const fromStr = (first.name ?? '') + (first.address ? ' <' + first.address + '>' : '');
        const ccStr = ccList.map((c) => (c.name ?? '') + (c.address ? ' <' + c.address + '>' : '')).filter((s) => s.trim().length > 0).join(', ');
        const bccStr = bccList.map((c) => (c.name ?? '') + (c.address ? ' <' + c.address + '>' : '')).filter((s) => s.trim().length > 0).join(', ');
        let bodyText = '';
        if (msg.source) {
          const src = msg.source.toString();
          const match = src.match(/\r?\n\r?\n([\s\S]*)$/);
          if (match && match[1]) {
            bodyText = match[1].trim();
          }
        }
        res.json({
          ok: true,
          from: fromStr.trim(),
          cc: ccStr,
          bcc: bccStr,
          subject: env?.subject ?? '(sin asunto)',
          body_text: bodyText,
          date: env?.date ? new Date(env.date).toISOString() : '',
        });
      } finally {
        lock.release();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: 'IMAP fetch failed: ' + message });
    } finally {
      try { await client.logout(); } catch { /* ignore */ }
    }
  });
}
