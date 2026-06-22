/**
 * Voice subsystem types (v0.6.0 -- camino 1 for hearing + speaking).
 *
 * Ported from the Yujin-Forge voice subsystem (src/voice) and trimmed to
 * Yuemail's single-user, server-side, BYOK shape. Google Cloud is camino 1
 * for both directions; the browser (Web Speech API) stays as camino 2, the
 * safety net resolved on the client when the server path is unavailable.
 *
 *   STT (hearing): browser-captured audio bytes -> Google Speech-to-Text.
 *   TTS (speaking): Yuemail text -> Google Text-to-Speech audio bytes.
 *
 * The Google API key lives in the SAME encrypted vault as the mail
 * credentials (slot 'speech.google'); it never reaches the browser.
 *
 * ASCII-only.
 */

/** Audio container the client may hand us for transcription. The browser
 *  MediaRecorder typically yields 'webm' (Opus); the test harness feeds
 *  'mp3'/'wav'/'ogg' synthesised by the TTS side. */
export type SttAudioFormat = 'webm' | 'ogg' | 'wav' | 'mp3' | 'flac';

/** Audio container we ask Google to synthesise speech into. */
export type TtsAudioFormat = 'mp3' | 'wav' | 'ogg';

export interface SttRequest {
  audio: Buffer;
  format: SttAudioFormat;
  /** BCP-47 hint, e.g. 'es-AR'. Spanish regional variants are normalised
   *  to a Google-certified enhanced locale by the provider. */
  languageHint?: string;
}

export interface SttResult {
  text: string;
  language?: string;
  confidence?: number;
  latency_ms: number;
  provider: 'google';
  model?: string;
}

export interface TtsRequest {
  text: string;
  /** BCP-47, e.g. 'es-AR'. Maps to a Neural2 voice for the locale. */
  language?: string;
  /** Explicit Google voice name; overrides the locale mapping. */
  voice?: string;
  /** 0.25..4.0; clamped by the provider. */
  speed?: number;
  format?: TtsAudioFormat;
}

export interface TtsResult {
  audio: Buffer;
  format: TtsAudioFormat;
  voice: string;
  latency_ms: number;
  provider: 'google';
}
