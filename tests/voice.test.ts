import { describe, it, expect } from 'vitest';
import {
  parseCommand, extractEmail, COMMAND_CATALOG,
  FIELD_SPECS_BY_CONTEXT, spokenFieldValue, spokenCheckboxValue,
  isAllowedWhileDictating,
} from '../src/voice/commands.js';

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

describe('parseCommand -- settings field dictation (F10 voice parity)', () => {
  it('"campo correo" arms the email field', () => {
    const c = parseCommand('campo correo', 'settings_dialog');
    expect(c.type).toBe('ENFOCAR_CAMPO');
    expect(c.payload).toBe('correo');
  });

  it('accent-tolerant: "campo contraseña"', () => {
    const c = parseCommand('campo contraseña', 'settings_dialog');
    expect(c.type).toBe('ENFOCAR_CAMPO');
    expect(c.payload).toBe('contrasena');
  });

  it('article-tolerant: "ir al campo de la cuenta"', () => {
    const c = parseCommand('ir al campo de la cuenta', 'settings_dialog');
    expect(c.type).toBe('ENFOCAR_CAMPO');
    expect(c.payload).toBe('correo');
  });

  it('two-word fields: "campo servidor imap" / "campo puerto smtp"', () => {
    expect(parseCommand('campo servidor imap', 'settings_dialog').payload).toBe('servidor_imap');
    expect(parseCommand('campo puerto smtp', 'settings_dialog').payload).toBe('puerto_smtp');
  });

  it('unknown field name stays ENFOCAR_CAMPO with no payload (App announces the options)', () => {
    const c = parseCommand('campo zapato', 'settings_dialog');
    expect(c.type).toBe('ENFOCAR_CAMPO');
    expect(c.payload).toBeUndefined();
  });

  it('"borrar campo" -> BORRAR_CAMPO targeting the armed field', () => {
    const c = parseCommand('borrar campo', 'settings_dialog');
    expect(c.type).toBe('BORRAR_CAMPO');
    expect(c.payload).toBeUndefined();
  });

  it('"limpiar campo correo" -> BORRAR_CAMPO with field payload (clears, does not arm)', () => {
    const c = parseCommand('limpiar campo correo', 'settings_dialog');
    expect(c.type).toBe('BORRAR_CAMPO');
    expect(c.payload).toBe('correo');
  });

  it('"campo" commands are modal-only: UNKNOWN in global', () => {
    expect(parseCommand('campo correo', 'global').type).toBe('UNKNOWN');
  });

  it('a settings field name in another modal arms nothing (App announces that modal\'s options)', () => {
    const c = parseCommand('campo servidor imap', 'send_dialog');
    expect(c.type).toBe('ENFOCAR_CAMPO');
    expect(c.payload).toBeUndefined();
  });

  it('"fin campo" releases the armed field (FIN_CAMPO), in its variants', () => {
    expect(parseCommand('fin campo', 'settings_dialog').type).toBe('FIN_CAMPO');
    expect(parseCommand('fin de campo', 'settings_dialog').type).toBe('FIN_CAMPO');
    expect(parseCommand('listo campo', 'settings_dialog').type).toBe('FIN_CAMPO');
    expect(parseCommand('cerrar campo', 'settings_dialog').type).toBe('FIN_CAMPO');
  });

  it('settings keeps verb-first semantics while armed: "guardar" still saves', () => {
    expect(parseCommand('guardar', 'settings_dialog', { armed: true }).type).toBe('GUARDAR_CONFIG');
  });
});

describe('parseCommand -- send_dialog field dictation (PND-003)', () => {
  it('"campo destinatario" arms the recipients field', () => {
    const c = parseCommand('campo destinatario', 'send_dialog');
    expect(c.type).toBe('ENFOCAR_CAMPO');
    expect(c.payload).toBe('destinatario');
  });

  it('"campo asunto" / "campo cuerpo" / "campo adjuntar" arm their fields', () => {
    expect(parseCommand('campo asunto', 'send_dialog').payload).toBe('asunto');
    expect(parseCommand('campo cuerpo', 'send_dialog').payload).toBe('cuerpo');
    expect(parseCommand('campo mensaje', 'send_dialog').payload).toBe('cuerpo');
    expect(parseCommand('campo adjuntar', 'send_dialog').payload).toBe('adjuntar');
  });

  it('ARMED: a lone "enviar" mid-dictation must NOT confirm the send', () => {
    expect(parseCommand('enviar', 'send_dialog', { armed: true }).type).toBe('UNKNOWN');
    expect(parseCommand('te enviare los detalles pronto', 'send_dialog', { armed: true }).type).toBe('UNKNOWN');
  });

  it('ARMED: "cancelar" inside a dictated sentence does not close the dialog', () => {
    expect(parseCommand('tuve que cancelar la reunion', 'send_dialog', { armed: true }).type).toBe('UNKNOWN');
  });

  it('ARMED: field-control phrases still work', () => {
    expect(parseCommand('fin campo', 'send_dialog', { armed: true }).type).toBe('FIN_CAMPO');
    expect(parseCommand('borrar campo', 'send_dialog', { armed: true }).type).toBe('BORRAR_CAMPO');
    expect(parseCommand('campo asunto', 'send_dialog', { armed: true }).type).toBe('ENFOCAR_CAMPO');
  });

  it('ARMED: mic safety still passes through', () => {
    expect(parseCommand('apagar microfono', 'send_dialog', { armed: true }).type).toBe('APAGAR_MICROFONO');
    expect(parseCommand('detener voz', 'send_dialog', { armed: true }).type).toBe('DETENER_VOZ');
  });

  it('NOT armed: "enviar" confirms as before (no regression)', () => {
    expect(parseCommand('enviar', 'send_dialog', { armed: false }).type).toBe('CONFIRMAR_ENVIO');
    expect(parseCommand('enviar', 'send_dialog').type).toBe('CONFIRMAR_ENVIO');
  });
});

describe('parseCommand -- signature_pad field dictation (PND-003)', () => {
  it('"campo nombre" arms the typed-name field', () => {
    const c = parseCommand('campo nombre', 'signature_pad');
    expect(c.type).toBe('ENFOCAR_CAMPO');
    expect(c.payload).toBe('nombre');
  });

  it('ARMED: a name containing a pad verb is dictation, not a command', () => {
    expect(parseCommand('Guadalupe Borrero', 'signature_pad', { armed: true }).type).toBe('UNKNOWN');
    expect(parseCommand('guardar', 'signature_pad', { armed: true }).type).toBe('UNKNOWN');
  });

  it('ARMED: "fin campo" releases; verbs come back when not armed', () => {
    expect(parseCommand('fin campo', 'signature_pad', { armed: true }).type).toBe('FIN_CAMPO');
    expect(parseCommand('guardar', 'signature_pad', { armed: false }).type).toBe('GUARDAR_FIRMA_PAD');
  });
});

describe('spokenFieldValue -- dictated values per field kind', () => {
  it('email: spoken form "ana arroba ejemplo punto com"', () => {
    expect(spokenFieldValue('ana arroba ejemplo punto com', 'email')).toBe('ana@ejemplo.com');
  });

  it('email: literal form passes through lowercased', () => {
    expect(spokenFieldValue('Ana@Ejemplo.com', 'email')).toBe('ana@ejemplo.com');
  });

  it('host: "imap punto gmail punto com"', () => {
    expect(spokenFieldValue('imap punto gmail punto com', 'host')).toBe('imap.gmail.com');
  });

  it('host: "guion" becomes a dash', () => {
    expect(spokenFieldValue('mail guion in punto ejemplo punto com', 'host')).toBe('mail-in.ejemplo.com');
  });

  it('port: digits survive, spaces dropped', () => {
    expect(spokenFieldValue('9 9 3', 'port')).toBe('993');
    expect(spokenFieldValue('993', 'port')).toBe('993');
  });

  it('port: spoken digit words', () => {
    expect(spokenFieldValue('nueve nueve tres', 'port')).toBe('993');
  });

  it('port: non-numeric utterance yields empty (App re-asks)', () => {
    expect(spokenFieldValue('no se', 'port')).toBe('');
  });

  it('password: spaced groups joined, casing kept', () => {
    expect(spokenFieldValue('abcd EFGH ijkl mnop', 'password')).toBe('abcdEFGHijklmnop');
  });

  it('text: kept as spoken, trimmed', () => {
    expect(spokenFieldValue('  Pablo Kuschnirof ', 'text')).toBe('Pablo Kuschnirof');
  });

  it('recipients: one spoken address', () => {
    expect(spokenFieldValue('ana arroba ejemplo punto com', 'recipients')).toBe('ana@ejemplo.com');
  });

  it('recipients: several addresses joined with "y" -> comma-separated', () => {
    expect(spokenFieldValue('ana arroba ejemplo punto com y pedro arroba test punto org', 'recipients'))
      .toBe('ana@ejemplo.com, pedro@test.org');
  });

  it('recipients: spoken "coma" separator', () => {
    expect(spokenFieldValue('ana arroba a punto com coma pedro arroba b punto com', 'recipients'))
      .toBe('ana@a.com, pedro@b.com');
  });

  it('recipients: literal comma-separated list passes through', () => {
    expect(spokenFieldValue('Ana@A.com, pedro@b.com', 'recipients')).toBe('ana@a.com, pedro@b.com');
  });

  it('recipients: no recognisable email falls back to compacted text (App shows it for correction)', () => {
    expect(spokenFieldValue('pepito', 'recipients')).toBe('pepito');
  });

  it('body: utterance kept verbatim (punctuation + casing), only trimmed', () => {
    expect(spokenFieldValue('  Hola Ana, te mando el informe.  ', 'body')).toBe('Hola Ana, te mando el informe.');
  });
});

describe('spokenCheckboxValue', () => {
  it('affirmatives', () => {
    expect(spokenCheckboxValue('si')).toBe(true);
    expect(spokenCheckboxValue('sí')).toBe(true);
    expect(spokenCheckboxValue('activar')).toBe(true);
  });

  it('negatives', () => {
    expect(spokenCheckboxValue('no')).toBe(false);
    expect(spokenCheckboxValue('apagado')).toBe(false);
  });

  it('anything else is undefined (App re-asks instead of guessing)', () => {
    expect(spokenCheckboxValue('quizas')).toBeUndefined();
  });
});

describe('COMMAND_CATALOG', () => {
  it('lists exactly 15 global user-facing phrases (14 + agregar contacto, PND-028)', () => {
    expect(COMMAND_CATALOG.filter((c) => !c.context).length).toBe(15);
  });

  it('covers the three modal contexts with contextual entries', () => {
    const contexts = new Set(COMMAND_CATALOG.filter((c) => c.context).map((c) => c.context));
    expect(contexts.has('send_dialog')).toBe(true);
    expect(contexts.has('signature_pad')).toBe(true);
    expect(contexts.has('settings_dialog')).toBe(true);
  });

  it('every contextual entry names the data-nac-action it drives (or is field-scoped)', () => {
    for (const c of COMMAND_CATALOG.filter((e) => e.context)) {
      expect(c.nac_action ?? c.field_scope, c.type).toBeTruthy();
    }
  });

  it('every contextual entry actually parses to its own type in its context', () => {
    for (const c of COMMAND_CATALOG.filter((e) => e.context)) {
      expect(parseCommand(c.sample, c.context).type, c.sample).toBe(c.type);
    }
  });

  it('every dictatable field of every modal has its ENFOCAR_CAMPO catalog entry (help screens stay complete)', () => {
    const voicedFields = new Set(
      COMMAND_CATALOG.filter((c) => c.type === 'ENFOCAR_CAMPO').map((c) => c.nac_action),
    );
    for (const specs of Object.values(FIELD_SPECS_BY_CONTEXT)) {
      for (const spec of specs) {
        expect(voicedFields.has(spec.nac_action), spec.key).toBe(true);
      }
    }
  });

  it('every catalog entry has a sample + action', () => {
    for (const c of COMMAND_CATALOG) {
      expect(c.sample.length).toBeGreaterThan(0);
      expect(c.action.length).toBeGreaterThan(0);
    }
  });
});

/* PND-029 -- the tester said "leer bandeja" / "ver bandeja" / "bandeja"
 * and none read the inbox (the narrow matcher only knew the exact "leer
 * bandeja"; the rest fell to UNKNOWN and, mid-dictation, were written into
 * the document). These guard the widened recognition. */
describe('parseCommand -- LEER_BANDEJA expanded forms (PND-029)', () => {
  const PHRASES = [
    'leer bandeja',
    'leer la bandeja',
    'ver bandeja',           /* "ver" is a filler -> "bandeja" -> matches */
    'ver la bandeja',
    'bandeja',
    'bandeja de entrada',
    'leeme la bandeja',
    'mostrame la bandeja',
    'abrir la bandeja',
    'revisar la bandeja',
    'mostrar correos',
    'leer mis mensajes',
    'que correos tengo',
    'mis correos',
  ];
  for (const phrase of PHRASES) {
    it('"' + phrase + '" -> LEER_BANDEJA', () => {
      expect(parseCommand(phrase).type).toBe('LEER_BANDEJA');
    });
  }

  it('still suppressed inside a modal (only mic-safety passes there)', () => {
    expect(parseCommand('bandeja', 'send_dialog').type).toBe('UNKNOWN');
    expect(parseCommand('leer bandeja', 'settings_dialog').type).toBe('UNKNOWN');
  });
});

/* PND-029 -- Option B strict dictation contract. While dictation is on,
 * only ending dictation + the mic-safety trio may act as commands; every
 * other verb is dictated content, so the user must say "fin dictado" first.
 * This is the producer side of the rule the App's onVoiceCommand consumes. */
describe('isAllowedWhileDictating -- strict dictation allowlist (PND-029)', () => {
  it('lets dictation end + the mic-safety trio through', () => {
    for (const t of ['FIN_DICTADO', 'INICIAR_DICTADO', 'ENCENDER_MICROFONO', 'APAGAR_MICROFONO', 'DETENER_VOZ'] as const) {
      expect(isAllowedWhileDictating(t), t).toBe(true);
    }
  });

  it('captures every other verb as content (the tester-reported leak)', () => {
    for (const t of ['LEER_BANDEJA', 'ENVIAR', 'RESPONDER', 'REENVIAR', 'NUEVO_DOCUMENTO', 'FIRMAR', 'PONER_TITULO', 'ABRIR_CONTACTOS', 'AGREGAR_CONTACTO', 'ABRIR_CONFIGURACION', 'UNKNOWN'] as const) {
      expect(isAllowedWhileDictating(t), t).toBe(false);
    }
  });
});
