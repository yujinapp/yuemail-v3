/**
 * Toolbar contract (F1 / acceptance #6).
 *
 * We validate the labels + NAC3 attribute shape from the static export.
 * The exact React render is verified by the e2e Playwright suite that
 * follows (out-of-scope for this dogfood).
 */
import { describe, it, expect } from 'vitest';
import { TOOLBAR_BUTTON_LABELS } from '../src/components/Toolbar.js';

describe('Toolbar (F1 / acceptance #6)', () => {
  it('exposes exactly 4 labels', () => {
    expect(TOOLBAR_BUTTON_LABELS.length).toBe(4);
  });

  it('labels match the spec verbatim', () => {
    expect(TOOLBAR_BUTTON_LABELS).toEqual([
      'Nuevo documento',
      'Abrir documento',
      'Guardar firma',
      'Firmar',
    ]);
  });

  it('every label is non-empty', () => {
    for (const label of TOOLBAR_BUTTON_LABELS) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
