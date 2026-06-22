import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/* Each test runs against an isolated YUEMAIL_HOME so files do not
 * collide and we exercise the salt + vault file creation paths. */

let tmpHome = '';

beforeEach(async () => {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'yuemail-vault-'));
  process.env['YUEMAIL_HOME']        = tmpHome;
  process.env['YUEMAIL_VAULT_PASS']  = 'test-passphrase-very-long-1234567890';
});

afterEach(async () => {
  delete process.env['YUEMAIL_HOME'];
  delete process.env['YUEMAIL_VAULT_PASS'];
  if (tmpHome) await fs.rm(tmpHome, { recursive: true, force: true });
});

async function loadVault() {
  /* vault.ts resolves paths lazily per-call, so we can reuse the
   * same module instance across tests -- each test bumps
   * YUEMAIL_HOME and the module sees it next call. */
  return await import('../server/vault.js');
}

describe('vault round-trip (F8 / acceptance #3, #8)', () => {
  it('isValidVaultKey accepts every documented key', async () => {
    const v = await loadVault();
    for (const k of v.VAULT_KEYS) {
      expect(v.isValidVaultKey(k)).toBe(true);
    }
    expect(v.isValidVaultKey('attacker.key')).toBe(false);
  });

  it('VAULT_KEYS lists the 12 mail keys plus the 9 brain key slots', async () => {
    const v = await loadVault();
    const mailKeys = v.VAULT_KEYS.filter((k) => !k.startsWith('brain.'));
    const brainKeys = v.VAULT_KEYS.filter((k) => k.startsWith('brain.'));
    expect(mailKeys.length).toBe(12);
    expect(brainKeys.length).toBe(9);
    expect(v.VAULT_KEYS.length).toBe(21);
    /* The brain provider key slots are accepted by the vault. */
    expect(v.isValidVaultKey('brain.google_ai')).toBe(true);
    expect(v.isValidVaultKey('brain.anthropic')).toBe(true);
  });

  it('setKey + getKey round-trips a value', async () => {
    const v = await loadVault();
    await v.setKey('smtp.host', 'smtp.example.com');
    const got = await v.getKey('smtp.host');
    expect(got).toBe('smtp.example.com');
  });

  it('setKey + getAllKeys returns the key name', async () => {
    const v = await loadVault();
    await v.setKey('smtp.host', 'smtp.example.com');
    const keys = await v.getAllKeys();
    expect(keys).toContain('smtp.host');
  });

  it('setKey rejects unknown key names', async () => {
    const v = await loadVault();
    await expect(v.setKey('attacker.key', 'pwned')).rejects.toThrow(/unknown vault key/);
  });

  it('deleteKey removes the row', async () => {
    const v = await loadVault();
    await v.setKey('smtp.host', 'smtp.example.com');
    const ok = await v.deleteKey('smtp.host');
    expect(ok).toBe(true);
    expect(await v.getKey('smtp.host')).toBeUndefined();
  });

  it('deleteKey returns false on missing row', async () => {
    const v = await loadVault();
    expect(await v.deleteKey('smtp.host')).toBe(false);
  });

  it('getCategoryStatus reports SMTP as not configured when empty', async () => {
    const v = await loadVault();
    const s = await v.getCategoryStatus();
    expect(s.smtp.configured).toBe(false);
    expect(s.smtp.missing.length).toBeGreaterThan(0);
  });

  it('getCategoryStatus reports SMTP as configured after the 4 required keys', async () => {
    const v = await loadVault();
    await v.setKey('smtp.host', 'smtp.example.com');
    await v.setKey('smtp.port', '587');
    await v.setKey('smtp.user', 'me@example.com');
    await v.setKey('smtp.pass', 'shhh');
    const s = await v.getCategoryStatus();
    expect(s.smtp.configured).toBe(true);
  });
});

describe('vault encryption at rest (acceptance #8)', () => {
  it('raw vault.json does NOT contain the plaintext value', async () => {
    const v = await loadVault();
    const secret = 'super-secret-smtp-password-9876543210';
    await v.setKey('smtp.pass', secret);
    const raw = await v.readRawVaultFile();
    expect(raw).not.toContain(secret);
  });

  it('raw vault.json stores iv + ciphertext + tag (not plaintext shape)', async () => {
    const v = await loadVault();
    await v.setKey('smtp.pass', 'whatever');
    const raw = await v.readRawVaultFile();
    expect(raw).toMatch(/"iv":\s*"/);
    expect(raw).toMatch(/"ct":\s*"/);
    expect(raw).toMatch(/"tag":\s*"/);
  });

  it('multiple secrets do not share an IV', async () => {
    const v = await loadVault();
    await v.setKey('smtp.pass', 'one');
    await v.setKey('imap.pass', 'two');
    const raw = await v.readRawVaultFile();
    const ivs = [...raw.matchAll(/"iv":\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(ivs.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ivs).size).toBe(ivs.length);
  });

  it('encrypting the same value twice produces different ciphertexts', async () => {
    const v = await loadVault();
    await v.setKey('smtp.pass', 'same-value');
    const raw1 = await v.readRawVaultFile();
    await v.setKey('smtp.pass', 'same-value');
    const raw2 = await v.readRawVaultFile();
    const ct1 = raw1.match(/"ct":\s*"([^"]+)"/)?.[1];
    const ct2 = raw2.match(/"ct":\s*"([^"]+)"/)?.[1];
    expect(ct1).toBeDefined();
    expect(ct2).toBeDefined();
    expect(ct1).not.toBe(ct2);
  });

  it('passphraseSource reports env when YUEMAIL_VAULT_PASS is set', async () => {
    const v = await loadVault();
    expect(v.passphraseSource()).toBe('env');
  });

  it('passphraseSource reports the predictable derived fallback honestly', async () => {
    const v = await loadVault();
    delete process.env['YUEMAIL_VAULT_PASS'];
    expect(v.passphraseSource()).toBe('derived');
    process.env['YUEMAIL_VAULT_PASS'] = '';
    expect(v.passphraseSource()).toBe('derived');
  });
});
