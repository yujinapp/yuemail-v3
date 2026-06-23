/**
 * /api/contacts route (v0.6.4 / PND-022).
 *
 *   GET    /api/contacts        -> { ok, contacts }
 *   POST   /api/contacts        -> add  { name?, email, aliases? }  -> { ok, contact }
 *   PUT    /api/contacts/:id    -> edit { name?, email?, aliases? } -> { ok, contact }
 *   DELETE /api/contacts/:id    -> remove                            -> { ok }
 *
 * Error strings are in Spanish (the product language) and actionable.
 *
 * ASCII-only.
 */
import type { Express, Request, Response } from 'express';
import { listContacts, addContact, updateContact, deleteContact } from '../contacts.js';

export function registerContactsRoutes(app: Express): void {
  app.get('/api/contacts', async (_req: Request, res: Response) => {
    const contacts = await listContacts();
    res.json({ ok: true, contacts });
  });

  app.post('/api/contacts', async (req: Request, res: Response) => {
    const body = req.body as { name?: unknown; email?: unknown; aliases?: unknown } | undefined;
    const email = typeof body?.email === 'string' ? body.email : '';
    if (email.trim().length === 0) {
      res.status(400).json({ ok: false, error: 'Falta el correo del contacto.' });
      return;
    }
    const name = typeof body?.name === 'string' ? body.name : '';
    const aliases = Array.isArray(body?.aliases) ? body.aliases.filter((a): a is string => typeof a === 'string') : [];
    try {
      const contact = await addContact({ name, email, aliases });
      res.json({ ok: true, contact });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'No se pudo guardar el contacto.' });
    }
  });

  app.put('/api/contacts/:id', async (req: Request, res: Response) => {
    const id = req.params['id'] ?? '';
    const body = req.body as { name?: unknown; email?: unknown; aliases?: unknown } | undefined;
    const patch: { name?: string; email?: string; aliases?: string[] } = {};
    if (typeof body?.name === 'string') patch.name = body.name;
    if (typeof body?.email === 'string') patch.email = body.email;
    if (Array.isArray(body?.aliases)) patch.aliases = body.aliases.filter((a): a is string => typeof a === 'string');
    try {
      const contact = await updateContact(id, patch);
      if (!contact) {
        res.status(404).json({ ok: false, error: 'No encontre ese contacto.' });
        return;
      }
      res.json({ ok: true, contact });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'No se pudo editar el contacto.' });
    }
  });

  app.delete('/api/contacts/:id', async (req: Request, res: Response) => {
    const id = req.params['id'] ?? '';
    const removed = await deleteContact(id);
    if (!removed) {
      res.status(404).json({ ok: false, error: 'No encontre ese contacto.' });
      return;
    }
    res.json({ ok: true });
  });
}
