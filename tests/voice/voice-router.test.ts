/**
 * Unit tests for the server voice router (server/voice/router.ts) and the
 * Google provider, with an injected fetch -- no network, no real Google key.
 *
 * Covers the camino-1 contract the HTTP routes depend on:
 *   - no key -> { ok:false, reason:'no_key' } so the client falls back.
 *   - happy path -> { ok:true, result } with the parsed audio/transcript.
 *   - a non-2xx from Google -> { ok:false, reason:'error' }, never a throw.
 *
 * ASCII-only.
 */
import { describe, it, expect } from 'vitest';
import { transcribe, synthesize } from '../../server/voice/router.js';

function okJsonFetch(json: unknown): typeof fetch {
  return (async () => ({ ok: true, status: 200, json: async () => json })) as unknown as typeof fetch;
}
function errFetch(status: number, text: string): typeof fetch {
  return (async () => ({ ok: false, status, text: async () => text })) as unknown as typeof fetch;
}

describe('voice router -- transcribe', () => {
  it('declines with no_key when no key is available', async () => {
    const r = await transcribe(
      { audio: Buffer.from('abc'), format: 'webm', languageHint: 'es-AR' },
      { apiKeyOverride: '' },
    );
    expect(r).toEqual(expect.objectContaining({ ok: false, reason: 'no_key' }));
  });

  it('returns the transcript on a Google 200', async () => {
    const fetchImpl = okJsonFetch({
      results: [{ alternatives: [{ transcript: 'leer bandeja', confidence: 0.92 }], languageCode: 'es-US' }],
    });
    const r = await transcribe(
      { audio: Buffer.from('abc'), format: 'webm', languageHint: 'es-AR' },
      { apiKeyOverride: 'k', fetchImpl },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.text).toBe('leer bandeja');
      expect(r.result.provider).toBe('google');
    }
  });

  it('a Google non-2xx becomes a graceful error miss', async () => {
    const r = await transcribe(
      { audio: Buffer.from('abc'), format: 'webm' },
      { apiKeyOverride: 'k', fetchImpl: errFetch(403, 'denied') },
    );
    expect(r).toEqual(expect.objectContaining({ ok: false, reason: 'error' }));
  });
});

describe('voice router -- synthesize', () => {
  it('declines with no_key when no key is available', async () => {
    const r = await synthesize({ text: 'hola' }, { apiKeyOverride: '' });
    expect(r).toEqual(expect.objectContaining({ ok: false, reason: 'no_key' }));
  });

  it('returns audio bytes on a Google 200', async () => {
    const audioB64 = Buffer.from('fake-audio').toString('base64');
    const r = await synthesize(
      { text: 'hola', language: 'es-AR', format: 'mp3' },
      { apiKeyOverride: 'k', fetchImpl: okJsonFetch({ audioContent: audioB64 }) },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.audio.length).toBeGreaterThan(0);
      expect(r.result.format).toBe('mp3');
      expect(r.result.provider).toBe('google');
    }
  });

  it('a Google non-2xx becomes a graceful error miss', async () => {
    const r = await synthesize(
      { text: 'hola' },
      { apiKeyOverride: 'k', fetchImpl: errFetch(500, 'boom') },
    );
    expect(r).toEqual(expect.objectContaining({ ok: false, reason: 'error' }));
  });
});
