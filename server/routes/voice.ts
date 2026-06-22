/**
 * /api/voice/* routes (v0.6.0 -- camino 1 for hearing + speaking).
 *
 *  GET  /api/voice/config  -> { config, has_key }
 *  PUT  /api/voice/config  -> body partial -> { config, has_key }
 *  POST /api/voice/stt     -> raw audio bytes (header X-Audio-Format) ->
 *                             { ok:true, transcript } | { ok:false, reason }
 *  POST /api/voice/tts     -> body { text, ... } -> binary audio
 *                             | { ok:false, reason } when camino 1 unavailable
 *
 * A { ok:false, reason } body (HTTP 200) is NOT an error: it tells the
 * client to fall back to the browser's Web Speech API. has_key is a boolean
 * only -- the decrypted Google key never leaves the server.
 *
 * ASCII-only.
 */
import express, { type Express, type Request, type Response } from 'express';
import {
  readVoiceConfig, patchVoiceConfig, type VoiceConfig,
} from '../voice/config.js';
import { transcribe, synthesize } from '../voice/router.js';
import { googleVoiceReady, SPEECH_VAULT_SLOT } from '../voice/google.js';
import { getKey } from '../vault.js';
import type { SttAudioFormat, TtsAudioFormat } from '../voice/types.js';

const STT_MAX_BYTES = 25 * 1024 * 1024;
const SUPPORTED_STT: ReadonlySet<string> = new Set(['webm', 'ogg', 'wav', 'mp3', 'flac']);
const TTS_MIME: Record<TtsAudioFormat, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
};

async function hasSpeechKey(): Promise<boolean> {
  try {
    const k = await getKey(SPEECH_VAULT_SLOT);
    return typeof k === 'string' && k.length > 0;
  } catch {
    return false;
  }
}

function publicConfig(cfg: VoiceConfig): Record<string, unknown> {
  return {
    enabled: cfg.enabled,
    language: cfg.language,
    voice: cfg.voice,
    speed: cfg.speed,
    format: cfg.format,
  };
}

export function registerVoiceRoutes(app: Express): void {
  app.get('/api/voice/config', async (_req: Request, res: Response) => {
    const cfg = await readVoiceConfig();
    res.json({ ok: true, config: publicConfig(cfg), has_key: await hasSpeechKey() });
  });

  app.put('/api/voice/config', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: Partial<VoiceConfig> = {};
    if (typeof body['enabled'] === 'boolean') patch.enabled = body['enabled'];
    if (typeof body['language'] === 'string') patch.language = body['language'];
    if (typeof body['voice'] === 'string') patch.voice = body['voice'];
    if (typeof body['speed'] === 'number') patch.speed = body['speed'];
    if (body['format'] === 'mp3' || body['format'] === 'wav' || body['format'] === 'ogg') {
      patch.format = body['format'];
    }
    const cfg = await patchVoiceConfig(patch);
    res.json({ ok: true, config: publicConfig(cfg), has_key: await hasSpeechKey() });
  });

  /* Hearing. Raw audio in the body; the container is declared in the
   * X-Audio-Format header (the browser sends 'webm'; the test harness
   * sends the format it synthesised). */
  app.post(
    '/api/voice/stt',
    express.raw({ type: '*/*', limit: STT_MAX_BYTES }),
    async (req: Request, res: Response) => {
      const fmt = String(req.header('x-audio-format') ?? '').toLowerCase().trim();
      if (!SUPPORTED_STT.has(fmt)) {
        res.status(400).json({ ok: false, reason: 'bad_format', detail: fmt || '(none)' });
        return;
      }
      const audio = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (audio.length === 0) {
        res.status(400).json({ ok: false, reason: 'empty_audio' });
        return;
      }
      const langHeader = String(req.header('x-audio-language') ?? '').trim();
      const outcome = await transcribe({
        audio,
        format: fmt as SttAudioFormat,
        languageHint: langHeader || undefined,
      });
      if (!outcome.ok) {
        res.json({ ok: false, reason: outcome.reason, detail: outcome.detail });
        return;
      }
      res.json({ ok: true, transcript: outcome.result });
    },
  );

  /* Speaking. JSON in, binary audio out. A miss returns JSON so the client
   * knows to use the browser voice instead. */
  app.post('/api/voice/tts', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const text = typeof body['text'] === 'string' ? body['text'] : '';
    if (text.trim().length === 0) {
      res.status(400).json({ ok: false, reason: 'empty_text' });
      return;
    }
    const outcome = await synthesize({
      text,
      language: typeof body['language'] === 'string' ? body['language'] : undefined,
      voice: typeof body['voice'] === 'string' ? body['voice'] : undefined,
      speed: typeof body['speed'] === 'number' ? body['speed'] : undefined,
      format: body['format'] === 'mp3' || body['format'] === 'wav' || body['format'] === 'ogg'
        ? body['format'] : undefined,
    });
    if (!outcome.ok) {
      res.json({ ok: false, reason: outcome.reason, detail: outcome.detail });
      return;
    }
    res.setHeader('content-type', TTS_MIME[outcome.result.format]);
    res.setHeader('x-voice-provider', outcome.result.provider);
    res.setHeader('x-voice-voice', outcome.result.voice);
    res.setHeader('x-voice-latency-ms', String(outcome.result.latency_ms));
    res.send(outcome.result.audio);
  });
}

/** Tiny helper so unit tests can read whether camino 1 is reachable without
 *  a real round-trip. */
export { googleVoiceReady };
