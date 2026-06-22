/**
 * Voice config -- how Yuemail hears and speaks (v0.6.0). Mirrors the Brain
 * config shape (server-side, single-user, honours YUEMAIL_HOME).
 *
 * Storage:
 *   ~/.yuemail/voice.json
 *
 * Camino 1 (default): Google Cloud for both hearing (STT) and speaking
 * (TTS) -- the more accurate ear and the more natural voice for an audience
 * that depends on them. The browser's Web Speech API stays as camino 2, the
 * safety net the CLIENT falls back to when 'enabled' is false, no key is
 * stored, or a Google round-trip fails. A person who depends on this app is
 * never left without it.
 *
 * ASCII-only.
 */
import { promises as fs, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { TtsAudioFormat } from './types.js';

export interface VoiceConfig {
  version: 1;
  /** Camino 1 master switch. Default true (Google leads). When false the
   *  client uses the browser for both directions. */
  enabled: boolean;
  /** BCP-47 the client captures + Google transcribes in. Default es-AR. */
  language: string;
  /** Explicit Google TTS voice name; '' means derive from `language`. */
  voice: string;
  /** Speaking rate, 0.25..4.0. */
  speed: number;
  /** Synthesis container the server returns. */
  format: TtsAudioFormat;
}

export function defaultVoiceConfig(): VoiceConfig {
  return {
    version: 1,
    enabled: true,
    language: 'es-AR',
    voice: '',
    speed: 1.0,
    format: 'mp3',
  };
}

function homeDir(): string {
  const env = process.env['YUEMAIL_HOME'];
  return env ? path.resolve(env) : path.join(os.homedir(), '.yuemail');
}
function voiceConfigPath(): string { return path.join(homeDir(), 'voice.json'); }

function ensureHomeDir(): void {
  if (!existsSync(homeDir())) mkdirSync(homeDir(), { recursive: true, mode: 0o700 });
}

function clampSpeed(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return fallback;
  if (v < 0.25) return 0.25;
  if (v > 4.0) return 4.0;
  return v;
}

function normaliseFormat(v: unknown, fallback: TtsAudioFormat): TtsAudioFormat {
  return v === 'mp3' || v === 'wav' || v === 'ogg' ? v : fallback;
}

export async function readVoiceConfig(): Promise<VoiceConfig> {
  const def = defaultVoiceConfig();
  try {
    const raw = await fs.readFile(voiceConfigPath(), 'utf-8');
    const j = JSON.parse(raw) as Partial<VoiceConfig>;
    return {
      version: 1,
      enabled: j.enabled !== false,
      language: typeof j.language === 'string' && j.language.trim() !== '' ? j.language.trim() : def.language,
      voice: typeof j.voice === 'string' ? j.voice.trim() : def.voice,
      speed: clampSpeed(j.speed, def.speed),
      format: normaliseFormat(j.format, def.format),
    };
  } catch {
    return def;
  }
}

export async function writeVoiceConfig(cfg: VoiceConfig): Promise<void> {
  ensureHomeDir();
  const p = voiceConfigPath();
  const tmp = p + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  await fs.rename(tmp, p);
}

export async function patchVoiceConfig(patch: Partial<VoiceConfig>): Promise<VoiceConfig> {
  const cur = await readVoiceConfig();
  const next: VoiceConfig = {
    version: 1,
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : cur.enabled,
    language: typeof patch.language === 'string' && patch.language.trim() !== '' ? patch.language.trim() : cur.language,
    voice: typeof patch.voice === 'string' ? patch.voice.trim() : cur.voice,
    speed: patch.speed === undefined ? cur.speed : clampSpeed(patch.speed, cur.speed),
    format: patch.format === undefined ? cur.format : normaliseFormat(patch.format, cur.format),
  };
  await writeVoiceConfig(next);
  return next;
}
