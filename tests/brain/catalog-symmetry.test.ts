/**
 * Producer/consumer symmetry (SQ 14): every command the Brain may pick MUST
 * be a command the client can dispatch. A Brain command id that is not a
 * VoiceCommandType would make the AI choose an action the UI cannot run.
 *
 * ASCII-only.
 */
import { describe, it, expect } from 'vitest';
import { allBrainCommandTypes, COMMANDS_BY_CONTEXT, type BrainContext } from '../../server/brain/catalog.js';
import { ALL_VOICE_COMMAND_TYPES } from '../../src/voice/commands.js';

describe('brain catalog symmetry', () => {
  const clientTypes = new Set<string>(ALL_VOICE_COMMAND_TYPES);

  it('every brain command type is a dispatchable client command', () => {
    for (const t of allBrainCommandTypes()) {
      expect(clientTypes.has(t), 'brain type not dispatchable by client: ' + t).toBe(true);
    }
  });

  it('the brain never offers UNKNOWN as a choice', () => {
    expect(allBrainCommandTypes().has('UNKNOWN')).toBe(false);
  });

  it('every context exposes at least one command', () => {
    for (const ctx of Object.keys(COMMANDS_BY_CONTEXT) as BrainContext[]) {
      expect(COMMANDS_BY_CONTEXT[ctx].length).toBeGreaterThan(0);
    }
  });

  it('every command spec carries a description and examples', () => {
    for (const ctx of Object.keys(COMMANDS_BY_CONTEXT) as BrainContext[]) {
      for (const spec of COMMANDS_BY_CONTEXT[ctx]) {
        expect(spec.description.length, ctx + '/' + spec.type).toBeGreaterThan(0);
        expect(spec.examples.length, ctx + '/' + spec.type).toBeGreaterThan(0);
      }
    }
  });
});
