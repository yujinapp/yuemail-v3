/**
 * One-time inbox contact import (Fase 1 / PND-027).
 *
 * The day-to-day agenda already fills itself: every inbox read registers
 * senders + CC (upsertSender / upsertCC) and every send registers the
 * recipients (upsertRecipientsFromSend). What those miss is HISTORY -- the
 * people the user mailed with BEFORE installing Yuemail. This module does a
 * single backfill pass over the most recent inbox envelopes the first time
 * the product starts with email configured, then locks itself so it never
 * repeats (the subsequent contacts arrive automatically through the live
 * paths above).
 *
 * The lock is a persistent marker in ~/.yuemail/contacts-import.json. An
 * assistant can re-arm it (run the backfill again, e.g. after switching
 * accounts) by flipping the switch back to 'pending' via resetImport().
 *
 * Best-effort by design: the backfill runs fire-and-forget at startup and a
 * failure NEVER blocks the server nor breaks anything -- it just records the
 * error in the marker and leaves the lock open for the next start.
 *
 * Storage: ~/.yuemail/contacts-import.json (or $YUEMAIL_HOME/...).
 *
 * ASCII-only.
 */
import { promises as fs, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ImapFlow } from 'imapflow';
import { getCategoryStatus, getKey } from './vault.js';
import { upsertCC, listContacts } from './contacts.js';

/** How many recent envelopes the backfill scans by default. Configurable
 *  (1..2000); 300 keeps a first start quick while still covering months of
 *  correspondence for a typical mailbox. */
export const DEFAULT_MAX_EMAILS = 300;
const MIN_MAX_EMAILS = 1;
const MAX_MAX_EMAILS = 2000;

export type ImportStatus = 'pending' | 'running' | 'done' | 'error';

export interface ImportState {
  version: 1;
  /** Master switch. When false the startup backfill never runs. */
  autoImport: boolean;
  /** Envelopes the backfill scans (clamped 1..2000). */
  maxEmails: number;
  /** The persistent lock. 'done' => already imported, do not repeat. */
  status: ImportStatus;
  /** Epoch ms of the last completed (or failed) run, null if never. */
  lastRunAt: number | null;
  /** Contacts written by the last run. */
  importedCount: number;
  /** Short message from the last failure, null on success. */
  lastError: string | null;
}

/** A sender / CC pulled from one envelope, ready for the address book. */
export interface InboxContact { name?: string; email: string }

/** Pluggable inbox reader (test seam). Returns every from/CC across the last
 *  N envelopes; de-dup + validation happen in the upsert layer. */
export type FetchInboxContacts = (maxEmails: number) => Promise<InboxContact[]>;

function homeDir(): string {
  const env = process.env['YUEMAIL_HOME'];
  return env ? path.resolve(env) : path.join(os.homedir(), '.yuemail');
}
function stateFile(): string { return path.join(homeDir(), 'contacts-import.json'); }

function ensureHomeDir(): void {
  if (!existsSync(homeDir())) mkdirSync(homeDir(), { recursive: true, mode: 0o700 });
}

export function clampMaxEmails(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return DEFAULT_MAX_EMAILS;
  return Math.min(Math.max(Math.floor(n), MIN_MAX_EMAILS), MAX_MAX_EMAILS);
}

function defaultState(): ImportState {
  return {
    version: 1,
    autoImport: true,
    maxEmails: DEFAULT_MAX_EMAILS,
    status: 'pending',
    lastRunAt: null,
    importedCount: 0,
    lastError: null,
  };
}

export async function readImportState(): Promise<ImportState> {
  const def = defaultState();
  try {
    const raw = await fs.readFile(stateFile(), 'utf-8');
    const j = JSON.parse(raw) as Partial<ImportState>;
    const status: ImportStatus =
      j.status === 'done' || j.status === 'running' || j.status === 'error' ? j.status : 'pending';
    return {
      version: 1,
      autoImport: j.autoImport !== false,
      maxEmails: clampMaxEmails(j.maxEmails),
      status,
      lastRunAt: typeof j.lastRunAt === 'number' ? j.lastRunAt : null,
      importedCount: typeof j.importedCount === 'number' ? j.importedCount : 0,
      lastError: typeof j.lastError === 'string' ? j.lastError : null,
    };
  } catch {
    return def;
  }
}

async function writeImportState(state: ImportState): Promise<void> {
  ensureHomeDir();
  const p = stateFile();
  const tmp = p + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  await fs.rename(tmp, p);
}

export async function patchImportState(patch: Partial<ImportState>): Promise<ImportState> {
  const cur = await readImportState();
  const next: ImportState = {
    version: 1,
    autoImport: typeof patch.autoImport === 'boolean' ? patch.autoImport : cur.autoImport,
    maxEmails: patch.maxEmails === undefined ? cur.maxEmails : clampMaxEmails(patch.maxEmails),
    status: patch.status ?? cur.status,
    lastRunAt: patch.lastRunAt === undefined ? cur.lastRunAt : patch.lastRunAt,
    importedCount: patch.importedCount === undefined ? cur.importedCount : patch.importedCount,
    lastError: patch.lastError === undefined ? cur.lastError : patch.lastError,
  };
  await writeImportState(next);
  return next;
}

/**
 * Re-arm the one-time import: flip the lock back to 'pending' so the next
 * startup (or an explicit runStartupImport) backfills again. This is the
 * "switch en config" that unlocks a second pass (e.g. after the user
 * switches mailboxes). Clears the previous run's error.
 */
export async function resetImport(): Promise<ImportState> {
  return patchImportState({ status: 'pending', lastError: null });
}

/** True when a backfill should run: enabled, and not already done / running. */
export function shouldRunImport(state: ImportState): boolean {
  return state.autoImport && state.status !== 'done' && state.status !== 'running';
}

/**
 * Default inbox reader: connect over IMAP with the vault credentials and
 * collect senders + CC from the last `maxEmails` envelopes. Mirrors the
 * read-only envelope fetch of /api/inbox/list (no body fetch). Returns an
 * empty list when IMAP is unconfigured so the caller treats "no account
 * yet" as a clean no-op, not an error.
 */
export const fetchInboxContactsViaImap: FetchInboxContacts = async (maxEmails: number) => {
  const status = await getCategoryStatus();
  if (!status.imap.configured) return [];

  const host    = await getKey('imap.host');
  const portStr = await getKey('imap.port');
  const user    = await getKey('imap.user');
  const pass    = await getKey('imap.pass');
  const secStr  = await getKey('imap.secure');
  if (!host || !portStr || !user || !pass) return [];
  const port = Number(portStr);
  if (!Number.isFinite(port) || port <= 0) return [];
  const secure = (secStr ?? 'true').toLowerCase() !== 'false';

  const client = new ImapFlow({ host, port, secure, auth: { user, pass }, logger: false });
  const out: InboxContact[] = [];
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const mbox = client.mailbox as { exists?: number } | undefined;
      const total = (mbox && typeof mbox.exists === 'number') ? mbox.exists : 0;
      if (total === 0) return [];
      const start = Math.max(1, total - maxEmails + 1);
      const range = start + ':' + total;
      for await (const msg of client.fetch(range, { uid: true, envelope: true })) {
        const env = msg.envelope;
        const fromList = (env?.from ?? []) as Array<{ name?: string; address?: string }>;
        for (const f of fromList) {
          if (f.address) out.push({ name: f.name ?? '', email: f.address });
        }
        const ccList = (env?.cc ?? []) as Array<{ name?: string; address?: string }>;
        for (const cc of ccList) {
          if (cc.address) out.push({ name: cc.name ?? '', email: cc.address });
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }
  return out;
};

export interface SyncResult { scanned: number; imported: number }

/**
 * Run the backfill once: read the inbox contacts and upsert each into the
 * address book. De-dup, validation and "never clobber a manual name" all
 * live in upsertSender/upsertCC, so this just counts the new rows. CC uses
 * upsertCC for symmetry with the live inbox read (same semantics today).
 */
export async function syncContactsFromInbox(
  opts: { maxEmails?: number; fetchInbox?: FetchInboxContacts } = {},
): Promise<SyncResult> {
  const max = clampMaxEmails(opts.maxEmails ?? DEFAULT_MAX_EMAILS);
  const fetchInbox = opts.fetchInbox ?? fetchInboxContactsViaImap;
  const found = await fetchInbox(max);

  /* Collapse to one entry per address before writing, preferring an entry
   * that carries a name -- fewer redundant writes, same result. */
  const byEmail = new Map<string, InboxContact>();
  for (const c of found) {
    const key = c.email.trim().toLowerCase();
    if (key.length === 0) continue;
    const prev = byEmail.get(key);
    if (!prev || ((prev.name ?? '').length === 0 && (c.name ?? '').length > 0)) {
      byEmail.set(key, c);
    }
  }

  /* upsertCC returns the contact whether it was created OR already existed,
   * so it cannot tell us the new count on its own. Measure the NET new rows
   * by the address-book size before/after -- accurate even when some rows
   * are invalid (those create nothing) or already present (manual/inbox). */
  const before = (await listContacts()).length;
  for (const c of byEmail.values()) {
    try {
      await upsertCC({ name: c.name, email: c.email });
    } catch {
      /* Best-effort: one bad row must never abort the backfill. */
    }
  }
  const after = (await listContacts()).length;
  return { scanned: byEmail.size, imported: Math.max(0, after - before) };
}

/**
 * Startup orchestrator (fire-and-forget). Decides from the persistent marker
 * whether to backfill, runs it, and records the outcome + locks on success.
 * Never throws: a failure leaves the lock open and is recorded for the next
 * start. Returns the run result, or null when the backfill was skipped.
 */
export async function runStartupImport(
  opts: { fetchInbox?: FetchInboxContacts; now?: () => number } = {},
): Promise<SyncResult | null> {
  const now = opts.now ?? (() => Date.now());
  const state = await readImportState();
  if (!shouldRunImport(state)) return null;

  await patchImportState({ status: 'running' });
  try {
    const result = await syncContactsFromInbox({ maxEmails: state.maxEmails, fetchInbox: opts.fetchInbox });
    await patchImportState({
      status: 'done',
      lastRunAt: now(),
      importedCount: result.imported,
      lastError: null,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 200) : String(err);
    await patchImportState({ status: 'error', lastRunAt: now(), lastError: message });
    return null;
  }
}

/** Test helper: wipe the import marker. */
export async function clearImportState(): Promise<void> {
  if (existsSync(stateFile())) await fs.unlink(stateFile());
}
