/**
 * /api/documents/* routes.
 *
 *  GET    /api/documents              -> list (recent first)
 *  POST   /api/documents              -> create + return
 *  GET    /api/documents/:id          -> read
 *  PUT    /api/documents/:id          -> update {title?, blocks?}
 *  DELETE /api/documents/:id          -> 204 / 404
 *  GET    /api/documents/:id/docx     -> stream the rendered .docx
 *
 * The /docx endpoint rebuilds the buffer on demand from the JSON
 * source-of-truth -- we never persist a .docx file.
 *
 * ASCII-only.
 */
import type { Express, Request, Response } from 'express';
import {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
} from '../documents.js';
import { renderDocx, type DocumentBlock } from '../docx-builder.js';

export function registerDocumentsRoutes(app: Express): void {
  app.get('/api/documents', async (_req: Request, res: Response) => {
    const docs = await listDocuments();
    res.json({ ok: true, documents: docs });
  });

  app.get('/api/documents/:id', async (req: Request, res: Response) => {
    const id = req.params['id'] ?? '';
    const doc = await getDocument(id);
    if (!doc) { res.status(404).json({ ok: false, error: 'not found' }); return; }
    res.json({ ok: true, document: doc });
  });

  app.post('/api/documents', async (req: Request, res: Response) => {
    const body = req.body as { title?: unknown; blocks?: unknown } | undefined;
    const title  = typeof body?.title === 'string' ? body.title : '';
    const blocks = Array.isArray(body?.blocks) ? body!.blocks as DocumentBlock[] : [];
    const doc = await createDocument({ title, blocks });
    res.status(201).json({ ok: true, document: doc });
  });

  app.put('/api/documents/:id', async (req: Request, res: Response) => {
    const id = req.params['id'] ?? '';
    const body = req.body as { title?: unknown; blocks?: unknown } | undefined;
    const patch: { title?: string; blocks?: DocumentBlock[] } = {};
    if (typeof body?.title === 'string')       patch.title  = body.title;
    if (Array.isArray(body?.blocks))           patch.blocks = body!.blocks as DocumentBlock[];
    const updated = await updateDocument(id, patch);
    if (!updated) { res.status(404).json({ ok: false, error: 'not found' }); return; }
    res.json({ ok: true, document: updated });
  });

  app.delete('/api/documents/:id', async (req: Request, res: Response) => {
    const id = req.params['id'] ?? '';
    const ok = await deleteDocument(id);
    res.status(ok ? 204 : 404).end();
  });

  app.get('/api/documents/:id/docx', async (req: Request, res: Response) => {
    const id = req.params['id'] ?? '';
    const doc = await getDocument(id);
    if (!doc) { res.status(404).json({ ok: false, error: 'not found' }); return; }
    const buf = await renderDocx(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="' + (doc.title || 'documento') + '.docx"');
    res.send(buf);
  });
}
