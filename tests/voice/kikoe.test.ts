/**
 * /api/kikoe/* integration (PND-032) -- Yuemail as adopter #1 of the decoupled
 * voice-trainer add-on @yujinapp/nac3-kikoe.
 *
 * Exercises the device-scoped store + routes end to end: default mode, enroll
 * (numeric fingerprints only), metrics movement from the two feedback signals,
 * the perilla, validation, train and forget. Isolated YUEMAIL_HOME per run so
 * the kikoe.json store is fresh.
 *
 * ASCII-only.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { AddressInfo } from 'node:net';

let tmpHome = '';

beforeEach(async () => {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'yuemail-kikoe-'));
  process.env['YUEMAIL_HOME'] = tmpHome;
});

afterEach(async () => {
  delete process.env['YUEMAIL_HOME'];
  if (tmpHome) await fs.rm(tmpHome, { recursive: true, force: true });
});

async function withServer<T>(fn: (base: string) => Promise<T>): Promise<T> {
  /* The kikoe store resolves YUEMAIL_HOME on every read/write, so the shared
   * engine respects this test's isolated home with no module-cache games. */
  const { buildApp } = await import('../../server/index.js');
  const app = buildApp({ staticRoot: '/this/does/not/exist' });
  const server = await new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => {
      const addr = s.address() as AddressInfo;
      resolve({ port: addr.port, close: () => new Promise<void>((r) => s.close(() => r())) });
    });
  });
  try {
    return await fn('http://127.0.0.1:' + server.port);
  } finally {
    await server.close();
  }
}

async function j(url: string, init: RequestInit = {}): Promise<{ status: number; body: any }> {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: unknown = text;
  try { body = JSON.parse(text); } catch { /* keep */ }
  return { status: res.status, body };
}

function post(base: string, p: string, payload: unknown) {
  return j(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
}

const FP = { frames: [[0.1, 0.2, 0.3], [0.15, 0.25, 0.35]] };

describe('/api/kikoe/*', () => {
  it('starts empty with the owner default mode "learning"', async () => {
    await withServer(async (base) => {
      const { status, body } = await j(base + '/api/kikoe/state');
      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.mode).toBe('learning');
      expect(body.metrics).toEqual([]);
      expect(body.templates).toEqual([]);
    });
  });

  it('enrolls numeric fingerprints and reflects them in state', async () => {
    await withServer(async (base) => {
      const enroll = await post(base, '/api/kikoe/enroll', { command: 'leer bandeja', fingerprints: [FP] });
      expect(enroll.status).toBe(200);
      expect(enroll.body).toMatchObject({ ok: true, samples: 1 });

      const { body } = await j(base + '/api/kikoe/state');
      expect(body.templates).toHaveLength(1);
      expect(body.templates[0].command).toBe('leer bandeja');
      const m = body.metrics.find((x: any) => x.command === 'leer bandeja');
      expect(m.samples).toBe(1);
      /* Fresh command starts green-from-inexperience. */
      expect(m.confidence).toBeCloseTo(0.5, 5);
      expect(m.effectiveness).toBeCloseTo(0.5, 5);
    });
  });

  it('the two feedback signals move confidence and effectiveness', async () => {
    await withServer(async (base) => {
      await post(base, '/api/kikoe/enroll', { command: 'firmar', fingerprints: [FP] });
      for (let i = 0; i < 4; i++) await post(base, '/api/kikoe/observe-outcome', { command: 'firmar', accepted: true });
      await post(base, '/api/kikoe/observe-cloud', { command: 'firmar', agreed: true });
      await post(base, '/api/kikoe/observe-cloud', { command: 'firmar', agreed: false });

      const { body } = await j(base + '/api/kikoe/state');
      const m = body.metrics.find((x: any) => x.command === 'firmar');
      expect(m.confidence).toBeGreaterThan(0.5);
      expect(m.feedbackCount).toBe(4);
      expect(m.measurementCount).toBe(2);
    });
  });

  it('switches the perilla and rejects an invalid mode', async () => {
    await withServer(async (base) => {
      const ok = await j(base + '/api/kikoe/config', {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'always' }),
      });
      expect(ok.body).toMatchObject({ ok: true, mode: 'always' });

      const bad = await j(base + '/api/kikoe/config', {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'turbo' }),
      });
      expect(bad.status).toBe(400);
      expect(bad.body.ok).toBe(false);
    });
  });

  it('rejects malformed fingerprints (never stores garbage / audio)', async () => {
    await withServer(async (base) => {
      const bad = await post(base, '/api/kikoe/enroll', { command: 'x', fingerprints: [{ frames: [['a', 'b']] }] });
      expect(bad.status).toBe(400);
      expect(bad.body.ok).toBe(false);

      const empty = await post(base, '/api/kikoe/enroll', { command: 'x', fingerprints: [] });
      expect(empty.status).toBe(400);
    });
  });

  it('trains and forgets a command (drops templates and metrics)', async () => {
    await withServer(async (base) => {
      await post(base, '/api/kikoe/enroll', { command: 'enviar', fingerprints: [FP] });
      const trained = await post(base, '/api/kikoe/train', {});
      expect(trained.body.trained).toContain('enviar');

      const forget = await post(base, '/api/kikoe/forget', { command: 'enviar' });
      expect(forget.body.ok).toBe(true);

      const { body } = await j(base + '/api/kikoe/state');
      expect(body.templates).toEqual([]);
      expect(body.metrics).toEqual([]);
    });
  });
});
