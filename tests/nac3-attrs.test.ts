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
import { COMMAND_CATALOG } from '../src/voice/commands.js';

const COMPONENT_FILES = [
  'src/components/Toolbar.tsx',
  'src/components/Editor.tsx',
  'src/components/SignaturePad.tsx',
  'src/components/SendDialog.tsx',
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
 * inside a modal must be reachable by voice. We assert two links:
 *   1. the button's data-nac-action has a contextual COMMAND_CATALOG entry
 *      (the voice vocabulary knows it exists), and
 *   2. App.tsx routes that action string (the command actually fires it).
 * If someone adds a modal button without a voice route, this goes red. */
describe('Voice/NAC3 symmetry -- modal buttons are voice-reachable', () => {
  const MODAL_FILES = [
    'src/components/SendDialog.tsx',
    'src/components/SignaturePad.tsx',
  ];

  async function modalButtonActions(rel: string): Promise<string[]> {
    const src = await fs.readFile(path.resolve(rel), 'utf-8');
    return [...src.matchAll(/<button[^>]*data-nac-action="([a-z_]+)"/g)].map((m) => m[1] ?? '');
  }

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
    for (const entry of COMMAND_CATALOG.filter((c) => c.context)) {
      const needle = "clickNacAction('" + entry.nac_action + "')";
      expect(app.includes(needle), entry.nac_action + ' is not routed in App.tsx').toBe(true);
    }
  });
});
