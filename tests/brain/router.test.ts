/**
 * Brain router logic -- parse/validate + resolveUtterance with a mocked
 * provider. No network, no real key: proves camino 1 classifies, thresholds
 * confidence, and fails closed so the caller can fall back.
 *
 * ASCII-only.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { parseBrainReply, resolveUtterance } from '../../server/brain/router.js';
import { writeBrainConfig, defaultBrainConfig } from '../../server/brain/config.js';

describe('parseBrainReply', () => {
  it('accepts a well-formed reply in catalog', () => {
    const r = parseBrainReply('{"type":"ENVIAR","payload":"ana@ejemplo.com","confidence":0.9}', 'global', 0.5, 'm');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.type).toBe('ENVIAR');
      expect(r.payload).toBe('ana@ejemplo.com');
      expect(r.confidence).toBe(0.9);
    }
  });

  it('strips a ```json fence', () => {
    const r = parseBrainReply('```json\n{"type":"LEER_BANDEJA","confidence":0.8}\n```', 'global', 0.5, 'm');
    expect(r.ok).toBe(true);
  });

  it('recovers a JSON object wrapped in prose', () => {
    const r = parseBrainReply('Claro: {"type":"NUEVO_DOCUMENTO","confidence":0.95} listo', 'global', 0.5, 'm');
    expect(r.ok).toBe(true);
  });

  it('rejects below min_confidence', () => {
    const r = parseBrainReply('{"type":"ENVIAR","confidence":0.2}', 'global', 0.5, 'm');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('low_confidence');
  });

  it('rejects a type not in the context catalog', () => {
    /* CONFIRMAR_ENVIO is a send_dialog command, not global. */
    const r = parseBrainReply('{"type":"CONFIRMAR_ENVIO","confidence":0.9}', 'global', 0.5, 'm');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_in_catalog');
  });

  it('accepts a context-specific type in its context', () => {
    const r = parseBrainReply('{"type":"CONFIRMAR_ENVIO","confidence":0.9}', 'send_dialog', 0.5, 'm');
    expect(r.ok).toBe(true);
  });

  it('rejects unparseable output', () => {
    const r = parseBrainReply('no idea what you mean', 'global', 0.5, 'm');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('unparseable');
  });

  it('normalises a stray lowercase type', () => {
    const r = parseBrainReply('{"type":"enviar","confidence":0.9}', 'global', 0.5, 'm');
    expect(r.ok).toBe(true);
  });
});

describe('resolveUtterance', () => {
  let home: string;
  beforeEach(async () => {
    home = path.join(os.tmpdir(), 'yuemail-brain-' + Math.random().toString(36).slice(2));
    process.env['YUEMAIL_HOME'] = home;
    const cfg = defaultBrainConfig();
    await writeBrainConfig(cfg);
  });
  afterEach(async () => {
    delete process.env['YUEMAIL_HOME'];
    try { await fs.rm(home, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  function geminiFetch(jsonText: string): typeof fetch {
    return (async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: jsonText }] } }] }),
    })) as unknown as typeof fetch;
  }

  it('classifies via the (mocked) Gemini provider', async () => {
    const r = await resolveUtterance('quiero mandarle un correo a mi hijo', 'global', {
      apiKeyOverride: 'fake-key',
      fetchImpl: geminiFetch('{"type":"ENVIAR","payload":"","confidence":0.88}'),
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.type).toBe('ENVIAR');
  });

  it('returns no_key when the provider needs one and none is given', async () => {
    const r = await resolveUtterance('hola', 'global', { apiKeyOverride: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no_key');
  });

  it('returns disabled when the brain is off', async () => {
    await writeBrainConfig({ ...defaultBrainConfig(), enabled: false });
    const r = await resolveUtterance('hola', 'global', { apiKeyOverride: 'k' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('disabled');
  });

  it('returns error (caller falls back) on a transport failure', async () => {
    const boom = (async () => { throw new Error('network down'); }) as unknown as typeof fetch;
    const r = await resolveUtterance('hola', 'global', { apiKeyOverride: 'k', fetchImpl: boom });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('error');
  });
});
