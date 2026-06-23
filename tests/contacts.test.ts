/**
 * Contacts book (server) -- PND-022.
 *
 * Isolated YUEMAIL_HOME per test so the contacts.json file is fresh.
 *
 * ASCII-only.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpHome = '';

beforeEach(async () => {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'yuemail-contacts-'));
  process.env['YUEMAIL_HOME'] = tmpHome;
});

afterEach(async () => {
  delete process.env['YUEMAIL_HOME'];
  if (tmpHome) await fs.rm(tmpHome, { recursive: true, force: true });
});

async function load() {
  return await import('../server/contacts.js');
}

describe('contacts book', () => {
  it('starts empty', async () => {
    const c = await load();
    expect(await c.listContacts()).toEqual([]);
  });

  it('adds a contact and reads it back', async () => {
    const c = await load();
    const added = await c.addContact({ name: 'Maximiliano Linares', email: 'Maxi@Gmail.com', aliases: ['maxi'] });
    expect(added.email).toBe('maxi@gmail.com'); /* normalised */
    expect(added.source).toBe('manual');
    const list = await c.listContacts();
    expect(list.length).toBe(1);
    expect(list[0]?.name).toBe('Maximiliano Linares');
    expect(list[0]?.aliases).toContain('maxi');
  });

  it('rejects an invalid email with an actionable message', async () => {
    const c = await load();
    await expect(c.addContact({ name: 'X', email: 'no-es-un-mail' })).rejects.toThrow(/valido/i);
  });

  it('de-dups by email: a second add merges name + aliases, no duplicate row', async () => {
    const c = await load();
    await c.addContact({ name: '', email: 'ana@ejemplo.com', aliases: ['anita'] });
    await c.addContact({ name: 'Ana Gomez', email: 'ANA@ejemplo.com', aliases: ['ani'] });
    const list = await c.listContacts();
    expect(list.length).toBe(1);
    expect(list[0]?.name).toBe('Ana Gomez');
    expect(list[0]?.aliases.sort()).toEqual(['ani', 'anita']);
  });

  it('upsertSender auto-registers an inbox sender once', async () => {
    const c = await load();
    await c.upsertSender({ name: 'Pedro', email: 'pedro@test.org' });
    await c.upsertSender({ name: 'Pedro', email: 'pedro@test.org' });
    const list = await c.listContacts();
    expect(list.length).toBe(1);
    expect(list[0]?.source).toBe('inbox');
  });

  it('upsertSender never clobbers an assistant-entered name with an empty one', async () => {
    const c = await load();
    await c.addContact({ name: 'Ana Gomez', email: 'ana@ejemplo.com' });
    await c.upsertSender({ name: '', email: 'ana@ejemplo.com' });
    const list = await c.listContacts();
    expect(list[0]?.name).toBe('Ana Gomez');
    expect(list[0]?.source).toBe('manual'); /* not downgraded */
  });

  it('upsertSender fills a missing name', async () => {
    const c = await load();
    await c.upsertSender({ name: '', email: 'sin-nombre@test.org' });
    await c.upsertSender({ name: 'Con Nombre', email: 'sin-nombre@test.org' });
    const list = await c.listContacts();
    expect(list[0]?.name).toBe('Con Nombre');
  });

  it('updates and deletes by id', async () => {
    const c = await load();
    const added = await c.addContact({ name: 'Temp', email: 'temp@test.org' });
    const updated = await c.updateContact(added.id, { name: 'Permanente' });
    expect(updated?.name).toBe('Permanente');
    expect(await c.deleteContact(added.id)).toBe(true);
    expect(await c.listContacts()).toEqual([]);
    expect(await c.deleteContact('no-existe')).toBe(false);
  });

  it('ignores an invalid email for upsertSender (best-effort, never throws)', async () => {
    const c = await load();
    const r = await c.upsertSender({ name: 'X', email: 'garbage' });
    expect(r).toBeUndefined();
    expect(await c.listContacts()).toEqual([]);
  });
});
