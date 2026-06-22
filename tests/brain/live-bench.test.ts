/**
 * Live Brain efficiency bench (v0.5.0).
 *
 * This is the "push efficiency toward 100%" instrument. It runs the whole
 * phrase bank against the REAL configured brain (provider + model + the key
 * in the vault) and reports the accuracy, listing every miss so the catalog
 * prompts can be tuned.
 *
 * Gated on BRAIN_LIVE=1 so CI stays deterministic and free: without a key
 * there is nothing honest to measure here (the deterministic logic is
 * covered by router.test.ts / safety-net.test.ts). Run it with:
 *
 *   # bash
 *   BRAIN_LIVE=1 npx vitest run tests/brain/live-bench.test.ts
 *   # PowerShell
 *   $env:BRAIN_LIVE=1; npx vitest run tests/brain/live-bench.test.ts
 *
 * Optional: BRAIN_MIN_ACC (default 0.95) sets the pass threshold.
 *
 * ASCII-only.
 */
import { describe, it, expect } from 'vitest';
import { resolveUtterance } from '../../server/brain/router.js';
import { PHRASE_BANK } from './phrase_bank.js';

const LIVE = process.env['BRAIN_LIVE'] === '1';
const MIN_ACC = process.env['BRAIN_MIN_ACC'] ? Number(process.env['BRAIN_MIN_ACC']) : 0.95;

describe.skipIf(!LIVE)('live brain efficiency bench', () => {
  it('classifies the phrase bank at or above the accuracy threshold', async () => {
    let hits = 0;
    const misses: string[] = [];
    for (const c of PHRASE_BANK) {
      const r = await resolveUtterance(c.utterance, c.context);
      const got = r.ok ? r.type : 'MISS:' + r.reason;
      if (r.ok && r.type === c.expected) {
        hits++;
      } else {
        misses.push('[' + c.context + '] "' + c.utterance + '" -> ' + got + ' (esperado ' + c.expected + ')');
      }
    }
    const acc = hits / PHRASE_BANK.length;
    /* eslint-disable no-console */
    console.log('\n=== Brain efficiency bench ===');
    console.log('aciertos: ' + hits + '/' + PHRASE_BANK.length + ' = ' + (acc * 100).toFixed(1) + '%');
    if (misses.length > 0) {
      console.log('fallos:');
      for (const m of misses) console.log('  - ' + m);
    }
    /* eslint-enable no-console */
    expect(acc).toBeGreaterThanOrEqual(MIN_ACC);
  }, 120000);
});
