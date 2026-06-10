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

  it('ABRIR_CONFIGURACION: "abrir configuracion"', () => {
    expect(parseCommand('abrir configuracion').type).toBe('ABRIR_CONFIGURACION');
  });

  it('ABRIR_CONFIGURACION alt: "ajustes" / "configurar correo"', () => {
    expect(parseCommand('ajustes').type).toBe('ABRIR_CONFIGURACION');
    expect(parseCommand('configurar el correo').type).toBe('ABRIR_CONFIGURACION');
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

describe('parseCommand -- contextual: send_dialog', () => {
  it('"confirmar envio" -> CONFIRMAR_ENVIO', () => {
    expect(parseCommand('confirmar envio', 'send_dialog').type).toBe('CONFIRMAR_ENVIO');
  });

  it('"enviar" inside the dialog confirms instead of re-opening it', () => {
    expect(parseCommand('enviar', 'send_dialog').type).toBe('CONFIRMAR_ENVIO');
  });

  it('"cancelar" -> CANCELAR', () => {
    expect(parseCommand('cancelar', 'send_dialog').type).toBe('CANCELAR');
  });

  it('"cerrar" -> CANCELAR', () => {
    expect(parseCommand('cerrar', 'send_dialog').type).toBe('CANCELAR');
  });

  it('suppresses global commands: "firmar" is UNKNOWN with the dialog open', () => {
    expect(parseCommand('firmar', 'send_dialog').type).toBe('UNKNOWN');
  });

  it('suppresses dictation start with the dialog open', () => {
    expect(parseCommand('iniciar dictado', 'send_dialog').type).toBe('UNKNOWN');
  });

  it('mic safety passes through: "apagar microfono" still works', () => {
    expect(parseCommand('apagar microfono', 'send_dialog').type).toBe('APAGAR_MICROFONO');
  });

  it('mic safety passes through: "detener voz" still works', () => {
    expect(parseCommand('detener voz', 'send_dialog').type).toBe('DETENER_VOZ');
  });
});

describe('parseCommand -- contextual: signature_pad', () => {
  it('"guardar" -> GUARDAR_FIRMA_PAD (saves, does not re-open the pad)', () => {
    expect(parseCommand('guardar', 'signature_pad').type).toBe('GUARDAR_FIRMA_PAD');
  });

  it('"guardar firma" inside the pad saves instead of re-opening', () => {
    expect(parseCommand('guardar firma', 'signature_pad').type).toBe('GUARDAR_FIRMA_PAD');
  });

  it('"borrar" -> BORRAR_FIRMA', () => {
    expect(parseCommand('borrar', 'signature_pad').type).toBe('BORRAR_FIRMA');
  });

  it('"generar firma cursiva" -> GENERAR_FIRMA', () => {
    expect(parseCommand('generar firma cursiva', 'signature_pad').type).toBe('GENERAR_FIRMA');
  });

  it('"cancelar" -> CANCELAR', () => {
    expect(parseCommand('cancelar', 'signature_pad').type).toBe('CANCELAR');
  });

  it('suppresses global commands: "firmar" must NOT insert into the doc behind the pad', () => {
    expect(parseCommand('firmar', 'signature_pad').type).toBe('UNKNOWN');
  });

  it('filler-tolerant in context: "por favor, cancelar"', () => {
    expect(parseCommand('por favor, cancelar', 'signature_pad').type).toBe('CANCELAR');
  });
});

describe('parseCommand -- contextual: settings_dialog', () => {
  it('"detectar servidores" -> DETECTAR_SERVIDORES', () => {
    expect(parseCommand('detectar servidores', 'settings_dialog').type).toBe('DETECTAR_SERVIDORES');
  });

  it('"configuracion automatica" -> DETECTAR_SERVIDORES', () => {
    expect(parseCommand('configuracion automatica', 'settings_dialog').type).toBe('DETECTAR_SERVIDORES');
  });

  it('"probar conexion" -> PROBAR_CONEXION', () => {
    expect(parseCommand('probar conexion', 'settings_dialog').type).toBe('PROBAR_CONEXION');
  });

  it('"guardar" -> GUARDAR_CONFIG (saves the settings, not the signature)', () => {
    expect(parseCommand('guardar', 'settings_dialog').type).toBe('GUARDAR_CONFIG');
  });

  it('"cancelar" / "cerrar" -> CANCELAR', () => {
    expect(parseCommand('cancelar', 'settings_dialog').type).toBe('CANCELAR');
    expect(parseCommand('cerrar', 'settings_dialog').type).toBe('CANCELAR');
  });

  it('suppresses global commands: "firmar" is UNKNOWN with settings open', () => {
    expect(parseCommand('firmar', 'settings_dialog').type).toBe('UNKNOWN');
  });

  it('mic safety passes through: "apagar microfono" still works', () => {
    expect(parseCommand('apagar microfono', 'settings_dialog').type).toBe('APAGAR_MICROFONO');
  });
});

describe('COMMAND_CATALOG', () => {
  it('lists exactly 10 global user-facing phrases (acceptance #5 base 9 + settings F10)', () => {
    expect(COMMAND_CATALOG.filter((c) => !c.context).length).toBe(10);
  });

  it('covers the three modal contexts with contextual entries', () => {
    const contexts = new Set(COMMAND_CATALOG.filter((c) => c.context).map((c) => c.context));
    expect(contexts.has('send_dialog')).toBe(true);
    expect(contexts.has('signature_pad')).toBe(true);
    expect(contexts.has('settings_dialog')).toBe(true);
  });

  it('every contextual entry names the data-nac-action it drives', () => {
    for (const c of COMMAND_CATALOG.filter((e) => e.context)) {
      expect(c.nac_action, c.type).toBeTruthy();
    }
  });

  it('every contextual entry actually parses to its own type in its context', () => {
    for (const c of COMMAND_CATALOG.filter((e) => e.context)) {
      expect(parseCommand(c.sample, c.context).type, c.sample).toBe(c.type);
    }
  });

  it('every catalog entry has a sample + action', () => {
    for (const c of COMMAND_CATALOG) {
      expect(c.sample.length).toBeGreaterThan(0);
      expect(c.action.length).toBeGreaterThan(0);
    }
  });
});
