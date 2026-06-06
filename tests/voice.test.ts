import { describe, it, expect } from 'vitest';
import { parseCommand, extractEmail, COMMAND_CATALOG } from '../src/voice/commands.js';

describe('parseCommand -- the 9 Spanish phrases (acceptance #5)', () => {
  it('NUEVO_DOCUMENTO: "nuevo documento"', () => {
    expect(parseCommand('nuevo documento').type).toBe('NUEVO_DOCUMENTO');
  });

  it('NUEVO_DOCUMENTO alt: "documento nuevo"', () => {
    expect(parseCommand('documento nuevo').type).toBe('NUEVO_DOCUMENTO');
  });

  it('ABRIR_DOCUMENTO without name', () => {
    expect(parseCommand('abrir documento').type).toBe('ABRIR_DOCUMENTO');
  });

  it('ABRIR_DOCUMENTO with name extracts payload', () => {
    const c = parseCommand('abrir documento informe trimestral');
    expect(c.type).toBe('ABRIR_DOCUMENTO');
    expect(c.payload).toBe('informe trimestral');
  });

  it('GUARDAR_FIRMA', () => {
    expect(parseCommand('guardar firma').type).toBe('GUARDAR_FIRMA');
  });

  it('FIRMAR (bare)', () => {
    expect(parseCommand('firmar').type).toBe('FIRMAR');
  });

  it('FIRMAR with "documento" suffix', () => {
    expect(parseCommand('firmar documento').type).toBe('FIRMAR');
  });

  it('INICIAR_DICTADO', () => {
    expect(parseCommand('iniciar dictado').type).toBe('INICIAR_DICTADO');
  });

  it('FIN_DICTADO', () => {
    expect(parseCommand('fin dictado').type).toBe('FIN_DICTADO');
  });

  it('ENVIAR with spoken email "enviar a ana arroba ejemplo punto com"', () => {
    const c = parseCommand('enviar a ana arroba ejemplo punto com');
    expect(c.type).toBe('ENVIAR');
    expect(c.payload).toBe('ana@ejemplo.com');
  });

  it('LEER_BANDEJA', () => {
    expect(parseCommand('leer bandeja').type).toBe('LEER_BANDEJA');
  });

  it('DETENER_VOZ', () => {
    expect(parseCommand('detener voz').type).toBe('DETENER_VOZ');
  });
});

describe('parseCommand -- accent-insensitive', () => {
  it('"nuevo documénto" matches NUEVO_DOCUMENTO', () => {
    expect(parseCommand('nuevo documénto').type).toBe('NUEVO_DOCUMENTO');
  });

  it('"firmár" matches FIRMAR (suffix-tolerant via "firmar documento")', () => {
    /* Accent-only on the base verb still matches since we strip diacritics. */
    expect(parseCommand('firmár documento').type).toBe('FIRMAR');
  });
});

describe('parseCommand -- filler-word-tolerant', () => {
  it('"por favor, nuevo documento" matches NUEVO_DOCUMENTO', () => {
    expect(parseCommand('por favor, nuevo documento').type).toBe('NUEVO_DOCUMENTO');
  });

  it('"eh, iniciar dictado" matches INICIAR_DICTADO', () => {
    expect(parseCommand('eh, iniciar dictado').type).toBe('INICIAR_DICTADO');
  });
});

describe('parseCommand -- mic toggle (F2 always-on)', () => {
  it('ENCENDER_MICROFONO', () => {
    expect(parseCommand('encender microfono').type).toBe('ENCENDER_MICROFONO');
  });

  it('APAGAR_MICROFONO', () => {
    expect(parseCommand('apagar microfono').type).toBe('APAGAR_MICROFONO');
  });
});

describe('parseCommand -- UNKNOWN fallback', () => {
  it('empty input', () => {
    expect(parseCommand('').type).toBe('UNKNOWN');
  });

  it('completely unrelated utterance', () => {
    expect(parseCommand('hola buenas como esta').type).toBe('UNKNOWN');
  });
});

describe('extractEmail', () => {
  it('handles "arroba" + "punto"', () => {
    expect(extractEmail('enviar a juan arroba dominio punto com')).toBe('juan@dominio.com');
  });

  it('handles literal "@" + "."', () => {
    expect(extractEmail('enviar a juan@dominio.com')).toBe('juan@dominio.com');
  });

  it('lowercases the result', () => {
    expect(extractEmail('Enviar a JUAN@DOMINIO.COM')).toBe('juan@dominio.com');
  });

  it('returns undefined when no email present', () => {
    expect(extractEmail('enviar el documento')).toBeUndefined();
  });
});

describe('COMMAND_CATALOG', () => {
  it('lists exactly 9 user-facing phrases (matches acceptance #5)', () => {
    expect(COMMAND_CATALOG.length).toBe(9);
  });

  it('every catalog entry has a sample + action', () => {
    for (const c of COMMAND_CATALOG) {
      expect(c.sample.length).toBeGreaterThan(0);
      expect(c.action.length).toBeGreaterThan(0);
    }
  });
});
