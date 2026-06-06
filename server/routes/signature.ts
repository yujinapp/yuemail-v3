/**
 * /api/signature/* routes.
 *
 *  GET  /api/signature       -> { exists, png_b64? }
 *  PUT  /api/signature       -> body { png_b64 } -> 204
 *  DELETE /api/signature     -> 204 / 404
 *
 * ASCII-only.
 */
import type { Express, Request, Response } from 'express';
import { hasSignature, saveSignature, readSignaturePngBase64, deleteSignature } from '../signature.js';

export function registerSignatureRoutes(app: Express): void {
  app.get('/api/signature', async (_req: Request, res: Response) => {
    if (!hasSignature()) {
      res.json({ ok: true, exists: false });
      return;
    }
    const png = await readSignaturePngBase64();
    res.json({ ok: true, exists: true, png_b64: png });
  });

  app.put('/api/signature', async (req: Request, res: Response) => {
    const body = req.body as { png_b64?: unknown } | undefined;
    const pngB64 = typeof body?.png_b64 === 'string' ? body.png_b64 : '';
    if (pngB64.length === 0) {
      res.status(400).json({ ok: false, error: 'png_b64 required' });
      return;
    }
    try {
      await saveSignature(pngB64);
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
      return;
    }
    res.status(204).end();
  });

  app.delete('/api/signature', async (_req: Request, res: Response) => {
    const ok = await deleteSignature();
    res.status(ok ? 204 : 404).end();
  });
}
