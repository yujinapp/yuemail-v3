/**
 * /api/email/send rejection (acceptance #4).
 *
 * When SMTP credentials are missing, the endpoint must respond with a
 * meaningful error (HTTP 400 + a clear message naming the gap).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { AddressInfo } from 'node:net';

let tmpHome = '';

beforeEach(async () => {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'yuemail-email-'));
  process.env['YUEMAIL_HOME']       = tmpHome;
  process.env['YUEMAIL_VAULT_PASS'] = 'test-pass-1234567890';
});

afterEach(async () => {
  delete process.env['YUEMAIL_HOME'];
  delete process.env['YUEMAIL_VAULT_PASS'];
  if (tmpHome) await fs.rm(tmpHome, { recursive: true, force: true });
});

async function loadApp() {
  const { buildApp } = await import('../server/index.js');
  return buildApp({ staticRoot: '/this/does/not/exist' });
}

async function fetchJson(url: string, init: RequestInit = {}): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: unknown = text;
  try { body = JSON.parse(text); } catch { /* keep text */ }
  return { status: res.status, body };
}

describe('POST /api/email/send -- rejection paths', () => {
  it('rejects with 400 + meaningful error when SMTP is not configured', async () => {
    const app = await loadApp();
    const server = await new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => {
        const addr = s.address() as AddressInfo;
        resolve({
          port: addr.port,
          close: () => new Promise<void>((r) => s.close(() => r())),
        });
      });
    });
    try {
      const { status, body } = await fetchJson('http://127.0.0.1:' + server.port + '/api/email/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: 'ana@example.com', subject: 'hi', body_text: 'hello' }),
      });
      expect(status).toBe(400);
      expect(body).toMatchObject({ ok: false });
      const b = body as { error?: string; missing?: string[] };
      /* User-facing message must be in Spanish (product language) and name
       * the SMTP gap. */
      expect(b.error).toMatch(/no esta configurado/i);
      expect(b.error).toMatch(/SMTP/);
      expect(b.missing).toBeDefined();
      expect(Array.isArray(b.missing)).toBe(true);
      expect((b.missing ?? []).length).toBeGreaterThan(0);
    } finally {
      await server.close();
    }
  });

  it('rejects with 400 when SMTP is configured but no recipients are provided', async () => {
    const { setKey } = await import('../server/vault.js');
    await setKey('smtp.host', 'smtp.example.com');
    await setKey('smtp.port', '587');
    await setKey('smtp.user', 'me@example.com');
    await setKey('smtp.pass', 'shhh');
    await setKey('identity.from', 'me@example.com');

    const app = await loadApp();
    const server = await new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => {
        const addr = s.address() as AddressInfo;
        resolve({
          port: addr.port,
          close: () => new Promise<void>((r) => s.close(() => r())),
        });
      });
    });
    try {
      const { status, body } = await fetchJson('http://127.0.0.1:' + server.port + '/api/email/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: 'no-an-email', subject: 's', body_text: 'b' }),
      });
      expect(status).toBe(400);
      const b = body as { ok?: boolean; error?: string };
      expect(b.ok).toBe(false);
      /* Spanish, actionable: names the invalid recipient problem. */
      expect(b.error).toMatch(/destinatario/i);
    } finally {
      await server.close();
    }
  });
});
