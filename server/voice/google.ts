/**
 * Google Cloud voice provider -- Speech-to-Text (hearing) + Text-to-Speech
 * (speaking). Raw fetch, no SDK (the Forge lesson: SDKs blow the bundle
 * budget). The API key travels in the 'x-goog-api-key' header, never a
 * query string, and is never logged.
 *
 * Ported from c:/yujin-forge/src/voice/providers/google.ts and adapted to
 * read the key from Yuemail's vault (slot 'speech.google') and to use the
 * camino-1 raw-fetch style of server/brain/providers.ts.
 *
 * ASCII-only.
 */
import { getKey } from '../vault.js';
import type {
  SttRequest, SttResult, TtsRequest, TtsResult, SttAudioFormat, TtsAudioFormat,
} from './types.js';

/** The single vault slot the Google voice key lives under. The same key
 *  powers both Cloud Speech-to-Text and Cloud Text-to-Speech. */
export const SPEECH_VAULT_SLOT = 'speech.google';

const STT_ENDPOINT = 'https://speech.googleapis.com/v1/speech:recognize';
const TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

/** Container -> Google STT encoding enum. */
function sttEncoding(format: SttAudioFormat): string {
  switch (format) {
    case 'webm': return 'WEBM_OPUS';
    case 'ogg':  return 'OGG_OPUS';
    case 'wav':  return 'LINEAR16';
    case 'mp3':  return 'MP3';
    case 'flac': return 'FLAC';
  }
}

/** Container -> Google TTS audioEncoding enum. */
function ttsEncoding(format: TtsAudioFormat): string {
  switch (format) {
    case 'mp3': return 'MP3';
    case 'wav': return 'LINEAR16';
    case 'ogg': return 'OGG_OPUS';
  }
}

/**
 * Google's enhanced Spanish STT models are certified for es-US / es-ES /
 * es-419 only. Map the regional variants Yuemail uses (es-AR is the client
 * default) onto es-US so the request always lands on an enhanced model that
 * handles accent + aspirated-s. Non-Spanish locales pass through unchanged.
 */
function normaliseSpanishLocale(bcp47: string | undefined): string {
  const lc = (bcp47 ?? 'es-US').trim();
  if (/^es(-|$)/i.test(lc)) return 'es-US';
  return lc;
}

/* Locale -> a concrete Neural2 voice. Strip the region as a fallback so an
 * unmapped es-XX still gets the Spanish voice. */
const LOCALE_TO_VOICE: Record<string, string> = {
  es:      'es-US-Neural2-A',
  'es-us': 'es-US-Neural2-A',
  'es-ar': 'es-US-Neural2-A',
  'es-mx': 'es-US-Neural2-A',
  'es-es': 'es-ES-Neural2-A',
  en:      'en-US-Neural2-C',
  'en-us': 'en-US-Neural2-C',
  'en-gb': 'en-GB-Neural2-A',
  'pt-br': 'pt-BR-Neural2-A',
  'fr-fr': 'fr-FR-Neural2-A',
  'it-it': 'it-IT-Neural2-A',
  'de-de': 'de-DE-Neural2-B',
};

function voiceForLocale(bcp47: string | undefined): string {
  const lc = (bcp47 ?? 'es-US').toLowerCase().trim();
  if (LOCALE_TO_VOICE[lc]) return LOCALE_TO_VOICE[lc];
  const lang = lc.split('-')[0];
  if (lang && LOCALE_TO_VOICE[lang]) return LOCALE_TO_VOICE[lang];
  return 'es-US-Neural2-A';
}

/** A Google voice name embeds its own languageCode (the first two segments,
 *  e.g. 'es-US-Neural2-A' -> 'es-US'). Google rejects a synth request when
 *  the voice's language disagrees with the supplied languageCode, so the
 *  voice's own language always wins. */
function languageFromVoice(voice: string): string {
  const parts = voice.split('-');
  return parts.length >= 2 ? parts[0] + '-' + parts[1] : 'es-US';
}

function clampSpeed(v: number | undefined): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return 1.0;
  if (v < 0.25) return 0.25;
  if (v > 4.0) return 4.0;
  return v;
}

async function readSpeechKey(apiKeyOverride?: string | null): Promise<string | null> {
  if (apiKeyOverride !== undefined) return apiKeyOverride;
  try {
    return (await getKey(SPEECH_VAULT_SLOT)) ?? null;
  } catch {
    return null;
  }
}

export interface ProviderOpts {
  fetchImpl?: typeof fetch;
  apiKeyOverride?: string | null;
  timeoutMs?: number;
}

async function withTimeout<T>(timeoutMs: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(t);
  }
}

/** True when the Google voice key is present, so the router can decide
 *  whether camino 1 is even reachable before attempting a round-trip. */
export async function googleVoiceReady(apiKeyOverride?: string | null): Promise<boolean> {
  const key = await readSpeechKey(apiKeyOverride);
  return typeof key === 'string' && key.length > 0;
}

/**
 * Transcribe audio with Google Cloud Speech-to-Text. Throws on missing key,
 * transport error, non-2xx, or empty result so the caller can fall back.
 */
export async function googleTranscribe(req: SttRequest, opts: ProviderOpts = {}): Promise<SttResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const key = await readSpeechKey(opts.apiKeyOverride);
  if (!key) throw new Error('no_key');

  const languageCode = normaliseSpanishLocale(req.languageHint);
  const isSpanish = /^es-/i.test(languageCode);
  const body = {
    config: {
      encoding: sttEncoding(req.format),
      languageCode,
      enableAutomaticPunctuation: true,
      /* Spanish gets the long enhanced model: better with accent + the
       * slower, less articulated speech this audience often produces. */
      ...(isSpanish ? { model: 'latest_long', useEnhanced: true } : {}),
    },
    audio: { content: req.audio.toString('base64') },
  };

  const started = Date.now();
  const j = await withTimeout(opts.timeoutMs ?? 15000, async (signal) => {
    const r = await fetchImpl(STT_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal,
    });
    if (!r.ok) {
      let detail = '';
      try { detail = (await r.text()).slice(0, 160).replace(/\s+/g, ' '); } catch { /* ignore */ }
      throw new Error('stt http ' + r.status + (detail ? ' ' + detail : ''));
    }
    return await r.json() as {
      results?: Array<{
        alternatives?: Array<{ transcript?: string; confidence?: number }>;
        languageCode?: string;
      }>;
    };
  });

  const top = j.results?.[0]?.alternatives?.[0];
  const text = (top?.transcript ?? '').trim();
  if (!text) throw new Error('empty_transcript');
  const result: SttResult = {
    text,
    latency_ms: Date.now() - started,
    provider: 'google',
    model: isSpanish ? 'latest_long' : undefined,
  };
  if (typeof top?.confidence === 'number') result.confidence = top.confidence;
  if (j.results?.[0]?.languageCode) result.language = j.results[0].languageCode;
  return result;
}

/**
 * Synthesise speech with Google Cloud Text-to-Speech. Throws on missing key,
 * transport error, non-2xx, or empty audio so the caller can fall back to
 * the browser's speechSynthesis.
 */
export async function googleSynthesize(req: TtsRequest, opts: ProviderOpts = {}): Promise<TtsResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const key = await readSpeechKey(opts.apiKeyOverride);
  if (!key) throw new Error('no_key');

  const text = (req.text ?? '').trim();
  if (!text) throw new Error('empty_text');

  const voice = req.voice && req.voice.trim().length > 0 ? req.voice.trim() : voiceForLocale(req.language);
  const languageCode = languageFromVoice(voice);
  const format: TtsAudioFormat = req.format ?? 'mp3';
  const body = {
    input: { text },
    voice: { languageCode, name: voice },
    audioConfig: { audioEncoding: ttsEncoding(format), speakingRate: clampSpeed(req.speed) },
  };

  const started = Date.now();
  const j = await withTimeout(opts.timeoutMs ?? 15000, async (signal) => {
    const r = await fetchImpl(TTS_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal,
    });
    if (!r.ok) {
      let detail = '';
      try { detail = (await r.text()).slice(0, 160).replace(/\s+/g, ' '); } catch { /* ignore */ }
      throw new Error('tts http ' + r.status + (detail ? ' ' + detail : ''));
    }
    return await r.json() as { audioContent?: string };
  });

  const b64 = j.audioContent ?? '';
  if (!b64) throw new Error('empty_audio');
  return {
    audio: Buffer.from(b64, 'base64'),
    format,
    voice,
    latency_ms: Date.now() - started,
    provider: 'google',
  };
}
