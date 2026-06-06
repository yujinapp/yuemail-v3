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
