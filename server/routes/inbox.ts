/**
 * /api/inbox/list route (F7).
 *
 * GET /api/inbox/list?limit=N -> last N envelopes (default 20, max 100).
 *
 * Uses imapflow to read envelopes only; no body fetch, no reply, no
 * forward. Returns { ok: false, error: 'IMAP not configured' } when
 * vault is missing IMAP credentials.
 *
 * ASCII-only.
 */
import type { Express, Request, Response } from 'express';
import { ImapFlow } from 'imapflow';
import { getCategoryStatus, getKey } from '../vault.js';
import { upsertSender } from '../contacts.js';

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
        /* Auto-register each sender in the address book so the person can
         * later reply / write by NAME instead of spelling the address out
         * (PND-022). Best-effort: a contacts write must never break the
         * inbox read, so failures are swallowed. */
        const seenSenders = new Map<string, string>();
        for await (const msg of client.fetch(range, { uid: true, envelope: true })) {
          const env = msg.envelope;
          const fromList = (env?.from ?? []) as Array<{ name?: string; address?: string }>;
          const first = fromList[0] ?? {};
          const fromStr = (first.name ?? '') + (first.address ? ' <' + first.address + '>' : '');
          if (first.address) seenSenders.set(first.address, first.name ?? '');
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
}
