/**
 * PND-019 -- Tamara's v0.6.1 voice report: diagnostics tracer + low-risk fixes.
 *
 * Three things are pinned here:
 *   A. Bug 1 -- a bare "fin" (and a few stop synonyms) said as the WHOLE
 *      utterance stops dictation, while "fin" inside dictated prose does not.
 *   B. Bug 3 -- "fin campos" (the plural the recogniser sometimes emits)
 *      still releases the armed field.
 *   C. Bug 2 -- the send dialog no longer ships a default body.
 *   D. The diagnostics tracer records / exports / clears, and is a true
 *      no-op while disabled.
 *
 * ASCII-only.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseCommand } from '../src/voice/commands.js';
import { resolveLiterallyFirst } from '../src/voice/resolveCommand.js';

/* ---- A. bare-stop dictation (bug 1) ---- */
describe('PND-019 bug 1 -- a lone stop word ends dictation', () => {
  const BARE_STOPS = ['fin', 'terminar', 'finalizar', 'basta', 'parar', 'stop'];

  for (const word of BARE_STOPS) {
    it(`"${word}" alone is FIN_DICTADO`, () => {
      expect(parseCommand(word, 'global').type).toBe('FIN_DICTADO');
      /* And it routes instantly (no Brain wait) while dictating, so it stops
       * rather than being written as a paragraph -- the tester's symptom. */
      expect(resolveLiterallyFirst(word, 'global', {}, true)?.type).toBe('FIN_DICTADO');
    });
  }

  it('a "fin" INSIDE dictated prose does NOT stop dictation (guards over-matching)', () => {
    /* The whole-utterance anchor is what keeps ordinary speech flowing. */
    expect(parseCommand('el fin de semana que viene viajo', 'global').type).toBe('UNKNOWN');
    expect(parseCommand('llegamos al fin de la historia', 'global').type).toBe('UNKNOWN');
    expect(resolveLiterallyFirst('el fin de semana que viene viajo', 'global', {}, true)?.type).toBe('UNKNOWN');
  });

  it('the canonical "fin dictado" still works (no regression)', () => {
    expect(parseCommand('fin dictado', 'global').type).toBe('FIN_DICTADO');
  });
});

/* ---- B. "fin campos" plural (bug 3) ---- */
describe('PND-019 bug 3 -- "fin campos" plural releases the field', () => {
  for (const ctx of ['settings_dialog', 'send_dialog', 'signature_pad'] as const) {
    it(`"fin campos" is FIN_CAMPO in ${ctx}`, () => {
      expect(parseCommand('fin campos', ctx).type).toBe('FIN_CAMPO');
    });
    it(`"fin campo" still works in ${ctx} (no regression)`, () => {
      expect(parseCommand('fin campo', ctx).type).toBe('FIN_CAMPO');
    });
  }
});

/* ---- C. no default body (bug 2) ---- */
describe('PND-019 bug 2 -- send dialog ships an empty body', () => {
  it('SendDialog does not pre-fill the body', async () => {
    const src = await fs.readFile(path.resolve('src/components/SendDialog.tsx'), 'utf-8');
    expect(src).not.toContain('Adjunto el documento. Saludos.');
    expect(src).toMatch(/useState\(''\)/);
  });
});

/* ---- D. diagnostics tracer ---- */
describe('PND-019 -- voice diagnostics tracer', () => {
  /* The module reads localStorage lazily (per call), so a mock installed here
   * fully drives the on/off switch in the node test environment. */
  let store: Record<string, string>;
  beforeEach(() => {
    store = {};
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { store = {}; },
    };
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  async function fresh() {
    /* Re-import per test so the in-memory ring buffer starts empty. */
    vi.resetModules();
    return import('../src/voice/diagnostics.js');
  }

  it('is a no-op while disabled', async () => {
    const d = await fresh();
    expect(d.diagEnabled()).toBe(false);
    d.diagLog('hear', { browserText: 'hola' });
    expect(d.diagCount()).toBe(0);
  });

  it('records once enabled and clears on demand', async () => {
    const d = await fresh();
    d.setDiagEnabled(true);
    expect(d.diagEnabled()).toBe(true);
    d.diagLog('hear', { browserText: 'iniciar dictado', googleText: 'iniciar el dictado', usedSource: 'google' });
    d.diagLog('resolve', { lane: 'literal-first', commandType: 'INICIAR_DICTADO' });
    d.diagLog('act', { commandType: 'INICIAR_DICTADO', outcome: 'started' });
    expect(d.diagCount()).toBe(3);
    const entries = d.diagEntries();
    expect(entries[0]?.stage).toBe('hear');
    expect(entries[0]?.googleText).toBe('iniciar el dictado');
    d.diagClear();
    expect(d.diagCount()).toBe(0);
  });

  it('the flag survives a re-read (persisted in storage)', async () => {
    const d1 = await fresh();
    d1.setDiagEnabled(true);
    const d2 = await fresh(); /* a "reload": new module, same storage */
    expect(d2.diagEnabled()).toBe(true);
  });

  it('the readable export shows transcripts and the disabled export is empty', async () => {
    const d = await fresh();
    expect(d.diagExportText()).toContain('vacia');
    d.setDiagEnabled(true);
    d.diagLog('hear', { browserText: 'fin', googleText: 'fin', usedSource: 'google', context: 'global', dictationOn: true });
    d.diagLog('act', { commandType: 'FIN_DICTADO', outcome: 'red_seguridad_fin_dictado' });
    const text = d.diagExportText();
    expect(text).toContain('nav="fin"');
    expect(text).toContain('google="fin"');
    expect(text).toContain('FIN_DICTADO');
    const json = JSON.parse(d.diagExportJson()) as { entries: unknown[]; kind: string };
    expect(json.kind).toBe('voice-diagnostic-trace');
    expect(json.entries.length).toBe(2);
  });
});
