import { describe, it, expect } from 'vitest';
import { resolveLiterallyFirst } from '../src/voice/resolveCommand.js';
import {
  parseCommand,
  isDictationToggleWord,
  isDictationStopUtterance,
} from '../src/voice/commands.js';

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

/**
 * Tester case #8, second pass (PND-016): the toggle still fired in the unit
 * test but the user's "fin dictado" got WRITTEN. Root cause: the cloud
 * speech-to-text returns natural VARIANTS ("fin del dictado", "detener
 * dictado", "iniciar el dictado") that the narrow canonical patterns missed,
 * so the closing words fell through to the document-content path. These pin
 * the widened recognition. Each case is RED before the pattern widening:
 * the variant resolved to UNKNOWN and, while dictating, would have been
 * pasted as a paragraph.
 */
describe('dictation toggle variants the recogniser really emits (PND-016)', () => {
  const STOP_VARIANTS = [
    'fin dictado',
    'fin de dictado',
    'fin del dictado',
    'finalizar dictado',
    'finalizar el dictado',
    'terminar el dictado',
    'parar el dictado',
    'detener dictado',
    'detener el dictado',
    'cortar el dictado',
    'dictado apagado',
    'dictado terminado',
  ];
  const START_VARIANTS = [
    'iniciar dictado',
    'iniciar el dictado',
    'comenzar dictado',
    'comenzar el dictado',
    'empezar el dictado',
    'arrancar el dictado',
    'activar el dictado',
    'empezar a dictar',
    'dictado encendido',
  ];

  for (const phrase of STOP_VARIANTS) {
    it(`"${phrase}" stops dictation, never written (while dictating)`, () => {
      expect(parseCommand(phrase, 'global').type).toBe('FIN_DICTADO');
      expect(resolveLiterallyFirst(phrase, 'global', {}, true)?.type).toBe('FIN_DICTADO');
    });
  }

  for (const phrase of START_VARIANTS) {
    it(`"${phrase}" starts dictation instantly (dictation OFF)`, () => {
      expect(parseCommand(phrase, 'global').type).toBe('INICIAR_DICTADO');
      expect(resolveLiterallyFirst(phrase, 'global', {}, false)?.type).toBe('INICIAR_DICTADO');
    });
  }

  it('a normal dictated sentence that merely mentions "dictado" is still content', () => {
    /* No toggle verb -> stays UNKNOWN -> becomes a paragraph. Guards against
     * the widening over-matching ordinary speech. */
    expect(parseCommand('esto es un dictado de prueba para el informe', 'global').type).toBe('UNKNOWN');
    expect(parseCommand('hoy escribo un dictado largo', 'global').type).toBe('UNKNOWN');
  });
});

/**
 * Single-word "dictado" TOGGLE (PND-030, owner's "seamos practicos"). One short
 * word flips capture: with dictation OFF it starts, with dictation ON it stops.
 * The same word means both directions, so the resolution is state-driven in
 * resolveLiterallyFirst. The longer "iniciar dictado" / "fin dictado" pair
 * still works (covered above); these pin the new short form.
 */
describe('single-word "dictado" toggle (PND-030)', () => {
  const TOGGLE_WORDS = ['dictado', 'dictar', 'Dictado', '  dictado  ', 'por favor dictado'];

  for (const phrase of TOGGLE_WORDS) {
    it(`"${phrase}" starts dictation when OFF`, () => {
      expect(resolveLiterallyFirst(phrase, 'global', {}, false)?.type).toBe('INICIAR_DICTADO');
    });
    it(`"${phrase}" stops dictation when ON`, () => {
      expect(resolveLiterallyFirst(phrase, 'global', {}, true)?.type).toBe('FIN_DICTADO');
    });
  }

  it('the toggle short-circuits the Brain in both directions (never undefined)', () => {
    expect(resolveLiterallyFirst('dictado', 'global', {}, false)).toBeDefined();
    expect(resolveLiterallyFirst('dictado', 'global', {}, true)).toBeDefined();
  });

  it('isDictationToggleWord matches only the bare word, not a sentence', () => {
    expect(isDictationToggleWord('dictado')).toBe(true);
    expect(isDictationToggleWord('dictar')).toBe(true);
    expect(isDictationToggleWord('iniciar dictado')).toBe(false);
    expect(isDictationToggleWord('un dictado largo')).toBe(false);
  });

  it('isDictationStopUtterance treats the bare word AND the fin variants as stop', () => {
    expect(isDictationStopUtterance('dictado')).toBe(true);
    expect(isDictationStopUtterance('fin dictado')).toBe(true);
    expect(isDictationStopUtterance('detener el dictado')).toBe(true);
    /* A real sentence mentioning the word is NOT a stop -> stays content. */
    expect(isDictationStopUtterance('esto es un dictado de prueba')).toBe(false);
  });

  it('a sentence that merely contains "dictado" is NOT a toggle while dictating', () => {
    /* It must stay content (UNKNOWN), so strict-mode writes it as a paragraph. */
    expect(resolveLiterallyFirst('te mando el dictado de la maestra', 'global', {}, true)?.type).toBe('UNKNOWN');
  });
});
