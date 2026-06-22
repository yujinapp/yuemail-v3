/**
 * Brain config -- which provider + model resolves a spoken request into a
 * Yuemail command (v0.5.0). Replicates the Yujin-Forge brain_config pattern
 * (single config, every provider, one default model) trimmed to Yuemail's
 * single-user, server-side, BYOK shape.
 *
 * Storage:
 *   ~/.yuemail/brain.json   (honours YUEMAIL_HOME like the vault).
 *
 * The provider API keys themselves live in the SAME encrypted vault as the
 * mail credentials (slot 'brain.<provider>'), so a key never reaches the
 * browser: the router runs in this process and reads the vault directly.
 *
 * Camino 1 (default): the Brain resolves every utterance. The fixed-phrase
 * matcher stays as camino 2 (safety net) when the Brain is disabled, has no
 * key, the network is down, or it answers below min_confidence -- a person
 * who depends on this app must never be left without it.
 *
 * ASCII-only.
 */
import { promises as fs, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/** Provider ids. Key slot in the vault is 'brain.<provider>'. The first
 *  group has a wired client; the OpenAI-compatible group shares one client
 *  (different base URL). 'ollama' is local + keyless. */
export type BrainProvider =
  | 'google_ai'
  | 'anthropic'
  | 'openai'
  | 'deepseek'
  | 'xai'
  | 'mistral'
  | 'qwen'
  | 'zai'
  | 'ollama';

export const ALL_BRAIN_PROVIDERS: readonly BrainProvider[] = [
  'google_ai', 'anthropic', 'openai', 'deepseek', 'xai', 'mistral', 'qwen', 'zai', 'ollama',
];

/** Vault slot a provider stores its key under. Ollama is local + keyless;
 *  the slot exists only for an exhaustive map and getKey() returns nothing. */
export function vaultSlotForProvider(p: BrainProvider): string {
  return 'brain.' + p;
}

export interface BrainConfig {
  version: 1;
  /** Camino 1 master switch. Default true (Brain leads). */
  enabled: boolean;
  provider: BrainProvider;
  model: string;
  /** Below this the router result is discarded and the caller falls back
   *  to the phrase matcher. 0..1. */
  min_confidence: number;
  /** Hard timeout for one provider round-trip (ms). On timeout -> fallback. */
  timeout_ms: number;
}

/* The user asked for Gemini Flash Lite as the default brain. The exact id
 * resolves against the provider's live model list once a key is present
 * (see provider_models). If this id 404s the router fails closed and the
 * phrase matcher takes over -- the app keeps working either way. */
export const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

export function defaultBrainConfig(): BrainConfig {
  return {
    version: 1,
    enabled: true,
    provider: 'google_ai',
    model: DEFAULT_MODEL,
    min_confidence: 0.5,
    timeout_ms: 4000,
  };
}

function homeDir(): string {
  const env = process.env['YUEMAIL_HOME'];
  return env ? path.resolve(env) : path.join(os.homedir(), '.yuemail');
}
function brainConfigPath(): string { return path.join(homeDir(), 'brain.json'); }

function ensureHomeDir(): void {
  if (!existsSync(homeDir())) mkdirSync(homeDir(), { recursive: true, mode: 0o700 });
}

function normaliseProvider(v: unknown): BrainProvider | null {
  if (typeof v !== 'string') return null;
  const lc = v.toLowerCase().trim();
  return (ALL_BRAIN_PROVIDERS as readonly string[]).includes(lc) ? (lc as BrainProvider) : null;
}

function clampConfidence(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return fallback;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export async function readBrainConfig(): Promise<BrainConfig> {
  const def = defaultBrainConfig();
  try {
    const raw = await fs.readFile(brainConfigPath(), 'utf-8');
    const j = JSON.parse(raw) as Partial<BrainConfig>;
    return {
      version: 1,
      enabled: j.enabled !== false,
      provider: normaliseProvider(j.provider) ?? def.provider,
      model: typeof j.model === 'string' && j.model.trim() !== '' ? j.model.trim() : def.model,
      min_confidence: clampConfidence(j.min_confidence, def.min_confidence),
      timeout_ms: typeof j.timeout_ms === 'number' && j.timeout_ms > 0 ? Math.min(j.timeout_ms, 30000) : def.timeout_ms,
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return def;
    return def;
  }
}

export async function writeBrainConfig(cfg: BrainConfig): Promise<void> {
  ensureHomeDir();
  const p = brainConfigPath();
  const tmp = p + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  await fs.rename(tmp, p);
}

/** Merge a partial patch onto the stored config + persist. Unknown fields
 *  are ignored; invalid values fall back to the current value. */
export async function patchBrainConfig(patch: Partial<BrainConfig>): Promise<BrainConfig> {
  const cur = await readBrainConfig();
  const next: BrainConfig = {
    version: 1,
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : cur.enabled,
    provider: normaliseProvider(patch.provider) ?? cur.provider,
    model: typeof patch.model === 'string' && patch.model.trim() !== '' ? patch.model.trim() : cur.model,
    min_confidence: patch.min_confidence === undefined ? cur.min_confidence : clampConfidence(patch.min_confidence, cur.min_confidence),
    timeout_ms: typeof patch.timeout_ms === 'number' && patch.timeout_ms > 0 ? Math.min(patch.timeout_ms, 30000) : cur.timeout_ms,
  };
  await writeBrainConfig(next);
  return next;
}
