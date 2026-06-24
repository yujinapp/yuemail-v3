/**
 * One-time inbox contact backfill (Fase 1 / PND-027).
 *
 * Isolated YUEMAIL_HOME per test so both the contacts book and the import
 * marker start fresh. The IMAP read is injected (fetchInbox) so these run
 * headless, with no real mail server.
 *
 * ASCII-only.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpHome = '';

beforeEach(async () => {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'yuemail-import-'));
  process.env['YUEMAIL_HOME'] = tmpHome;
});

afterEach(async () => {
  delete process.env['YUEMAIL_HOME'];
  if (tmpHome) await fs.rm(tmpHome, { recursive: true, force: true });
});

async function load() {
  return await import('../server/contactsImport.js');
}
async function loadContacts() {
  return await import('../server/contacts.js');
}

/** A fake inbox: same address can appear many times, like a real mailbox. */
function fakeInbox(rows: Array<{ name?: string; email: string }>) {
  let lastMax = -1;
  const fn = async (maxEmails: number) => { lastMax = maxEmails; return rows; };
  return { fn, calls: () => lastMax };
}

describe('contacts import -- one-time lock', () => {
  it('defaults to pending, autoImport on, 300 emails', async () => {
    const m = await load();
    const st = await m.readImportState();
    expect(st.status).toBe('pending');
    expect(st.autoImport).toBe(true);
    expect(st.maxEmails).toBe(300);
    expect(st.lastRunAt).toBeNull();
  });

  it('runs the backfill once, registers contacts, then locks to done', async () => {
    const m = await load();
    const c = await loadContacts();
    const inbox = fakeInbox([
      { name: 'Ana Gomez', email: 'ana@ejemplo.com' },
      { name: 'Pedro',     email: 'pedro@test.org' },
    ]);
    const r1 = await m.runStartupImport({ fetchInbox: inbox.fn, now: () => 1000 });
    expect(r1).toEqual({ scanned: 2, imported: 2 });

    const contacts = await c.listContacts();
    expect(contacts.map((x) => x.email).sort()).toEqual(['ana@ejemplo.com', 'pedro@test.org']);

    const st = await m.readImportState();
    expect(st.status).toBe('done');
    expect(st.importedCount).toBe(2);
    expect(st.lastRunAt).toBe(1000);
  });

  it('a SECOND startup does not run again (the lock holds)', async () => {
    const m = await load();
    const inbox = fakeInbox([{ name: 'Ana', email: 'ana@ejemplo.com' }]);
    await m.runStartupImport({ fetchInbox: inbox.fn });
    const second = await m.runStartupImport({ fetchInbox: inbox.fn });
    expect(second).toBeNull(); /* skipped: already done */
  });

  it('reset re-arms the import so the next startup runs again', async () => {
    const m = await load();
    const inbox = fakeInbox([{ name: 'Ana', email: 'ana@ejemplo.com' }]);
    await m.runStartupImport({ fetchInbox: inbox.fn });
    expect(await m.runStartupImport({ fetchInbox: inbox.fn })).toBeNull();

    await m.resetImport();
    const st = await m.readImportState();
    expect(st.status).toBe('pending');

    const again = await m.runStartupImport({ fetchInbox: inbox.fn });
    expect(again).not.toBeNull();
  });

  it('autoImport=false blocks the startup backfill entirely', async () => {
    const m = await load();
    await m.patchImportState({ autoImport: false });
    const inbox = fakeInbox([{ name: 'Ana', email: 'ana@ejemplo.com' }]);
    const r = await m.runStartupImport({ fetchInbox: inbox.fn });
    expect(r).toBeNull();
  });

  it('honours a configurable email count and clamps out-of-range values', async () => {
    const m = await load();
    const inbox = fakeInbox([{ name: 'Ana', email: 'ana@ejemplo.com' }]);
    await m.patchImportState({ maxEmails: 50 });
    await m.runStartupImport({ fetchInbox: inbox.fn });
    expect(inbox.calls()).toBe(50); /* the reader was asked for exactly 50 */

    expect(m.clampMaxEmails(0)).toBe(1);
    expect(m.clampMaxEmails(99999)).toBe(2000);
    expect(m.clampMaxEmails('abc')).toBe(300);
    expect(m.clampMaxEmails(300)).toBe(300);
  });

  it('de-dups within the backfill and against existing contacts', async () => {
    const m = await load();
    const c = await loadContacts();
    await c.addContact({ name: 'Paula', email: 'paula@test.org' }); /* already manual */
    const inbox = fakeInbox([
      { name: '',      email: 'ana@ejemplo.com' },
      { name: 'Ana G', email: 'ANA@ejemplo.com' }, /* same address, has the name */
      { email: 'paula@test.org' },                 /* already there */
    ]);
    const r = await m.runStartupImport({ fetchInbox: inbox.fn });
    /* ana (collapsed to one) + paula (already there) -> ana is the only NEW row */
    expect(r?.imported).toBe(1);
    const contacts = await c.listContacts();
    expect(contacts.length).toBe(2);
    const ana = contacts.find((x) => x.email === 'ana@ejemplo.com');
    expect(ana?.name).toBe('Ana G'); /* the named duplicate won */
    const paula = contacts.find((x) => x.email === 'paula@test.org');
    expect(paula?.source).toBe('manual'); /* not downgraded by the backfill */
  });

  it('records the error and leaves the lock OPEN when the inbox read fails', async () => {
    const m = await load();
    const failing = async () => { throw new Error('IMAP boom'); };
    const r = await m.runStartupImport({ fetchInbox: failing, now: () => 2000 });
    expect(r).toBeNull();
    const st = await m.readImportState();
    expect(st.status).toBe('error');
    expect(st.lastError).toContain('IMAP boom');
    /* error is NOT 'done' -> a later start may retry */
    expect(m.shouldRunImport(st)).toBe(true);
  });

  it('an unconfigured mailbox is a clean no-op that still locks', async () => {
    const m = await load();
    const empty = async () => []; /* no IMAP account yet */
    const r = await m.runStartupImport({ fetchInbox: empty });
    expect(r).toEqual({ scanned: 0, imported: 0 });
    const st = await m.readImportState();
    expect(st.status).toBe('done'); /* nothing to import, but we are settled */
  });
});
