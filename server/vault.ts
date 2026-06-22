/**
 * Yuemail BYOK vault (F8 / acceptance #8).
 *
 * AES-256-GCM, scrypt-derived key from (passphrase, per-machine salt).
 *
 * Storage layout:
 *   ~/.yuemail/vault.salt     -- 32 random bytes, written once at first launch.
 *   ~/.yuemail/vault.json     -- map of key-name to {iv, ciphertext, tag}.
 *
 * The vault JSON file never contains plaintext values of any secret.
 * Each stored value is encrypted independently with a fresh IV.
 *
 * Passphrase resolution order:
 *   1. env YUEMAIL_VAULT_PASS
 *   2. fallback: 'yuemail/' + os.hostname() + '/' + username
 *
 * Threat-model honesty: the fallback passphrase is PREDICTABLE. It
 * protects against exfiltration of the vault files alone (backup leak,
 * synced folder), but a local attacker who can read the files can also
 * read hostname + username and re-derive the key. Real at-rest secrecy
 * against local readers requires YUEMAIL_VAULT_PASS. The UI surfaces
 * this via key_source ('env' | 'derived') in /api/vault/status.
 *
 * Public surface:
 *   - getAllKeys(): list configured key names (no values).
 *   - getCategoryStatus(): per-category configured-booleans for the UI.
 *   - setKey(name, value): encrypt + persist.
 *   - getKey(name): decrypt + return (server-internal use only).
 *   - deleteKey(name): remove the row.
 *   - clearAll(): reset (test helpers).
 *
 * The `/api/vault/...` HTTP routes expose getAllKeys + getCategoryStatus +
 * setKey + deleteKey. They never expose getKey -- decrypted values stay
 * inside the server process.
 *
 * ASCII-only.
 */
import {
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
import { promises as fs, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/* Paths are resolved lazily so tests can swap YUEMAIL_HOME per test
 * without bumping a module-level constant frozen at import time. */
function homeDir(): string {
  const env = process.env['YUEMAIL_HOME'];
  return env ? path.resolve(env) : path.join(os.homedir(), '.yuemail');
}
function saltFile():  string { return path.join(homeDir(), 'vault.salt'); }
function vaultFile(): string { return path.join(homeDir(), 'vault.json'); }

const SCRYPT_N      = 16384;
const SCRYPT_R      = 8;
const SCRYPT_P      = 1;
const SCRYPT_KEYLEN = 32;
const IV_BYTES      = 12;

export const VAULT_KEYS = [
  'imap.host',
  'imap.port',
  'imap.user',
  'imap.pass',
  'imap.secure',
  'smtp.host',
  'smtp.port',
  'smtp.user',
  'smtp.pass',
  'smtp.secure',
  'identity.from',
  'identity.name',
  /* Brain provider API keys (v0.5.0). One slot per provider; the router
   * reads them server-side and they never reach the browser, exactly like
   * the mail credentials above. Ollama is local + keyless but kept in the
   * allowlist for symmetry. */
  'brain.google_ai',
  'brain.anthropic',
  'brain.openai',
  'brain.deepseek',
  'brain.xai',
  'brain.mistral',
  'brain.qwen',
  'brain.zai',
  'brain.ollama',
] as const;

export type VaultKey = (typeof VAULT_KEYS)[number];

export function isValidVaultKey(name: string): name is VaultKey {
  return (VAULT_KEYS as readonly string[]).includes(name);
}

interface EncryptedRow {
  iv:  string;  /* base64 */
  ct:  string;  /* base64 (ciphertext) */
  tag: string;  /* base64 (auth tag) */
}

type VaultFile = Record<string, EncryptedRow>;

function ensureHomeDir(): void {
  if (!existsSync(homeDir())) {
    mkdirSync(homeDir(), { recursive: true, mode: 0o700 });
  }
}

async function getOrCreateSalt(): Promise<Buffer> {
  ensureHomeDir();
  if (existsSync(saltFile())) {
    return fs.readFile(saltFile());
  }
  const salt = randomBytes(32);
  await fs.writeFile(saltFile(), salt, { mode: 0o600 });
  return salt;
}

/** Where the vault key comes from: a user-provided secret or the
 * predictable machine-derived fallback. Exposed so the UI can warn. */
export function passphraseSource(): 'env' | 'derived' {
  const envPass = process.env['YUEMAIL_VAULT_PASS'];
  return envPass && envPass.length > 0 ? 'env' : 'derived';
}

function resolvePassphrase(): string {
  const envPass = process.env['YUEMAIL_VAULT_PASS'];
  if (envPass && envPass.length > 0) return envPass;
  let userName = 'user';
  try {
    userName = os.userInfo().username;
  } catch { /* keep fallback */ }
  return 'yuemail/' + os.hostname() + '/' + userName;
}

async function deriveKey(): Promise<Buffer> {
  const salt = await getOrCreateSalt();
  const pass = resolvePassphrase();
  return scryptSync(pass, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
}

async function readVaultFile(): Promise<VaultFile> {
  if (!existsSync(vaultFile())) return {};
  try {
    const raw = await fs.readFile(vaultFile(), 'utf-8');
    if (raw.trim().length === 0) return {};
    return JSON.parse(raw) as VaultFile;
  } catch {
    return {};
  }
}

async function writeVaultFile(data: VaultFile): Promise<void> {
  ensureHomeDir();
  const payload = JSON.stringify(data, null, 2);
  await fs.writeFile(vaultFile(), payload, { mode: 0o600 });
}

export async function setKey(name: string, value: string): Promise<void> {
  if (!isValidVaultKey(name)) {
    throw new Error('unknown vault key: ' + name);
  }
  const key  = await deriveKey();
  const iv   = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct  = Buffer.concat([cipher.update(value, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const data = await readVaultFile();
  data[name] = {
    iv:  iv.toString('base64'),
    ct:  ct.toString('base64'),
    tag: tag.toString('base64'),
  };
  await writeVaultFile(data);
}

export async function getKey(name: string): Promise<string | undefined> {
  const data = await readVaultFile();
  const row = data[name];
  if (!row) return undefined;
  const key = await deriveKey();
  const iv  = Buffer.from(row.iv,  'base64');
  const ct  = Buffer.from(row.ct,  'base64');
  const tag = Buffer.from(row.tag, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf-8');
}

export async function deleteKey(name: string): Promise<boolean> {
  const data = await readVaultFile();
  if (!(name in data)) return false;
  delete data[name];
  await writeVaultFile(data);
  return true;
}

export async function getAllKeys(): Promise<string[]> {
  const data = await readVaultFile();
  return Object.keys(data).sort();
}

export interface CategoryStatus {
  imap:     { configured: boolean; missing: string[] };
  smtp:     { configured: boolean; missing: string[] };
  identity: { configured: boolean; missing: string[] };
}

const IMAP_KEYS:     VaultKey[] = ['imap.host', 'imap.port', 'imap.user', 'imap.pass'];
const SMTP_KEYS:     VaultKey[] = ['smtp.host', 'smtp.port', 'smtp.user', 'smtp.pass'];
const IDENTITY_KEYS: VaultKey[] = ['identity.from', 'identity.name'];

export async function getCategoryStatus(): Promise<CategoryStatus> {
  const data = await readVaultFile();
  const has = (k: string): boolean => k in data;
  const missing = (set: VaultKey[]): string[] => set.filter((k) => !has(k));
  return {
    imap:     { configured: IMAP_KEYS.every(has),     missing: missing(IMAP_KEYS) },
    smtp:     { configured: SMTP_KEYS.every(has),     missing: missing(SMTP_KEYS) },
    identity: { configured: IDENTITY_KEYS.every(has), missing: missing(IDENTITY_KEYS) },
  };
}

export async function smtpReady(): Promise<boolean> {
  const data = await readVaultFile();
  return SMTP_KEYS.every((k) => k in data);
}

export async function clearAll(): Promise<void> {
  if (existsSync(vaultFile())) {
    await fs.unlink(vaultFile());
  }
}

export async function readRawVaultFile(): Promise<string> {
  if (!existsSync(vaultFile())) return '';
  return fs.readFile(vaultFile(), 'utf-8');
}

export function vaultPaths(): { home: string; salt: string; vault: string } {
  return { home: homeDir(), salt: saltFile(), vault: vaultFile() };
}
