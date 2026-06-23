/**
 * Yuemail contacts book (v0.6.4 / PND-022 + v0.7 / PND-024).
 *
 * A small persistent address book so a person who cannot spell out an
 * email reliably can just say a NAME ("enviar a Maximiliano") and the
 * app resolves it to the right address. Three ways it fills up:
 *   1. An assistant types contacts in by hand (ContactsDialog).
 *   2. Every inbox read auto-registers the senders + CC recipients (upsertSender, upsertCC).
 *   3. Every email sent registers the recipients (upsertRecipientsFromSend).
 *
 * Storage: ~/.yuemail/contacts.json (or $YUEMAIL_HOME/contacts.json).
 * Emails are NOT secrets like the vault credentials, so this file is
 * plain JSON -- no encryption, just a flat list. The key for de-dup is
 * the lowercased email; one row per address.
 *
 * ASCII-only.
 */
import { promises as fs, existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';

export interface Contact {
  id: string;
  name: string;
  email: string;
  aliases: string[];
  source: 'manual' | 'inbox';
  created_at: number;
  updated_at: number;
}

/* Resolved lazily so tests can swap YUEMAIL_HOME per test, exactly like
 * the vault does. */
function homeDir(): string {
  const env = process.env['YUEMAIL_HOME'];
  return env ? path.resolve(env) : path.join(os.homedir(), '.yuemail');
}
function contactsFile(): string { return path.join(homeDir(), 'contacts.json'); }

function ensureHomeDir(): void {
  if (!existsSync(homeDir())) {
    mkdirSync(homeDir(), { recursive: true, mode: 0o700 });
  }
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());
}

/* Now() wrapped so the timestamp source is in one place. */
function now(): number { return Date.now(); }

async function readAll(): Promise<Contact[]> {
  if (!existsSync(contactsFile())) return [];
  try {
    const raw = await fs.readFile(contactsFile(), 'utf-8');
    if (raw.trim().length === 0) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    /* Defensive: keep only well-formed rows. */
    return parsed.filter((c): c is Contact =>
      !!c && typeof c === 'object' &&
      typeof (c as Contact).id === 'string' &&
      typeof (c as Contact).email === 'string',
    ).map((c) => ({
      id: c.id,
      name: typeof c.name === 'string' ? c.name : '',
      email: c.email,
      aliases: Array.isArray(c.aliases) ? c.aliases.filter((a) => typeof a === 'string') : [],
      source: c.source === 'inbox' ? 'inbox' : 'manual',
      created_at: typeof c.created_at === 'number' ? c.created_at : 0,
      updated_at: typeof c.updated_at === 'number' ? c.updated_at : 0,
    }));
  } catch {
    return [];
  }
}

async function writeAll(list: Contact[]): Promise<void> {
  ensureHomeDir();
  await fs.writeFile(contactsFile(), JSON.stringify(list, null, 2), { mode: 0o600 });
}

export async function listContacts(): Promise<Contact[]> {
  const list = await readAll();
  /* Stable, human-friendly order: by name, then email. */
  return list.sort((a, b) =>
    (a.name || a.email).localeCompare(b.name || b.email) || a.email.localeCompare(b.email),
  );
}

/**
 * Add (or merge) a contact entered by hand. De-dups by email: if the
 * address already exists, the name is updated (when a non-empty one is
 * given) and aliases are merged. Throws on an invalid email so the route
 * can return an actionable 400.
 */
export async function addContact(input: { name?: string; email: string; aliases?: string[] }): Promise<Contact> {
  const email = normalizeEmail(input.email ?? '');
  if (!isValidEmail(email)) {
    throw new Error('El correo "' + (input.email ?? '') + '" no es valido. Escribilo como nombre@dominio.com.');
  }
  const name = (input.name ?? '').trim();
  const aliases = (input.aliases ?? []).map((a) => a.trim()).filter((a) => a.length > 0);
  const list = await readAll();
  const existing = list.find((c) => c.email === email);
  if (existing) {
    if (name.length > 0) existing.name = name;
    existing.aliases = mergeAliases(existing.aliases, aliases);
    existing.updated_at = now();
    await writeAll(list);
    return existing;
  }
  const contact: Contact = {
    id: randomUUID(),
    name,
    email,
    aliases,
    source: 'manual',
    created_at: now(),
    updated_at: now(),
  };
  list.push(contact);
  await writeAll(list);
  return contact;
}

/**
 * Auto-register a sender seen in the inbox. De-dups by email. Never
 * overwrites a manually-set name with an empty one, and never downgrades
 * a manual contact's source to 'inbox'. Best-effort: callers ignore
 * failures so inbox reads never break on a contacts write.
 */
export async function upsertSender(input: { name?: string; email: string }): Promise<Contact | undefined> {
  const email = normalizeEmail(input.email ?? '');
  if (!isValidEmail(email)) return undefined;
  const name = (input.name ?? '').trim();
  const list = await readAll();
  const existing = list.find((c) => c.email === email);
  if (existing) {
    /* Only fill a missing name; do not clobber an assistant-entered one. */
    if (existing.name.length === 0 && name.length > 0) {
      existing.name = name;
      existing.updated_at = now();
      await writeAll(list);
    }
    return existing;
  }
  const contact: Contact = {
    id: randomUUID(),
    name,
    email,
    aliases: [],
    source: 'inbox',
    created_at: now(),
    updated_at: now(),
  };
  list.push(contact);
  await writeAll(list);
  return contact;
}

/**
 * Auto-register a recipient seen in the CC field of an incoming email.
 * Same semantics as upsertSender (v0.7 / PND-024).
 */
export async function upsertCC(input: { name?: string; email: string }): Promise<Contact | undefined> {
  return upsertSender(input);
}

/**
 * Auto-register recipients from a sent email. Called after a successful
 * send so the recipients are available for future recipient completion
 * (v0.7 / PND-024).
 */
export async function upsertRecipientsFromSend(recipients: string[]): Promise<void> {
  for (const addr of recipients) {
    try {
      await upsertSender({ email: addr });
    } catch {
      /* Best-effort: a contact write must never break email sends. */
    }
  }
}

export async function updateContact(
  id: string,
  patch: { name?: string; email?: string; aliases?: string[] },
): Promise<Contact | undefined> {
  const list = await readAll();
  const c = list.find((x) => x.id === id);
  if (!c) return undefined;
  if (typeof patch.name === 'string') c.name = patch.name.trim();
  if (typeof patch.email === 'string') {
    const email = normalizeEmail(patch.email);
    if (!isValidEmail(email)) throw new Error('El correo "' + patch.email + '" no es valido.');
    c.email = email;
  }
  if (Array.isArray(patch.aliases)) {
    c.aliases = patch.aliases.map((a) => a.trim()).filter((a) => a.length > 0);
  }
  c.updated_at = now();
  await writeAll(list);
  return c;
}

export async function deleteContact(id: string): Promise<boolean> {
  const list = await readAll();
  const next = list.filter((c) => c.id !== id);
  if (next.length === list.length) return false;
  await writeAll(next);
  return true;
}

/** Test helper: wipe the address book. */
export async function clearAllContacts(): Promise<void> {
  if (existsSync(contactsFile())) await fs.unlink(contactsFile());
}

function mergeAliases(a: string[], b: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of [...a, ...b]) {
    const k = x.trim().toLowerCase();
    if (k.length === 0 || seen.has(k)) continue;
    seen.add(k);
    out.push(x.trim());
  }
  return out;
}
