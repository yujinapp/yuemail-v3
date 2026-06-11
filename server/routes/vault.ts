/**
 * /api/vault/* routes.
 *
 *  GET    /api/vault/keys           -> string[] of configured key names
 *  GET    /api/vault/status         -> { imap, smtp, identity } booleans
 *                                      + key_source ('env' | 'derived')
 *  PUT    /api/vault/key            -> body { name, value } -> 204
 *  DELETE /api/vault/key/:name      -> 204 / 404
 *
 * No endpoint returns a decrypted value. The decrypted value only
 * leaves the server when the SMTP send route or the IMAP list route
 * uses it internally.
 *
 * ASCII-only.
 */
import type { Express, Request, Response } from 'express';
import { getAllKeys, getCategoryStatus, setKey, deleteKey, isValidVaultKey, passphraseSource } from '../vault.js';

export function registerVaultRoutes(app: Express): void {
  app.get('/api/vault/keys', async (_req: Request, res: Response) => {
    const keys = await getAllKeys();
    res.json({ ok: true, keys });
  });

  app.get('/api/vault/status', async (_req: Request, res: Response) => {
    const status = await getCategoryStatus();
    res.json({ ok: true, status, key_source: passphraseSource() });
  });

  app.put('/api/vault/key', async (req: Request, res: Response) => {
    const body = req.body as { name?: unknown; value?: unknown } | undefined;
    const name  = typeof body?.name  === 'string' ? body.name  : '';
    const value = typeof body?.value === 'string' ? body.value : '';
    if (!isValidVaultKey(name)) {
      res.status(400).json({ ok: false, error: 'unknown vault key: ' + name });
      return;
    }
    if (value.length === 0) {
      res.status(400).json({ ok: false, error: 'value cannot be empty' });
      return;
    }
    await setKey(name, value);
    res.status(204).end();
  });

  app.delete('/api/vault/key/:name', async (req: Request, res: Response) => {
    const name = req.params['name'] ?? '';
    if (!isValidVaultKey(name)) {
      res.status(400).json({ ok: false, error: 'unknown vault key: ' + name });
      return;
    }
    const ok = await deleteKey(name);
    res.status(ok ? 204 : 404).end();
  });
}
