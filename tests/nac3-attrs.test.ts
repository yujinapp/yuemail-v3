/**
 * NAC3 attribute coverage (F9).
 *
 * Lightweight static check: every interactive component file should
 * contain at least one `data-nac-id="yuemail.<area>.<element>"` pair
 * so the accessibility / automation layer can address the element.
 */
import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { COMMAND_CATALOG, SETTINGS_FIELD_SPECS, parseCommand } from '../src/voice/commands.js';

const COMPONENT_FILES = [
  'src/components/Toolbar.tsx',
  'src/components/Editor.tsx',
  'src/components/SignaturePad.tsx',
  'src/components/SendDialog.tsx',
  'src/components/SettingsDialog.tsx',
  'src/App.tsx',
];

describe('NAC3 attributes (F9)', () => {
  it('every component carries at least one yuemail.* data-nac-id', async () => {
    for (const rel of COMPONENT_FILES) {
      const src = await fs.readFile(path.resolve(rel), 'utf-8');
      expect(src, rel).toMatch(/data-nac-id="yuemail\.[a-z_-]+\.[a-z_-]+"/);
    }
  });

  it('uses the documented area namespaces', async () => {
    /* Aggregate every data-nac-id across the component set and verify
     * each area belongs to the F9-documented namespace list. */
    const allowedAreas = new Set([
      'toolbar', 'topbar', 'doc', 'signature', 'email', 'voice', 'inbox', 'settings',
    ]);
    for (const rel of COMPONENT_FILES) {
      const src = await fs.readFile(path.resolve(rel), 'utf-8');
      const matches = [...src.matchAll(/data-nac-id="yuemail\.([a-z_-]+)\.[a-z_-]+"/g)];
      for (const m of matches) {
        const area = m[1] ?? '';
        expect(allowedAreas.has(area), rel + ' uses area="' + area + '"').toBe(true);
      }
    }
  });
});

/* Voice/NAC3 producer-consumer symmetry (SQ 14).
 *
 * Regression guard for the modal dead-end bug: every actionable button
 * inside a modal must be reachable by voice. We assert three links:
 *   0. every <button> in a modal file carries a data-nac-action at all
 *      (a brand-new button with no attribute is the most likely
 *      regression, and without this check it would pass silently),
 *   1. the button's data-nac-action has a contextual COMMAND_CATALOG entry
 *      (the voice vocabulary knows it exists), and
 *   2. App.tsx routes that action string (the command actually fires it).
 * With the three links together, adding a modal button without a voice
 * route -- attribute missing OR catalog entry missing OR route missing --
 * goes red. */
describe('Voice/NAC3 symmetry -- modal buttons are voice-reachable', () => {
  const MODAL_FILES = [
    'src/components/SendDialog.tsx',
    'src/components/SignaturePad.tsx',
    'src/components/SettingsDialog.tsx',
  ];

  async function modalButtonTags(rel: string): Promise<string[]> {
    const src = await fs.readFile(path.resolve(rel), 'utf-8');
    /* JSX button openings span lines; [^>]* crosses newlines on purpose. */
    return [...src.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
  }

  async function modalButtonActions(rel: string): Promise<string[]> {
    return (await modalButtonTags(rel))
      .map((tag) => tag.match(/data-nac-action="([a-z_]+)"/)?.[1] ?? '')
      .filter((a) => a.length > 0);
  }

  it('every modal <button> carries a data-nac-action (coverage, not just consistency)', async () => {
    for (const rel of MODAL_FILES) {
      for (const tag of await modalButtonTags(rel)) {
        expect(/data-nac-action="[a-z_]+"/.test(tag), rel + ' has a button with no data-nac-action: ' + tag.slice(0, 80)).toBe(true);
      }
    }
  });

  it('every modal button data-nac-action has a contextual voice command', async () => {
    const voiced = new Set(COMMAND_CATALOG.filter((c) => c.context).map((c) => c.nac_action));
    for (const rel of MODAL_FILES) {
      for (const action of await modalButtonActions(rel)) {
        expect(voiced.has(action), rel + ' button action="' + action + '" has no voice route').toBe(true);
      }
    }
  });

  it('App.tsx routes every voiced modal action', async () => {
    const app = await fs.readFile(path.resolve('src/App.tsx'), 'utf-8');
    const fieldActions = new Set(SETTINGS_FIELD_SPECS.map((s) => s.nac_action));
    for (const entry of COMMAND_CATALOG.filter((c) => c.context)) {
      /* Field-scoped entries route through the generic armed-field path,
       * asserted by the dictation suite below. */
      if (entry.field_scope || (entry.nac_action && fieldActions.has(entry.nac_action))) continue;
      const needle = "clickNacAction('" + entry.nac_action + "')";
      expect(app.includes(needle), entry.nac_action + ' is not routed in App.tsx').toBe(true);
    }
  });
});

/* Settings field dictation symmetry (SQ 14, adenda 2026-06-10 bis).
 *
 * Same producer/consumer discipline, now for the settings INPUTS: a
 * voice-first app where you can reach every button but cannot fill a
 * field is still a dead end. Four links:
 *   0. every <input> in SettingsDialog.tsx carries a data-nac-action at
 *      all (coverage -- a brand-new input with no attribute goes red),
 *   1. that action has a SETTINGS_FIELD_SPECS entry (the voice layer can
 *      arm + write it), and every spec points back at real markup,
 *   2. every spec is reachable by voice through each of its aliases
 *      ("campo <alias>" -> ENFOCAR_CAMPO + the right payload),
 *   3. App.tsx wires the generic armed-field routing (focus + write +
 *      toggle + dictation apply). */
describe('Voice/NAC3 symmetry -- settings inputs are voice-dictatable', () => {
  const SETTINGS_FILE = 'src/components/SettingsDialog.tsx';
  const fieldActions = new Set(SETTINGS_FIELD_SPECS.map((s) => s.nac_action));

  async function inputTags(): Promise<string[]> {
    const src = await fs.readFile(path.resolve(SETTINGS_FILE), 'utf-8');
    /* Inputs are self-closing in this codebase, so capture lazily up to
     * the '/>' terminator. A plain [^>]* would stop at the '=>' of an
     * inline arrow handler and truncate the tag before the nac attrs
     * (that exact bug bit this suite once -- caught by going red). */
    return [...src.matchAll(/<input[\s\S]*?\/>/g)].map((m) => m[0]);
  }

  it('every settings <input> carries a data-nac-action (coverage, not just consistency)', async () => {
    const tags = await inputTags();
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      expect(/data-nac-action="[a-z_]+"/.test(tag), SETTINGS_FILE + ' has an input with no data-nac-action: ' + tag.slice(0, 80)).toBe(true);
    }
  });

  it('every settings input action has a field spec (voice can dictate it)', async () => {
    for (const tag of await inputTags()) {
      const action = tag.match(/data-nac-action="([a-z_]+)"/)?.[1] ?? '';
      if (action.length === 0) continue; /* reported by the coverage check above */
      expect(fieldActions.has(action), 'input action="' + action + '" has no SETTINGS_FIELD_SPECS entry').toBe(true);
    }
  });

  it('every field spec points at real settings markup (no orphan specs)', async () => {
    const src = await fs.readFile(path.resolve(SETTINGS_FILE), 'utf-8');
    for (const spec of SETTINGS_FIELD_SPECS) {
      expect(src.includes('data-nac-action="' + spec.nac_action + '"'), spec.key + ' points at missing markup ' + spec.nac_action).toBe(true);
    }
  });

  it('every field spec is reachable by voice through each of its aliases', () => {
    for (const spec of SETTINGS_FIELD_SPECS) {
      for (const alias of spec.aliases) {
        const cmd = parseCommand('campo ' + alias, 'settings_dialog');
        expect(cmd.type, 'campo ' + alias).toBe('ENFOCAR_CAMPO');
        expect(cmd.payload, 'campo ' + alias).toBe(spec.key);
      }
    }
  });

  it('App.tsx wires the generic armed-field routing', async () => {
    const app = await fs.readFile(path.resolve('src/App.tsx'), 'utf-8');
    for (const needle of ['focusNacField(', 'setNacFieldValue(', 'setNacCheckbox(', 'applyFieldDictation(', "case 'ENFOCAR_CAMPO'", "case 'BORRAR_CAMPO'"]) {
      expect(app.includes(needle), needle + ' missing in App.tsx').toBe(true);
    }
  });
});
