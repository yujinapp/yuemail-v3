/**
 * Voice diagnostics tracer (PND-019).
 *
 * The voice bugs Tamara reported (dictation not stopping on "fin",
 * "fin campo" understood only sometimes, the title flow) are recognition /
 * routing problems: to diagnose them we must see the EXACT transcript Google
 * returned, the browser's parallel transcript, the context at that instant,
 * and which command we resolved. The app discarded all of that.
 *
 * This module is an opt-in, in-memory, verbose tracer. When ON it records one
 * row per recognition event across the three stages an utterance travels:
 *
 *   hear    -- what the browser heard (interim + final) and what Google
 *              transcribed; which transcript we kept.
 *   resolve -- which lane decided the command (instant literal matcher,
 *              the cloud Brain, or the fixed-phrase fallback) and the result.
 *   act     -- the command we dispatched and what the app DID with it
 *              (started dictation, wrote a paragraph, focused a field, etc).
 *
 * The trace lives only in memory + a single localStorage flag (the ON/OFF
 * switch survives a reload so the tester can enable it once). Nothing is sent
 * anywhere; the tester EXPORTS a file and hands it back. No transcript leaves
 * the machine on its own. ASCII-only.
 */

export type TraceStage = 'hear' | 'resolve' | 'act' | 'note';

export type ResolveLane =
  | 'literal-first'   // instant network-free matcher (dictation toggles / content)
  | 'armed-field'     // a modal field was armed: utterance is its value
  | 'brain'           // the cloud Brain classified it
  | 'fallback';       // Brain missed/failed: fixed-phrase matcher

export interface TraceEntry {
  seq:           number;
  ts:            number;            // Date.now() at capture
  stage:         TraceStage;
  /* hear */
  interim?:      boolean;           // true = live partial, false = finalised
  browserText?:  string;            // what the browser SpeechRecognition heard
  googleText?:   string;            // what Google Speech-to-Text returned
  usedSource?:   'google' | 'browser' | 'none';
  serverReady?:  boolean;           // was camino-1 (Google) live for this utterance
  transcribeOk?: boolean;           // did the Google call succeed
  /* resolve / act */
  lane?:         ResolveLane;
  commandType?:  string;
  payload?:      string;
  raw?:          string;
  normalized?:   string;
  /* shared context */
  context?:      string;            // global / send_dialog / signature_pad / settings_dialog
  dictationOn?:  boolean;
  armedField?:   string;            // key of the armed dialog field, if any
  /* act */
  outcome?:      string;            // human label of what happened
  detail?:       string;            // extra free text (e.g. the paragraph written)
}

const CAP    = 4000;               // ring-buffer cap; a single test run is a few hundred
const LS_KEY = 'yuemail.voice.diag.enabled';

let buffer: TraceEntry[] = [];
let seq = 0;
let listeners: Array<() => void> = [];

function notify(): void {
  for (const fn of listeners) {
    try { fn(); } catch { /* a listener must never break the tracer */ }
  }
}

function readFlag(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(LS_KEY) === '1'; }
  catch { return false; }
}

/** Is the tracer recording right now? Cheap: a single localStorage read. */
export function diagEnabled(): boolean {
  return readFlag();
}

/** Turn recording on/off. The flag persists across reloads. */
export function setDiagEnabled(on: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (on) localStorage.setItem(LS_KEY, '1');
    else localStorage.removeItem(LS_KEY);
  } catch { /* private mode / no storage: stay off */ }
  notify();
}

/** Record one event. A no-op (and zero allocation past the guard) when off. */
export function diagLog(stage: TraceStage, fields: Partial<TraceEntry> = {}): void {
  if (!readFlag()) return;
  seq += 1;
  const entry: TraceEntry = { seq, ts: Date.now(), stage, ...fields };
  buffer.push(entry);
  if (buffer.length > CAP) buffer = buffer.slice(buffer.length - CAP);
  notify();
}

export function diagEntries(): ReadonlyArray<TraceEntry> {
  return buffer;
}

export function diagCount(): number {
  return buffer.length;
}

export function diagClear(): void {
  buffer = [];
  seq = 0;
  notify();
}

/** Subscribe to changes (count / flag). Returns an unsubscribe fn. */
export function diagSubscribe(fn: () => void): () => void {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}

/* ------------------------------------------------------------------ */
/* Export rendering                                                    */
/* ------------------------------------------------------------------ */

function pad(n: number, width: number): string {
  const s = String(n);
  return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}

/** Machine-readable export: the full structured trace. */
export function diagExportJson(): string {
  return JSON.stringify(
    {
      app: 'yuemail',
      kind: 'voice-diagnostic-trace',
      version: 1,
      exported_at: new Date().toISOString(),
      entries: buffer,
    },
    null,
    2,
  );
}

/** Human-readable export: one aligned line per event, grouped by stage. */
export function diagExportText(): string {
  if (buffer.length === 0) {
    return 'Yuemail -- traza de voz vacia. Encende el modo diagnostico y corre la prueba.';
  }
  const t0 = buffer[0]?.ts ?? 0;
  const lines: string[] = [];
  lines.push('Yuemail -- traza de diagnostico de voz (PND-019)');
  lines.push('Exportada: ' + new Date().toISOString());
  lines.push('Eventos: ' + buffer.length);
  lines.push('Leyenda: [HEAR] lo que se escucho  [RSLV] comando resuelto  [ACT] que hizo la app');
  lines.push('-'.repeat(72));
  for (const e of buffer) {
    const dt = '+' + pad(Math.round((e.ts - t0)), 6) + 'ms';
    const ctx = e.context ? e.context : '-';
    const dict = e.dictationOn === undefined ? '' : (e.dictationOn ? ' dict:ON' : ' dict:off');
    const arm = e.armedField ? ' campo:' + e.armedField : '';
    if (e.stage === 'hear') {
      const tag = e.interim ? '[HEAR.interim]' : '[HEAR.final]  ';
      const b = e.browserText !== undefined ? ' nav="' + e.browserText + '"' : '';
      const g = e.googleText !== undefined ? ' google="' + e.googleText + '"' : '';
      const src = e.usedSource ? ' uso:' + e.usedSource : '';
      const ready = e.serverReady === undefined ? '' : ' google_live:' + (e.serverReady ? 'si' : 'no');
      lines.push(dt + ' ' + tag + ' ctx:' + ctx + dict + arm + b + g + src + ready);
    } else if (e.stage === 'resolve') {
      const lane = e.lane ? ' lane:' + e.lane : '';
      const cmd = ' cmd:' + (e.commandType ?? '?') + (e.payload ? '(' + e.payload + ')' : '');
      const raw = e.raw !== undefined ? ' raw="' + e.raw + '"' : '';
      lines.push(dt + ' [RSLV]        ctx:' + ctx + dict + arm + lane + cmd + raw);
    } else if (e.stage === 'act') {
      const cmd = ' cmd:' + (e.commandType ?? '?') + (e.payload ? '(' + e.payload + ')' : '');
      const out = e.outcome ? ' -> ' + e.outcome : '';
      const det = e.detail ? ' "' + e.detail + '"' : '';
      lines.push(dt + ' [ACT]         ctx:' + ctx + dict + arm + cmd + out + det);
    } else {
      lines.push(dt + ' [NOTE]        ' + (e.detail ?? ''));
    }
  }
  lines.push('-'.repeat(72));
  lines.push('Fin de la traza.');
  return lines.join('\n');
}

/** Trigger a browser download of both the readable and JSON traces (one zip-less pair). */
export function diagDownload(): { textName: string; jsonName: string } | undefined {
  if (typeof document === 'undefined') return undefined;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const textName = 'yuemail-voz-diagnostico-' + stamp + '.txt';
  const jsonName = 'yuemail-voz-diagnostico-' + stamp + '.json';
  downloadOne(textName, diagExportText(), 'text/plain');
  downloadOne(jsonName, diagExportJson(), 'application/json');
  return { textName, jsonName };
}

function downloadOne(name: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  /* Revoke on the next tick so the click has consumed the URL. */
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
