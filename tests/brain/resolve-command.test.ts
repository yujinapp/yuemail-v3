/**
 * Camino-1 client resolver -- Brain leads, fixed-phrase matcher is the
 * safety net. Uses an injected brainResolve stub: no network.
 *
 * ASCII-only.
 */
import { describe, it, expect } from 'vitest';
import { resolveCommand } from '../../src/voice/resolveCommand.js';
import type { BrainResolveResponse } from '../../src/lib/api.js';

function brain(resp: BrainResolveResponse) {
  return () => Promise.resolve(resp);
}
const miss: BrainResolveResponse = { ok: false, reason: 'low_confidence' };

describe('resolveCommand (camino 1)', () => {
  it('uses the Brain choice when it succeeds', async () => {
    const cmd = await resolveCommand('mandale esto a mi hija', 'global', {}, {
      brainResolve: brain({ ok: true, type: 'ENVIAR', payload: 'ana@ejemplo.com', confidence: 0.9, source: 'brain', model: 'm' }),
    });
    expect(cmd.type).toBe('ENVIAR');
    expect(cmd.payload).toBe('ana@ejemplo.com');
  });

  it('mines the email from the raw utterance when the Brain payload is empty', async () => {
    const cmd = await resolveCommand('enviar a ana arroba ejemplo punto com', 'global', {}, {
      brainResolve: brain({ ok: true, type: 'ENVIAR', payload: '', confidence: 0.9, source: 'brain', model: 'm' }),
    });
    expect(cmd.type).toBe('ENVIAR');
    expect(cmd.payload).toBe('ana@ejemplo.com');
  });

  it('falls back to the matcher on a Brain miss', async () => {
    const cmd = await resolveCommand('nuevo documento', 'global', {}, { brainResolve: brain(miss) });
    expect(cmd.type).toBe('NUEVO_DOCUMENTO');
  });

  it('falls back to the matcher when the Brain call throws', async () => {
    const cmd = await resolveCommand('leer bandeja', 'global', {}, {
      brainResolve: () => Promise.reject(new Error('network')),
    });
    expect(cmd.type).toBe('LEER_BANDEJA');
  });

  it('resolves a field name to its key for ENFOCAR_CAMPO', async () => {
    const cmd = await resolveCommand('quiero poner mi correo', 'settings_dialog', {}, {
      brainResolve: brain({ ok: true, type: 'ENFOCAR_CAMPO', payload: 'correo', confidence: 0.9, source: 'brain', model: 'm' }),
    });
    expect(cmd.type).toBe('ENFOCAR_CAMPO');
    expect(cmd.payload).toBe('correo');
  });

  it('falls back when the Brain picks ENFOCAR_CAMPO for an unknown field', async () => {
    /* Unresolvable field -> matcher; "cancelar" is a clean settings verb. */
    const cmd = await resolveCommand('cancelar', 'settings_dialog', {}, {
      brainResolve: brain({ ok: true, type: 'ENFOCAR_CAMPO', payload: 'gibberish', confidence: 0.9, source: 'brain', model: 'm' }),
    });
    expect(cmd.type).toBe('CANCELAR');
  });

  it('bypasses the Brain while a field is armed in a modal (dictation precedence)', async () => {
    let called = false;
    const cmd = await resolveCommand('mandale saludos a todos', 'send_dialog', { armed: true }, {
      brainResolve: () => { called = true; return Promise.resolve(miss); },
    });
    expect(called).toBe(false);
    /* Armed dictation -> matcher returns UNKNOWN so the App stores it as the field value. */
    expect(cmd.type).toBe('UNKNOWN');
  });
});
