/**
 * Extended live Brain efficiency bench (v0.5.0).
 *
 * Runs the XL phrase bank (tests/brain/phrase_bank_xl.ts) against the REAL
 * configured brain and reports accuracy broken down by kind (freeform,
 * asr_noise, email, negative), listing every miss so the system prompt and
 * catalog descriptions can be tuned toward 100%.
 *
 * Gated on BRAIN_LIVE_XL=1 so CI stays deterministic and free. Run with:
 *   # PowerShell
 *   $env:BRAIN_LIVE_XL=1; npx vitest run tests/brain/live-bench-xl.test.ts
 *   # bash
 *   BRAIN_LIVE_XL=1 npx vitest run tests/brain/live-bench-xl.test.ts
 *
 * Optional: BRAIN_MIN_ACC (default 1.0) sets the pass threshold.
 *
 * ASCII-only.
 */
import { describe, it, expect } from 'vitest';
import { resolveUtterance } from '../../server/brain/router.js';
import { PHRASE_BANK_XL, type XlCase } from './phrase_bank_xl.js';

const LIVE = process.env['BRAIN_LIVE_XL'] === '1';
const MIN_ACC = process.env['BRAIN_MIN_ACC'] ? Number(process.env['BRAIN_MIN_ACC']) : 1.0;

function normEmail(s: string | undefined): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, '').replace(/mailto:/, '').trim();
}

describe.skipIf(!LIVE)('live brain XL efficiency bench', () => {
  it('routes the XL phrase bank at or above the accuracy threshold', async () => {
    const byKind: Record<string, { hits: number; total: number }> = {};
    const misses: string[] = [];
    const emailMisses: string[] = [];
    let hits = 0;

    for (const c of PHRASE_BANK_XL as XlCase[]) {
      const r = await resolveUtterance(c.utterance, c.context);
      const bucket = (byKind[c.kind] ??= { hits: 0, total: 0 });
      bucket.total++;

      let ok: boolean;
      if (c.expected === null) {
        /* negative: success = the Brain declined so the app falls back */
        ok = !r.ok;
      } else {
        ok = r.ok && r.type === c.expected;
        /* email payload checked separately (secondary signal) */
        if (ok && c.expectedEmail) {
          const got = normEmail(r.ok ? r.payload : undefined);
          if (got !== normEmail(c.expectedEmail)) {
            emailMisses.push('[' + c.context + '] "' + c.utterance + '" email -> "' + got + '" (esperado "' + c.expectedEmail + '")');
          }
        }
      }

      if (ok) {
        hits++;
        bucket.hits++;
      } else {
        const got = r.ok ? r.type + (r.payload ? ' payload="' + r.payload + '"' : '') : 'DECLINA:' + r.reason;
        const exp = c.expected === null ? '<<declinar>>' : c.expected;
        misses.push('[' + c.kind + '/' + c.context + '] "' + c.utterance + '" -> ' + got + ' (esperado ' + exp + ')');
      }
    }

    const acc = hits / PHRASE_BANK_XL.length;
    /* eslint-disable no-console */
    console.log('\n=== Brain XL efficiency bench ===');
    console.log('TOTAL: ' + hits + '/' + PHRASE_BANK_XL.length + ' = ' + (acc * 100).toFixed(1) + '%');
    for (const k of Object.keys(byKind).sort()) {
      const b = byKind[k];
      if (!b) continue;
      console.log('  ' + k.padEnd(10) + ': ' + b.hits + '/' + b.total + ' = ' + ((b.hits / b.total) * 100).toFixed(1) + '%');
    }
    if (misses.length > 0) {
      console.log('\nFALLOS de ruteo:');
      for (const m of misses) console.log('  - ' + m);
    }
    if (emailMisses.length > 0) {
      console.log('\nFALLOS de email (ruteo OK, email distinto):');
      for (const m of emailMisses) console.log('  - ' + m);
    }
    /* eslint-enable no-console */
    expect(acc).toBeGreaterThanOrEqual(MIN_ACC);
  }, 300000);
});
