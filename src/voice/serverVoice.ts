/**
 * Client-side transport to the server voice pipe (v0.6.0 -- camino 1).
 *
 * The browser never sees the Google key: it talks to Yuemail's own server
 * (/api/voice/*), which holds the key in the vault and talks to Google. This
 * module is the thin client half:
 *
 *   serverSpeak(text)        -> POST /api/voice/tts -> audio Blob (or a miss)
 *   serverTranscribe(audio)  -> POST /api/voice/stt -> transcript (or a miss)
 *   voiceReady()             -> is camino 1 enabled AND keyed?
 *
 * Every function returns a discriminated result instead of throwing: a miss
 * ({ ok:false, reason }) is the signal the caller uses to fall back to the
 * browser's Web Speech API (camino 2). A person who depends on this app is
 * never left without it.
 *
 * ASCII-only.
 */

export type VoiceMiss = 'disabled' | 'no_key' | 'error' | 'bad_format' | 'empty';

export type SpeakResult =
  | { ok: true; audio: Blob; provider: string; voice: string; latencyMs: number }
  | { ok: false; reason: VoiceMiss; detail?: string };

export type TranscribeResult =
  | { ok: true; text: string; confidence?: number; language?: string }
  | { ok: false; reason: VoiceMiss; detail?: string };

export interface VoiceConfigPublic {
  enabled: boolean;
  language: string;
  voice: string;
  speed: number;
  format: 'mp3' | 'wav' | 'ogg';
}
export interface VoiceConfigResponse {
  ok: true;
  config: VoiceConfigPublic;
  has_key: boolean;
}

/** A miss reason coming back from the server in a JSON body. Map anything we
 *  do not recognise to 'error' so the caller always falls back. */
function asMiss(reason: unknown): VoiceMiss {
  return reason === 'disabled' || reason === 'no_key' || reason === 'bad_format' || reason === 'empty'
    ? reason
    : 'error';
}

export async function getVoiceConfig(): Promise<VoiceConfigResponse> {
  const res = await fetch('/api/voice/config');
  return (await res.json()) as VoiceConfigResponse;
}

export async function setVoiceConfig(patch: Partial<VoiceConfigPublic>): Promise<VoiceConfigResponse> {
  const res = await fetch('/api/voice/config', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return (await res.json()) as VoiceConfigResponse;
}

/** True when camino 1 is enabled AND a Google voice key is stored. Used to
 *  decide, before touching the mic, whether the server path is even worth
 *  trying. Never throws -- a failure reads as "not ready" so we use the
 *  browser. */
export async function voiceReady(): Promise<boolean> {
  try {
    const c = await getVoiceConfig();
    return c.ok === true && c.config.enabled === true && c.has_key === true;
  } catch {
    return false;
  }
}

/**
 * Speak via Google (camino 1). Returns the synthesised audio as a Blob the
 * caller plays, or a miss so the caller uses speechSynthesis instead.
 */
export async function serverSpeak(
  text: string,
  opts: { language?: string; voice?: string; speed?: number } = {},
): Promise<SpeakResult> {
  const clean = (text ?? '').trim();
  if (clean.length === 0) return { ok: false, reason: 'empty' };
  try {
    const res = await fetch('/api/voice/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: clean,
        language: opts.language,
        voice: opts.voice,
        speed: opts.speed,
      }),
    });
    const ctype = res.headers.get('content-type') ?? '';
    if (ctype.startsWith('audio/')) {
      const audio = await res.blob();
      if (audio.size === 0) return { ok: false, reason: 'error', detail: 'empty audio' };
      return {
        ok: true,
        audio,
        provider: res.headers.get('x-voice-provider') ?? 'google',
        voice: res.headers.get('x-voice-voice') ?? '',
        latencyMs: Number(res.headers.get('x-voice-latency-ms') ?? '0'),
      };
    }
    /* JSON body == a miss the server is telling us to fall back on. */
    const body = (await res.json()) as { reason?: string; detail?: string };
    return { ok: false, reason: asMiss(body.reason), detail: body.detail };
  } catch (err) {
    return { ok: false, reason: 'error', detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Transcribe one captured utterance via Google (camino 1). `audio` is the raw
 * recording; `format` is its container ('webm' for MediaRecorder/Opus). On a
 * miss the caller falls back to the browser transcript.
 */
export async function serverTranscribe(
  audio: Blob,
  format: 'webm' | 'ogg' | 'wav' | 'mp3' | 'flac',
  language?: string,
): Promise<TranscribeResult> {
  if (!audio || audio.size === 0) return { ok: false, reason: 'empty' };
  try {
    const res = await fetch('/api/voice/stt', {
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        'x-audio-format': format,
        ...(language ? { 'x-audio-language': language } : {}),
      },
      body: audio,
    });
    const body = (await res.json()) as
      | { ok: true; transcript: { text: string; confidence?: number; language?: string } }
      | { ok: false; reason?: string; detail?: string };
    if (body.ok === true) {
      return {
        ok: true,
        text: body.transcript.text,
        confidence: body.transcript.confidence,
        language: body.transcript.language,
      };
    }
    return { ok: false, reason: asMiss(body.reason), detail: body.detail };
  } catch (err) {
    return { ok: false, reason: 'error', detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Play a synthesised audio Blob and resolve when it finishes (or fails). Kept
 * here so both the hook and the settings "probar voz" button share one
 * player. Resolves false if playback could not start, so the caller can fall
 * back to speechSynthesis.
 */
export async function playAudioBlob(audio: Blob): Promise<boolean> {
  if (typeof window === 'undefined' || typeof window.Audio === 'undefined') return false;
  const url = URL.createObjectURL(audio);
  try {
    const el = new Audio(url);
    await new Promise<void>((resolve, reject) => {
      el.onended = () => resolve();
      el.onerror = () => reject(new Error('audio playback failed'));
      void el.play().catch(reject);
    });
    return true;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}
