/**
 * Voice command parser (F2 / acceptance #5).
 *
 * Recognises 9 Spanish phrases (accent-insensitive, filler-word-tolerant):
 *
 *   nuevo documento / documento nuevo  -> NUEVO_DOCUMENTO
 *   abrir documento [nombre]           -> ABRIR_DOCUMENTO (payload = nombre)
 *   guardar firma                      -> GUARDAR_FIRMA
 *   firmar                             -> FIRMAR
 *   iniciar dictado                    -> INICIAR_DICTADO
 *   fin dictado                        -> FIN_DICTADO
 *   enviar a <email>                   -> ENVIAR (payload = email)
 *   leer bandeja                       -> LEER_BANDEJA
 *   detener voz                        -> DETENER_VOZ
 *
 * Plus the always-on mic-toggle pair from F2:
 *   encender microfono                 -> ENCENDER_MICROFONO
 *   apagar microfono                   -> APAGAR_MICROFONO
 *
 * Plus contextual commands while a modal is open (VoiceContext):
 *   send_dialog:   confirmar/enviar -> CONFIRMAR_ENVIO, cancelar/cerrar -> CANCELAR
 *   signature_pad: guardar -> GUARDAR_FIRMA_PAD, borrar -> BORRAR_FIRMA,
 *                  generar -> GENERAR_FIRMA, cancelar/cerrar -> CANCELAR
 * With a modal open, global commands are suppressed except the mic pair
 * + detener voz.
 *
 * Email parsing recognises spoken "arroba" as "@" and "punto" as ".".
 * The extracted email is lowercased.
 *
 * ASCII-only.
 */

export type VoiceCommandType =
  | 'NUEVO_DOCUMENTO'
  | 'ABRIR_DOCUMENTO'
  | 'GUARDAR_FIRMA'
  | 'FIRMAR'
  | 'INICIAR_DICTADO'
  | 'FIN_DICTADO'
  | 'ENVIAR'
  | 'LEER_BANDEJA'
  | 'DETENER_VOZ'
  | 'ENCENDER_MICROFONO'
  | 'APAGAR_MICROFONO'
  /* Contextual (modal-only) commands. Active only while the matching
   * dialog is open; see VoiceContext. */
  | 'CONFIRMAR_ENVIO'
  | 'CANCELAR'
  | 'GUARDAR_FIRMA_PAD'
  | 'BORRAR_FIRMA'
  | 'GENERAR_FIRMA'
  | 'UNKNOWN';

/**
 * Where the utterance is being parsed. With a modal open, global commands
 * are suppressed (except the mic-safety pair + "detener voz") so a phrase
 * like "firmar" cannot reach the document behind the dialog. Each context
 * exposes its own small command set instead.
 */
export type VoiceContext = 'global' | 'send_dialog' | 'signature_pad';

export interface VoiceCommand {
  type:     VoiceCommandType;
  payload?: string;
  raw:      string;
  /** Original normalized utterance (lowercased, accents stripped). */
  normalized: string;
}

/* Strip Spanish diacritics so 'documento' matches 'documénto', 'firmá'
 * etc. We map a small accent set to ASCII letters and leave everything
 * else alone. */
function stripAccents(s: string): string {
  return s
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[ÁÀÄ]/g, 'A')
    .replace(/[ÉÈË]/g, 'E')
    .replace(/[ÍÌÏ]/g, 'I')
    .replace(/[ÓÒÖ]/g, 'O')
    .replace(/[ÚÙÜ]/g, 'U')
    .replace(/[Ñ]/g, 'N');
}

function normalize(s: string): string {
  return stripAccents(s)
    .toLowerCase()
    .replace(/[.,!?;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Filler words / hesitation tokens we strip before matching. */
const FILLERS = new Set([
  'por', 'favor', 'porfavor', 'che', 'ehh', 'eh', 'em', 'umm', 'um',
  'osea', 'mmm', 'bueno', 'ya', 'a', 'ver',
]);

function stripFillers(words: string[]): string[] {
  return words.filter((w) => !FILLERS.has(w));
}

/** Convert spoken-form "ana arroba ejemplo punto com" -> "ana@ejemplo.com" */
export function extractEmail(s: string): string | undefined {
  /* Lowercase + strip accents, but keep dots and @ intact (the user may
   * already have said the literal form). normalize() would replace
   * dots with spaces, which would destroy a literal email. */
  const lowered = stripAccents(s).toLowerCase();
  const sub = lowered
    .replace(/\s+arroba\s+/g, '@')
    .replace(/\s+punto\s+/g, '.')
    .replace(/\s+at\s+/g, '@')
    .replace(/\s+dot\s+/g, '.');
  const match = sub.match(/([a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,})/);
  if (match && match[1]) return match[1].toLowerCase();
  return undefined;
}

interface Matcher {
  type: VoiceCommandType;
  patterns: RegExp[];
}

/* Order matters: more specific patterns first.
 *
 * Patterns operate on the normalized + filler-stripped utterance,
 * which is exposed to callers as `cmd.normalized`. */
const MATCHERS: Matcher[] = [
  /* ENVIAR -- "enviar a <email>". The 'a' filler is stripped before
   * matching, so the trigger words match the lone verb. The email is
   * extracted from the *raw* utterance (extractEmail keeps "arroba"
   * and "punto" pre-substitution), so dropping the preposition here
   * is safe. */
  {
    type: 'ENVIAR',
    patterns: [
      /\benviar\b/,
      /\bmandar\b/,
    ],
  },
  {
    type: 'ABRIR_DOCUMENTO',
    patterns: [
      /\babrir\s+documento\b/,
      /\babrir\s+archivo\b/,
      /\bcargar\s+documento\b/,
    ],
  },
  {
    type: 'NUEVO_DOCUMENTO',
    patterns: [
      /\bnuevo\s+documento\b/,
      /\bdocumento\s+nuevo\b/,
      /\bempezar\s+nuevo\b/,
    ],
  },
  {
    type: 'GUARDAR_FIRMA',
    patterns: [
      /\bguardar\s+firma\b/,
      /\bcrear\s+firma\b/,
      /\bdibujar\s+firma\b/,
    ],
  },
  {
    type: 'FIRMAR',
    patterns: [
      /^firmar$/,
      /\bfirmar\s+documento\b/,
      /\binsertar\s+firma\b/,
      /\baplicar\s+firma\b/,
    ],
  },
  {
    type: 'INICIAR_DICTADO',
    patterns: [
      /\biniciar\s+dictado\b/,
      /\bcomenzar\s+dictado\b/,
      /\bempezar\s+a\s+dictar\b/,
      /\bdictado\s+(?:on|encendido)\b/,
    ],
  },
  {
    type: 'FIN_DICTADO',
    patterns: [
      /\bfin\s+dictado\b/,
      /\bfinalizar\s+dictado\b/,
      /\bparar\s+dictado\b/,
      /\bterminar\s+dictado\b/,
      /\bdictado\s+(?:off|apagado)\b/,
    ],
  },
  {
    type: 'LEER_BANDEJA',
    patterns: [
      /\bleer\s+bandeja\b/,
      /\babrir\s+bandeja\b/,
      /\bmostrar\s+(?:correos|emails|mensajes)\b/,
      /\bque\s+correos\s+tengo\b/,
    ],
  },
  /* Mic-on (always allowed). */
  {
    type: 'ENCENDER_MICROFONO',
    patterns: [
      /\bencender\s+microfono\b/,
      /\bprender\s+microfono\b/,
      /\bactivar\s+microfono\b/,
      /\bmicrofono\s+(?:on|encendido)\b/,
    ],
  },
  /* Mic-off (alias of detener voz when user says it that way). */
  {
    type: 'APAGAR_MICROFONO',
    patterns: [
      /\bapagar\s+microfono\b/,
      /\bdesactivar\s+microfono\b/,
      /\bmicrofono\s+(?:off|apagado)\b/,
    ],
  },
  /* Detener voz (last -- generic mute, falls back from APAGAR). */
  {
    type: 'DETENER_VOZ',
    patterns: [
      /\bdetener\s+voz\b/,
      /\bcallar\s+voz\b/,
      /\bsilencio\b/,
      /\bsh+\b/,
    ],
  },
];

/* Commands that must stay reachable no matter what is on screen --
 * the user must always be able to silence / control the mic. */
const MIC_SAFE_TYPES: ReadonlySet<VoiceCommandType> = new Set([
  'ENCENDER_MICROFONO', 'APAGAR_MICROFONO', 'DETENER_VOZ',
]);

/* Per-modal command sets. Patterns are deliberately short: with a modal
 * open the vocabulary shrinks, so a lone "cancelar" or "guardar" is
 * unambiguous. */
const CONTEXT_MATCHERS: Record<Exclude<VoiceContext, 'global'>, Matcher[]> = {
  send_dialog: [
    {
      type: 'CONFIRMAR_ENVIO',
      patterns: [/\bconfirmar\b/, /\benviar\b/, /\bmandar\b/],
    },
    {
      type: 'CANCELAR',
      patterns: [/\bcancelar\b/, /\bcerrar\b/, /\bsalir\b/, /\bvolver\b/],
    },
  ],
  signature_pad: [
    {
      type: 'BORRAR_FIRMA',
      patterns: [/\bborrar\b/, /\blimpiar\b/],
    },
    {
      type: 'GENERAR_FIRMA',
      patterns: [/\bgenerar\b/, /\bcursiva\b/],
    },
    {
      type: 'GUARDAR_FIRMA_PAD',
      patterns: [/\bguardar\b/, /\blisto\b/],
    },
    {
      type: 'CANCELAR',
      patterns: [/\bcancelar\b/, /\bcerrar\b/, /\bsalir\b/, /\bvolver\b/],
    },
  ],
};

export function parseCommand(raw: string, context: VoiceContext = 'global'): VoiceCommand {
  const normalizedRaw = normalize(raw);
  const cleaned = stripFillers(normalizedRaw.split(' ')).join(' ').trim();
  const normalized = cleaned.length > 0 ? cleaned : normalizedRaw;

  if (context !== 'global') {
    for (const m of CONTEXT_MATCHERS[context]) {
      for (const re of m.patterns) {
        if (re.test(normalized)) return { type: m.type, raw, normalized };
      }
    }
    /* With a modal open, the only global commands that pass through are
     * the mic-safety ones. Everything else is UNKNOWN on purpose: a
     * global "firmar" must not mutate the document behind the dialog. */
    for (const m of MATCHERS) {
      if (!MIC_SAFE_TYPES.has(m.type)) continue;
      for (const re of m.patterns) {
        if (re.test(normalized)) return { type: m.type, raw, normalized };
      }
    }
    return { type: 'UNKNOWN', raw, normalized };
  }

  for (const m of MATCHERS) {
    for (const re of m.patterns) {
      if (re.test(normalized)) {
        const cmd: VoiceCommand = { type: m.type, raw, normalized };
        if (m.type === 'ENVIAR') {
          const email = extractEmail(raw);
          if (email) cmd.payload = email;
        } else if (m.type === 'ABRIR_DOCUMENTO') {
          /* Extract optional document name after the trigger. */
          const after = normalized.replace(/^.*?(?:abrir|cargar)\s+(?:documento|archivo)\s*/, '').trim();
          if (after.length > 0) cmd.payload = after;
        }
        return cmd;
      }
    }
  }

  return { type: 'UNKNOWN', raw, normalized };
}

export interface CommandCatalogEntry {
  type:    VoiceCommandType;
  sample:  string;
  action:  string;
  /** Omitted = global command. */
  context?: Exclude<VoiceContext, 'global'>;
  /** data-nac-action of the element this command drives (producer/consumer symmetry). */
  nac_action?: string;
}

/** Catalogue of recognised commands. Exposed for UI/help screens. */
export const COMMAND_CATALOG: ReadonlyArray<CommandCatalogEntry> = [
  { type: 'NUEVO_DOCUMENTO',    sample: 'nuevo documento',        action: 'Vaciar el editor y empezar de cero.' },
  { type: 'ABRIR_DOCUMENTO',    sample: 'abrir documento informe', action: 'Cargar el documento mas reciente o por nombre.' },
  { type: 'GUARDAR_FIRMA',      sample: 'guardar firma',          action: 'Abrir el pad de firma.' },
  { type: 'FIRMAR',             sample: 'firmar',                 action: 'Insertar la firma guardada.' },
  { type: 'INICIAR_DICTADO',    sample: 'iniciar dictado',        action: 'Comenzar transcripcion.' },
  { type: 'FIN_DICTADO',        sample: 'fin dictado',            action: 'Detener transcripcion.' },
  { type: 'ENVIAR',             sample: 'enviar a ana arroba ejemplo punto com', action: 'Abrir el dialogo de envio.' },
  { type: 'LEER_BANDEJA',       sample: 'leer bandeja',           action: 'Listar los envelopes recientes.' },
  { type: 'DETENER_VOZ',        sample: 'detener voz',            action: 'Apagar el microfono.' },
  /* Contextual: send dialog open. */
  { type: 'CONFIRMAR_ENVIO', sample: 'confirmar envio', action: 'Confirmar y enviar el correo.',      context: 'send_dialog',  nac_action: 'send_email' },
  { type: 'CANCELAR',        sample: 'cancelar',        action: 'Cerrar el dialogo sin enviar.',      context: 'send_dialog',  nac_action: 'cancel_send' },
  /* Contextual: signature pad open. */
  { type: 'GUARDAR_FIRMA_PAD', sample: 'guardar',                action: 'Guardar la firma dibujada.',          context: 'signature_pad', nac_action: 'save_signature' },
  { type: 'BORRAR_FIRMA',      sample: 'borrar',                 action: 'Limpiar el lienzo de firma.',         context: 'signature_pad', nac_action: 'clear_signature' },
  { type: 'GENERAR_FIRMA',     sample: 'generar firma cursiva',  action: 'Renderizar el nombre escrito como firma.', context: 'signature_pad', nac_action: 'bake_signature_name' },
  { type: 'CANCELAR',          sample: 'cancelar',               action: 'Cerrar el pad sin guardar.',          context: 'signature_pad', nac_action: 'cancel_signature' },
];
