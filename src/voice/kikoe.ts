/**
 * Kikoe client engine (v0.11.0) -- Yuemail's browser-side use of the decoupled
 * add-on @yujinapp/nac3-kikoe.
 *
 * The accessibility payoff for ATYPICAL speech: instead of asking Google to
 * understand the person, the trainer compares the person's voice against the
 * person's OWN enrolled samples (template matching). Recognition runs locally,
 * offline and instant.
 *
 * PRIVACY BY DESIGN: feature extraction happens HERE, in the browser. The
 * microphone audio is decoded to PCM, turned into a numeric fingerprint, and
 * the audio is dropped on the spot -- only the numbers are ever sent to the
 * Yuemail server (which persists them device-scoped). The raw audio never
 * leaves the device.
 *
 * The engine NEVER executes a command: it answers "this sounds like <phrase>,
 * with this confidence" or "I am not sure -- ask the cloud". The App decides.
 *
 * ASCII-only.
 */
import {
  Matcher,
  decideRoute,
  extractFeatures,
  type CommandMetric,
  type CommandStats,
  type CommandTemplate,
  type Fingerprint,
  type RouterMode,
} from '@yujinapp/nac3-kikoe';
import { api } from '../lib/api.js';

/** One trainable command: the canonical PHRASE is the kikoe key (it doubles as
 *  the text fed back into Yuemail's normal command pipeline when recognised,
 *  so a local hit dispatches exactly like the spoken phrase would), plus a
 *  friendly label for the trainer UI. This list covers the global voice verbs
 *  of the app -- "todos los verbos NAC3" of the global surface. */
export interface TrainableCommand {
  phrase: string;
  label: string;
}

export const TRAINABLE_COMMANDS: ReadonlyArray<TrainableCommand> = [
  { phrase: 'leer bandeja',        label: 'Leer la bandeja' },
  { phrase: 'nuevo documento',     label: 'Documento nuevo' },
  { phrase: 'abrir documento',     label: 'Abrir un documento' },
  { phrase: 'enviar',              label: 'Enviar un correo' },
  { phrase: 'responder',           label: 'Responder' },
  { phrase: 'reenviar',            label: 'Reenviar' },
  { phrase: 'poner titulo',        label: 'Poner titulo' },
  { phrase: 'firmar',              label: 'Firmar el documento' },
  { phrase: 'guardar firma',       label: 'Guardar / crear la firma' },
  { phrase: 'dictado',             label: 'Dictado (encender / apagar)' },
  { phrase: 'abrir contactos',     label: 'Abrir contactos' },
  { phrase: 'agregar contacto',    label: 'Agregar un contacto' },
  { phrase: 'abrir configuracion', label: 'Abrir configuracion' },
  { phrase: 'abrir entrenador',    label: 'Abrir el entrenador de voz' },
  { phrase: 'encender microfono',  label: 'Encender el microfono' },
  { phrase: 'apagar microfono',    label: 'Apagar el microfono' },
  { phrase: 'detener voz',         label: 'Detener la voz' },
];

/** Local recognition result handed to the host (the App). */
export interface LocalRecognition {
  /** The recognised canonical phrase (null when nothing matched). */
  command: string | null;
  /** The matcher accepted the best candidate (distance under threshold). */
  accepted: boolean;
  /** The router says fire local now. */
  preferLocal: boolean;
  /** The router says the cloud must also run (a result and/or to measure). */
  runCloud: boolean;
  /** Cleared the acceptance + confidence bar. */
  confident: boolean;
  /** Best DTW distance, for diagnostics. */
  distance: number;
}

type AudioCtor = typeof AudioContext;

function pickAudioContext(): AudioCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext;
}

/** Decode a recorded audio blob to mono PCM. Returns null when WebAudio is
 *  unavailable or the blob cannot be decoded (caller falls back to the cloud). */
async function decodeBlobToPcm(blob: Blob): Promise<{ pcm: Float32Array; sampleRate: number } | null> {
  const Ctor = pickAudioContext();
  if (!Ctor) return null;
  let ctx: AudioContext | undefined;
  try {
    ctx = new Ctor();
    const buf = await blob.arrayBuffer();
    const audio = await ctx.decodeAudioData(buf);
    const channels = audio.numberOfChannels;
    const len = audio.length;
    const mono = new Float32Array(len);
    for (let c = 0; c < channels; c++) {
      const data = audio.getChannelData(c);
      for (let i = 0; i < len; i++) mono[i] = (mono[i] ?? 0) + (data[i] ?? 0) / channels;
    }
    return { pcm: mono, sampleRate: audio.sampleRate };
  } catch {
    return null;
  } finally {
    try { await ctx?.close(); } catch { /* ignore */ }
  }
}

/** Extract a numeric fingerprint from a recorded blob (audio dropped here). */
export async function fingerprintFromBlob(blob: Blob): Promise<Fingerprint | null> {
  const decoded = await decodeBlobToPcm(blob);
  if (!decoded) return null;
  const frames = extractFeatures(decoded.pcm, decoded.sampleRate);
  if (frames.length === 0) return null;
  return { frames };
}

export class KikoeClient {
  private templates: CommandTemplate[] = [];
  private statsByCommand = new Map<string, CommandStats>();
  private mode: RouterMode = 'learning';
  private loaded = false;

  /** True once at least one command is enrolled: only then does the local lane
   *  do anything. With nothing trained, every utterance goes to the cloud and
   *  the app behaves exactly as it does without the add-on. */
  enabled(): boolean {
    return this.loaded && this.templates.length > 0;
  }

  getMode(): RouterMode { return this.mode; }
  getMetrics(): CommandMetric[] {
    return [...this.statsByCommand.entries()].map(([command, stats]) => {
      const tpl = this.templates.find((t) => t.command === command);
      return buildMetric(command, tpl?.fingerprints.length ?? 0, stats);
    });
  }

  /** Pull the device's templates + metrics + mode from the server. Never
   *  throws: a failure leaves the lane disabled (cloud-only). */
  async refresh(): Promise<void> {
    try {
      const s = await api.kikoeState();
      this.templates = s.templates;
      this.mode = s.mode;
      this.statsByCommand = new Map(s.metrics.map((m) => [m.command, m.stats]));
      this.loaded = true;
    } catch {
      this.loaded = false;
      this.templates = [];
      this.statsByCommand.clear();
    }
  }

  /** Recognise one captured utterance locally. Returns null when WebAudio is
   *  unavailable, nothing is enrolled, or decoding fails (-> cloud handles it). */
  async recognize(blob: Blob): Promise<LocalRecognition | null> {
    if (!this.enabled()) return null;
    const fp = await fingerprintFromBlob(blob);
    if (!fp) return null;
    const threshold = Matcher.suggestThreshold(this.templates);
    const matcher = new Matcher({ threshold });
    const match = matcher.match(fp.frames, this.templates);
    const stats = match.command ? this.statsByCommand.get(match.command) : undefined;
    const route = decideRoute(match, stats, this.mode);
    return {
      command: match.command,
      accepted: match.accepted,
      preferLocal: route.preferLocal,
      runCloud: route.runCloud,
      confident: route.confident,
      distance: match.distance,
    };
  }

  /** Enroll several recordings for one command. Extracts fingerprints in the
   *  browser and posts only the numbers. Refreshes the cache afterwards. */
  async enroll(command: string, blobs: Blob[], replace = false): Promise<number> {
    const fingerprints: Fingerprint[] = [];
    for (const b of blobs) {
      const fp = await fingerprintFromBlob(b);
      if (fp) fingerprints.push(fp);
    }
    if (fingerprints.length === 0) throw new Error('No se pudo extraer audio utilizable de las grabaciones.');
    const res = await api.kikoeEnroll(command, fingerprints, replace);
    await this.refresh();
    return res.samples;
  }

  async forget(command: string): Promise<void> {
    await api.kikoeForget(command);
    await this.refresh();
  }

  async setMode(mode: RouterMode): Promise<void> {
    const res = await api.kikoeSetMode(mode);
    this.mode = res.mode;
  }

  /** Confidence signal (source of truth: the person). */
  async observeOutcome(command: string, accepted: boolean): Promise<void> {
    try {
      await api.kikoeObserveOutcome(command, accepted);
      this.bump(command, (s) => ({ ...s, accepts: s.accepts + (accepted ? 1 : 0), rejects: s.rejects + (accepted ? 0 : 1) }));
    } catch { /* metrics are best-effort */ }
  }

  /** Effectiveness signal (source of truth: the cloud second opinion). */
  async observeCloud(command: string, agreed: boolean): Promise<void> {
    try {
      await api.kikoeObserveCloud(command, agreed);
      this.bump(command, (s) => ({ ...s, cloudAgree: s.cloudAgree + (agreed ? 1 : 0), cloudDisagree: s.cloudDisagree + (agreed ? 0 : 1) }));
    } catch { /* metrics are best-effort */ }
  }

  private bump(command: string, fn: (s: CommandStats) => CommandStats): void {
    const cur = this.statsByCommand.get(command) ?? { accepts: 0, rejects: 0, cloudAgree: 0, cloudDisagree: 0, updatedAt: 0 };
    this.statsByCommand.set(command, fn(cur));
  }
}

/* Local mirror of the package metric assembly so getMetrics() can render the
 * cache without another round-trip (same Laplace-smoothed figures). */
function buildMetric(command: string, samples: number, stats: CommandStats): CommandMetric {
  const conf = (stats.accepts + 1) / (stats.accepts + stats.rejects + 2);
  const eff = (stats.cloudAgree + 1) / (stats.cloudAgree + stats.cloudDisagree + 2);
  return {
    command,
    samples,
    confidence: conf,
    effectiveness: eff,
    feedbackCount: stats.accepts + stats.rejects,
    measurementCount: stats.cloudAgree + stats.cloudDisagree,
    stats,
    updatedAt: stats.updatedAt,
  };
}

/** Resolve a cloud transcript to the canonical phrase it would trigger, so the
 *  App can compare it against the local candidate for the effectiveness metric.
 *  Returns the matching TRAINABLE_COMMANDS phrase, or null. The comparison is
 *  intentionally coarse (substring on the normalised text) -- it only needs to
 *  answer "did local and cloud point at the same command?". */
export function cloudPhraseOf(transcript: string): string | null {
  const n = transcript.toLowerCase().trim();
  if (n.length === 0) return null;
  for (const c of TRAINABLE_COMMANDS) {
    if (n.includes(c.phrase)) return c.phrase;
  }
  return null;
}
