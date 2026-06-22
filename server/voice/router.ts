/**
 * Voice router -- the single server-side surface the HTTP routes call to
 * hear and speak (v0.6.0). It reads the voice config, and when camino 1 is
 * enabled and reachable, delegates to the Google provider. On a clean miss
 * (disabled / no key) or a hard failure (transport, timeout, empty result)
 * it returns a structured miss so the CLIENT falls back to the browser.
 *
 * The router never throws for an expected miss: the caller turns a miss into
 * a 'use the browser' signal, never a 500.
 *
 * ASCII-only.
 */
import { readVoiceConfig } from './config.js';
import { googleTranscribe, googleSynthesize, googleVoiceReady } from './google.js';
import type { SttRequest, SttResult, TtsRequest, TtsResult } from './types.js';

export type VoiceMissReason = 'disabled' | 'no_key' | 'error';

export type SttOutcome =
  | { ok: true; result: SttResult }
  | { ok: false; reason: VoiceMissReason; detail?: string };

export type TtsOutcome =
  | { ok: true; result: TtsResult }
  | { ok: false; reason: VoiceMissReason; detail?: string };

export interface RouterOpts {
  fetchImpl?: typeof fetch;
  apiKeyOverride?: string | null;
}

export async function transcribe(req: SttRequest, opts: RouterOpts = {}): Promise<SttOutcome> {
  const cfg = await readVoiceConfig();
  if (!cfg.enabled) return { ok: false, reason: 'disabled' };
  if (!(await googleVoiceReady(opts.apiKeyOverride))) return { ok: false, reason: 'no_key' };
  try {
    const result = await googleTranscribe(
      { ...req, languageHint: req.languageHint ?? cfg.language },
      { fetchImpl: opts.fetchImpl, apiKeyOverride: opts.apiKeyOverride },
    );
    return { ok: true, result };
  } catch (err) {
    const detail = err instanceof Error ? err.message.slice(0, 160) : String(err);
    if (detail === 'no_key') return { ok: false, reason: 'no_key' };
    return { ok: false, reason: 'error', detail };
  }
}

export async function synthesize(req: TtsRequest, opts: RouterOpts = {}): Promise<TtsOutcome> {
  const cfg = await readVoiceConfig();
  if (!cfg.enabled) return { ok: false, reason: 'disabled' };
  if (!(await googleVoiceReady(opts.apiKeyOverride))) return { ok: false, reason: 'no_key' };
  try {
    const result = await googleSynthesize(
      {
        text: req.text,
        language: req.language ?? cfg.language,
        voice: req.voice ?? (cfg.voice || undefined),
        speed: req.speed ?? cfg.speed,
        format: req.format ?? cfg.format,
      },
      { fetchImpl: opts.fetchImpl, apiKeyOverride: opts.apiKeyOverride },
    );
    return { ok: true, result };
  } catch (err) {
    const detail = err instanceof Error ? err.message.slice(0, 160) : String(err);
    if (detail === 'no_key') return { ok: false, reason: 'no_key' };
    return { ok: false, reason: 'error', detail };
  }
}
