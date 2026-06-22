/**
 * Unit tests for the client voice transport (src/voice/serverVoice.ts).
 *
 * fetch is stubbed -- no network, no Google. We assert the contract the hook
 * relies on: an audio response becomes { ok:true, audio }, a JSON body becomes
 * a typed miss the caller falls back on, and every failure path yields a miss
 * rather than a throw.
 *
 * ASCII-only.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  serverSpeak, serverTranscribe, voiceReady, getVoiceConfig,
} from '../../src/voice/serverVoice.js';

interface FakeResInit {
  contentType?: string;
  blob?: Blob;
  json?: unknown;
  throws?: boolean;
}

function fakeFetch(init: FakeResInit): typeof fetch {
  return (async () => {
    if (init.throws) throw new Error('network down');
    const headers = new Map<string, string>();
    if (init.contentType) headers.set('content-type', init.contentType);
    headers.set('x-voice-provider', 'google');
    headers.set('x-voice-voice', 'es-US-Neural2-A');
    headers.set('x-voice-latency-ms', '123');
    return {
      headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
      blob: async () => init.blob ?? new Blob([]),
      json: async () => init.json ?? {},
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

afterEach(() => { vi.restoreAllMocks(); });

describe('serverSpeak', () => {
  it('returns the audio blob when the server answers with audio/*', async () => {
    vi.stubGlobal('fetch', fakeFetch({ contentType: 'audio/mpeg', blob: new Blob(['xxxx']) }));
    const r = await serverSpeak('hola');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.audio.size).toBeGreaterThan(0);
      expect(r.provider).toBe('google');
      expect(r.voice).toBe('es-US-Neural2-A');
      expect(r.latencyMs).toBe(123);
    }
  });

  it('returns a typed miss when the server answers JSON (fall back to browser)', async () => {
    vi.stubGlobal('fetch', fakeFetch({ contentType: 'application/json', json: { ok: false, reason: 'no_key' } }));
    const r = await serverSpeak('hola');
    expect(r).toEqual(expect.objectContaining({ ok: false, reason: 'no_key' }));
  });

  it('maps an unknown reason to "error" so the caller still falls back', async () => {
    vi.stubGlobal('fetch', fakeFetch({ contentType: 'application/json', json: { ok: false, reason: 'wat' } }));
    const r = await serverSpeak('hola');
    expect(r).toEqual(expect.objectContaining({ ok: false, reason: 'error' }));
  });

  it('empty text is a miss without hitting the network', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    const r = await serverSpeak('   ');
    expect(r).toEqual({ ok: false, reason: 'empty' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('a transport throw becomes a miss, never a throw', async () => {
    vi.stubGlobal('fetch', fakeFetch({ throws: true }));
    const r = await serverSpeak('hola');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('error');
  });
});

describe('serverTranscribe', () => {
  it('returns the transcript on ok', async () => {
    vi.stubGlobal('fetch', fakeFetch({ json: { ok: true, transcript: { text: 'leer bandeja', confidence: 0.9, language: 'es-US' } } }));
    const r = await serverTranscribe(new Blob(['audio']), 'webm', 'es-AR');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toBe('leer bandeja');
      expect(r.confidence).toBe(0.9);
    }
  });

  it('returns a typed miss when the server declines', async () => {
    vi.stubGlobal('fetch', fakeFetch({ json: { ok: false, reason: 'disabled' } }));
    const r = await serverTranscribe(new Blob(['audio']), 'webm');
    expect(r).toEqual(expect.objectContaining({ ok: false, reason: 'disabled' }));
  });

  it('empty audio is a miss without hitting the network', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    const r = await serverTranscribe(new Blob([]), 'webm');
    expect(r).toEqual({ ok: false, reason: 'empty' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('a transport throw becomes a miss', async () => {
    vi.stubGlobal('fetch', fakeFetch({ throws: true }));
    const r = await serverTranscribe(new Blob(['audio']), 'webm');
    expect(r.ok).toBe(false);
  });
});

describe('voiceReady / getVoiceConfig', () => {
  it('true only when enabled AND keyed', async () => {
    vi.stubGlobal('fetch', fakeFetch({ json: { ok: true, config: { enabled: true, language: 'es-AR', voice: '', speed: 1, format: 'mp3' }, has_key: true } }));
    expect(await voiceReady()).toBe(true);
  });

  it('false when enabled but no key', async () => {
    vi.stubGlobal('fetch', fakeFetch({ json: { ok: true, config: { enabled: true, language: 'es-AR', voice: '', speed: 1, format: 'mp3' }, has_key: false } }));
    expect(await voiceReady()).toBe(false);
  });

  it('false when keyed but disabled', async () => {
    vi.stubGlobal('fetch', fakeFetch({ json: { ok: true, config: { enabled: false, language: 'es-AR', voice: '', speed: 1, format: 'mp3' }, has_key: true } }));
    expect(await voiceReady()).toBe(false);
  });

  it('false (never throws) when the config call fails', async () => {
    vi.stubGlobal('fetch', fakeFetch({ throws: true }));
    expect(await voiceReady()).toBe(false);
  });

  it('getVoiceConfig surfaces the public shape', async () => {
    vi.stubGlobal('fetch', fakeFetch({ json: { ok: true, config: { enabled: true, language: 'es-MX', voice: 'x', speed: 1.2, format: 'mp3' }, has_key: true } }));
    const c = await getVoiceConfig();
    expect(c.config.language).toBe('es-MX');
    expect(c.has_key).toBe(true);
  });
});
