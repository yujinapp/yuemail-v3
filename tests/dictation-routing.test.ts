import { describe, it, expect } from 'vitest';
import { resolveLiterallyFirst } from '../src/voice/resolveCommand.js';

/**
 * Regression guard for PND-015 (tester case #8: "dictar texto en el documento").
 *
 * The bug had two halves, both caused by routing dictation through the slow
 * cloud Brain:
 *   1. "iniciar dictado" resolved LATE, so the first phrases spoken right
 *      after it were dropped (dictation was still off when they arrived).
 *   2. "fin dictado" resolved LATE, so the closing phrase was written into
 *      the document instead of stopping dictation.
 *
 * The fix routes the dictation toggles AND all content spoken while dictating
 * through the fast literal matcher (resolveLiterallyFirst), bypassing the
 * Brain. These tests pin that routing decision. They go RED if someone
 * reverts to "only use the literal matcher once dictation is already on"
 * (the old behaviour that lost the first phrases + wrote the closing one).
 *
 * NOTE: this guards the ROUTING half. The "only non-command utterances become
 * paragraphs" half is structural in App.onVoiceCommand (the toggles resolve to
 * their own command cases; only the default case appends), so the assertions
 * below also pin that the toggles resolve to commands, not to UNKNOWN content.
 */
describe('dictation routing -- resolveLiterallyFirst (PND-015)', () => {
  it('"iniciar dictado" routes literally even with dictation OFF (no Brain wait)', () => {
    const cmd = resolveLiterallyFirst('iniciar dictado', 'global', {}, false);
    expect(cmd).toBeDefined();
    expect(cmd?.type).toBe('INICIAR_DICTADO');
  });

  it('"fin dictado" routes literally while dictating, so it stops (never written)', () => {
    const cmd = resolveLiterallyFirst('fin dictado', 'global', {}, true);
    expect(cmd).toBeDefined();
    expect(cmd?.type).toBe('FIN_DICTADO');
  });

  it('"fin dictado" also routes literally with dictation OFF (toggle short-circuits)', () => {
    const cmd = resolveLiterallyFirst('fin dictado', 'global', {}, false);
    expect(cmd?.type).toBe('FIN_DICTADO');
  });

  it('a real phrase while dictating routes literally as content (UNKNOWN -> paragraph)', () => {
    const cmd = resolveLiterallyFirst('hola que tal como estas', 'global', {}, true);
    expect(cmd).toBeDefined();
    expect(cmd?.type).toBe('UNKNOWN');
  });

  it('a real phrase while NOT dictating defers to the Brain (undefined)', () => {
    const cmd = resolveLiterallyFirst('hola que tal como estas', 'global', {}, false);
    expect(cmd).toBeUndefined();
  });

  it('inside a modal it always defers to the Brain (toggles do not apply there)', () => {
    expect(resolveLiterallyFirst('iniciar dictado', 'send_dialog', {}, false)).toBeUndefined();
    expect(resolveLiterallyFirst('hola', 'settings_dialog', {}, true)).toBeUndefined();
  });
});
