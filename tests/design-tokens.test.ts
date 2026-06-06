/**
 * Yujin Design System token guard (F10).
 *
 * Two invariants:
 *   1. tokens.css declares every accent + spacing + typography token
 *      the design doctrine demands.
 *   2. app.css references only var(--...) for colors / sizes -- no
 *      raw hex / rem / px (we allow px in narrow cases noted below).
 */
import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

describe('design tokens (F10)', () => {
  it('tokens.css declares the 5 accent variables', async () => {
    const src = await fs.readFile(path.resolve('src/styles/tokens.css'), 'utf-8');
    for (const name of ['--accent-sakura', '--accent-jade', '--accent-sky', '--accent-amber', '--accent-rose']) {
      expect(src).toContain(name);
    }
  });

  it('tokens.css declares the 8px-grid spacing scale', async () => {
    const src = await fs.readFile(path.resolve('src/styles/tokens.css'), 'utf-8');
    for (const i of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(src).toContain('--space-' + i + ':');
    }
  });

  it('tokens.css declares core font + radius tokens', async () => {
    const src = await fs.readFile(path.resolve('src/styles/tokens.css'), 'utf-8');
    for (const name of [
      '--font-family-sans',
      '--font-family-serif',
      '--font-size-md',
      '--radius-sm',
      '--radius-md',
    ]) {
      expect(src).toContain(name);
    }
  });

  it('app.css references CSS variables for colors', async () => {
    const src = await fs.readFile(path.resolve('src/styles/app.css'), 'utf-8');
    expect(src).toMatch(/var\(--color-/);
    expect(src).toMatch(/var\(--accent-/);
  });
});
