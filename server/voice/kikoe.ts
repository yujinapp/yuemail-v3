/**
 * Kikoe (voice trainer) server-side glue (v0.11.0).
 *
 * Yuemail is adopter #1 of the decoupled add-on @yujinapp/nac3-kikoe. This
 * module wires the package's KikoeEngine to a device-scoped JSON store, the
 * single adapter the host must provide.
 *
 * Storage:
 *   ~/.yuemail/kikoe.json   (honours YUEMAIL_HOME like the vault + brain)
 *
 * The store holds ONLY numeric fingerprints, per-command metrics and the
 * router mode -- never raw audio (the browser extracts features and posts the
 * numbers; the audio never leaves the device). The mode "perilla" is scoped to
 * this device, exactly as the owner chose, because the trainer is per-speaker.
 *
 * ASCII-only.
 */
import { promises as fs, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  KikoeEngine,
  ALL_ROUTER_MODES,
  type KikoeState,
  type KikoeStorageAdapter,
  type RouterMode,
  type CommandTemplate,
  type CommandStats,
} from '@yujinapp/nac3-kikoe';

/** The owner's chosen default: "learning" (b) -- shadow-measures against the
 *  cloud while calibrating, then tapers to on_doubt on its own. */
export const DEFAULT_MODE: RouterMode = 'learning';

function homeDir(): string {
  const env = process.env['YUEMAIL_HOME'];
  return env ? path.resolve(env) : path.join(os.homedir(), '.yuemail');
}
function kikoePath(): string { return path.join(homeDir(), 'kikoe.json'); }

function ensureHomeDir(): void {
  if (!existsSync(homeDir())) mkdirSync(homeDir(), { recursive: true, mode: 0o700 });
}

function normaliseMode(v: unknown): RouterMode {
  return (ALL_ROUTER_MODES as readonly string[]).includes(v as string)
    ? (v as RouterMode)
    : DEFAULT_MODE;
}

/** Coerce arbitrary JSON into a valid CommandStats (defends the store against
 *  hand-edits / older shapes). */
function normaliseStats(v: unknown): CommandStats {
  const o = (v ?? {}) as Record<string, unknown>;
  const int = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
  return {
    accepts: int(o['accepts']),
    rejects: int(o['rejects']),
    cloudAgree: int(o['cloudAgree']),
    cloudDisagree: int(o['cloudDisagree']),
    updatedAt: int(o['updatedAt']),
  };
}

/** Coerce arbitrary JSON into valid numeric templates. Anything non-numeric is
 *  dropped: only number[][] fingerprints survive (no audio could ever land). */
function normaliseTemplates(v: unknown): CommandTemplate[] {
  if (!Array.isArray(v)) return [];
  const out: CommandTemplate[] = [];
  for (const t of v) {
    const o = (t ?? {}) as Record<string, unknown>;
    if (typeof o['command'] !== 'string') continue;
    const fps = Array.isArray(o['fingerprints']) ? o['fingerprints'] : [];
    const fingerprints = fps
      .map((fp) => {
        const frames = Array.isArray((fp as { frames?: unknown }).frames)
          ? ((fp as { frames: unknown[] }).frames)
          : [];
        return {
          frames: frames
            .filter((row) => Array.isArray(row))
            .map((row) => (row as unknown[]).filter((n) => typeof n === 'number') as number[]),
        };
      })
      .filter((fp) => fp.frames.length > 0);
    out.push({
      command: o['command'] as string,
      fingerprints,
      updatedAt: typeof o['updatedAt'] === 'number' ? o['updatedAt'] : 0,
    });
  }
  return out;
}

function defaultState(): KikoeState {
  return { templates: [], stats: {}, mode: DEFAULT_MODE };
}

/** File-backed KikoeStorageAdapter (device-scoped, atomic writes). */
export class FileKikoeStorage implements KikoeStorageAdapter {
  async load(): Promise<KikoeState> {
    try {
      const raw = await fs.readFile(kikoePath(), 'utf-8');
      const j = JSON.parse(raw) as Partial<KikoeState>;
      const stats: Record<string, CommandStats> = {};
      const rawStats = (j.stats ?? {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries(rawStats)) stats[k] = normaliseStats(v);
      return {
        templates: normaliseTemplates(j.templates),
        stats,
        mode: normaliseMode(j.mode),
      };
    } catch {
      return defaultState();
    }
  }

  async save(state: KikoeState): Promise<void> {
    ensureHomeDir();
    const p = kikoePath();
    const tmp = p + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
    await fs.rename(tmp, p);
  }
}

/* One engine per process. The clock is injected (the package never calls
 * Date.now itself); minConfidence 0.6 is the bar a command must clear before
 * the local lane fires without the cloud. */
let engineSingleton: KikoeEngine | undefined;
export function getKikoeEngine(): KikoeEngine {
  if (!engineSingleton) {
    engineSingleton = new KikoeEngine(new FileKikoeStorage(), {
      now: () => Date.now(),
      router: { minConfidence: 0.6 },
    });
  }
  return engineSingleton;
}
