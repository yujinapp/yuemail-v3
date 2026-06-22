/**
 * Live end-to-end VOICE bench (v0.6.0).
 *
 * Proves the camino-1 ear pipe the way the user asked us to test it: speak
 * each phrase with Google Text-to-Speech, feed that audio back into Google
 * Speech-to-Text, then route the transcript through the Brain. No microphone
 * needed -- the synthesised voice IS the audio source.
 *
 *   text -> googleSynthesize -> audio -> googleTranscribe -> transcript
 *        -> resolveUtterance -> command
 *
 * Metric: COMMAND ACCURACY (did the phrase reach the right command?), not
 * letter-perfect transcription. Email payload is a secondary signal.
 *
 * Gated on VOICE_LIVE=1 so CI stays deterministic + free (each case spends
 * one TTS + one STT + one Brain round-trip of the user's Google quota). Run:
 *   # PowerShell
 *   $env:VOICE_LIVE=1; npx vitest run tests/voice/live-voice-bench.test.ts
 *   # bash
 *   VOICE_LIVE=1 npx vitest run tests/voice/live-voice-bench.test.ts
 *
 * Optional: VOICE_MIN_ACC (default 1.0) sets the pass threshold.
 *
 * HONESTY: synthetic TTS is a clean speaker, not atypical/dysarthric speech.
 * A 100% here means "the pipe + Brain route correctly in good audio
 * conditions"; the real number with atypical voices will be lower. The bench
 * prints that caveat with the result so nobody reads it as a user-population
 * figure.
 *
 * ASCII-only.
 */
import { describe, it, expect } from 'vitest';
import { googleSynthesize, googleTranscribe } from '../../server/voice/google.js';
import { resolveUtterance } from '../../server/brain/router.js';
import type { BrainContext } from '../../server/brain/catalog.js';
import { VOICE_PHRASE_BANK, type VoiceCase } from './phrase_bank.js';

const LIVE = process.env['VOICE_LIVE'] === '1';
const MIN_ACC = process.env['VOICE_MIN_ACC'] ? Number(process.env['VOICE_MIN_ACC']) : 1.0;

function normEmail(s: string | undefined): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, '').replace(/mailto:/, '').trim();
}

describe.skipIf(!LIVE)('live voice end-to-end bench (TTS -> STT -> Brain)', () => {
  it('routes the spoken phrase bank at or above the accuracy threshold', async () => {
    const byKind: Record<string, { hits: number; total: number }> = {};
    const misses: string[] = [];
    const emailMisses: string[] = [];
    const transcripts: string[] = [];
    let hits = 0;

    for (const c of VOICE_PHRASE_BANK as VoiceCase[]) {
      /* 1. speak the phrase */
      const tts = await googleSynthesize({ text: c.text, language: 'es-AR', format: 'mp3' });
      /* 2. hear it back */
      const stt = await googleTranscribe({ audio: tts.audio, format: 'mp3', languageHint: 'es-AR' });
      const heard = stt.text;
      transcripts.push('[' + c.kind + '] "' + c.text + '" -> oyo "' + heard + '" (conf ' + (stt.confidence ?? 0).toFixed(2) + ')');

      /* 3. route the transcript */
      const r = await resolveUtterance(heard, c.context as BrainContext);

      const bucket = (byKind[c.kind] ??= { hits: 0, total: 0 });
      bucket.total++;

      let ok: boolean;
      if (c.expected === null) {
        ok = !r.ok; /* negative: success = Brain declined -> app falls back */
      } else {
        ok = r.ok && r.type === c.expected;
        if (ok && c.expectedEmail) {
          const got = normEmail(r.ok ? r.payload : undefined);
          if (got !== normEmail(c.expectedEmail)) {
            emailMisses.push('"' + c.text + '" email -> "' + got + '" (esperado "' + c.expectedEmail + '")');
          }
        }
      }

      if (ok) { hits++; bucket.hits++; }
      else {
        const got = r.ok ? r.type + (r.payload ? ' payload="' + r.payload + '"' : '') : 'DECLINA:' + r.reason;
        const exp = c.expected === null ? '<<declinar>>' : c.expected;
        misses.push('[' + c.kind + '/' + c.context + '] dijo "' + c.text + '" / oyo "' + heard + '" -> ' + got + ' (esperado ' + exp + ')');
      }
    }

    const acc = hits / VOICE_PHRASE_BANK.length;
    /* eslint-disable no-console */
    console.log('\n=== Voice end-to-end bench (TTS -> STT -> Brain) ===');
    console.log('TOTAL: ' + hits + '/' + VOICE_PHRASE_BANK.length + ' = ' + (acc * 100).toFixed(1) + '% de acierto de COMANDO');
    console.log('NOTA: la voz sintetica es un hablante limpio; el numero real con voz atipica sera menor.');
    for (const k of Object.keys(byKind).sort()) {
      const b = byKind[k];
      if (!b) continue;
      console.log('  ' + k.padEnd(10) + ': ' + b.hits + '/' + b.total + ' = ' + ((b.hits / b.total) * 100).toFixed(1) + '%');
    }
    if (misses.length > 0) {
      console.log('\nFALLOS de comando:');
      for (const m of misses) console.log('  - ' + m);
    }
    if (emailMisses.length > 0) {
      console.log('\nFALLOS de email (comando OK, email distinto):');
      for (const m of emailMisses) console.log('  - ' + m);
    }
    console.log('\nTranscripciones (lo que oyo el sistema):');
    for (const t of transcripts) console.log('  ' + t);
    /* eslint-enable no-console */

    expect(acc).toBeGreaterThanOrEqual(MIN_ACC);
  }, 600000);
});
