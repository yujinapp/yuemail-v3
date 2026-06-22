/**
 * Safety net (camino 2): with the Brain off / offline, the fixed-phrase
 * matcher MUST still route every canonical phrasing. A person who depends
 * on this app is never left without it, even with no key and no network.
 *
 * This is also the regression guard for the resolver's fallback path:
 * resolveCommand with a Brain that always misses == pure matcher behaviour.
 *
 * ASCII-only.
 */
import { describe, it, expect } from 'vitest';
import { resolveCommand } from '../../src/voice/resolveCommand.js';
import { parseCommand, extractEmail } from '../../src/voice/commands.js';
import { CANONICAL_CASES } from './phrase_bank.js';
import type { BrainResolveResponse } from '../../src/lib/api.js';

const brainDown = () => Promise.reject(new Error('offline'));
const brainMiss = () => Promise.resolve<BrainResolveResponse>({ ok: false, reason: 'no_key' });

describe('safety net covers every canonical phrase', () => {
  for (const c of CANONICAL_CASES) {
    it('matcher routes: "' + c.utterance + '" -> ' + c.expected, () => {
      const cmd = parseCommand(c.utterance, c.context);
      expect(cmd.type).toBe(c.expected);
      if (c.expectedEmail) expect(cmd.payload).toBe(c.expectedEmail);
    });
  }

  it('extractEmail handles spoken arroba/punto', () => {
    expect(extractEmail('enviar a ana arroba ejemplo punto com')).toBe('ana@ejemplo.com');
  });
});

describe('resolveCommand falls back to the matcher when the Brain is unavailable', () => {
  for (const c of CANONICAL_CASES) {
    it('brain offline: "' + c.utterance + '" -> ' + c.expected, async () => {
      const cmd = await resolveCommand(c.utterance, c.context, {}, { brainResolve: brainDown });
      expect(cmd.type).toBe(c.expected);
      if (c.expectedEmail) expect(cmd.payload).toBe(c.expectedEmail);
    });
    it('brain no-key: "' + c.utterance + '" -> ' + c.expected, async () => {
      const cmd = await resolveCommand(c.utterance, c.context, {}, { brainResolve: brainMiss });
      expect(cmd.type).toBe(c.expected);
    });
  }
});
