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
  | 'UNKNOWN';

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

export function parseCommand(raw: string): VoiceCommand {
  const normalizedRaw = normalize(raw);
  const cleaned = stripFillers(normalizedRaw.split(' ')).join(' ').trim();
  const normalized = cleaned.length > 0 ? cleaned : normalizedRaw;

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

/** Catalogue of recognised commands. Exposed for UI/help screens. */
export const COMMAND_CATALOG: ReadonlyArray<{ type: VoiceCommandType; sample: string; action: string }> = [
  { type: 'NUEVO_DOCUMENTO',    sample: 'nuevo documento',        action: 'Vaciar el editor y empezar de cero.' },
  { type: 'ABRIR_DOCUMENTO',    sample: 'abrir documento informe', action: 'Cargar el documento mas reciente o por nombre.' },
  { type: 'GUARDAR_FIRMA',      sample: 'guardar firma',          action: 'Abrir el pad de firma.' },
  { type: 'FIRMAR',             sample: 'firmar',                 action: 'Insertar la firma guardada.' },
  { type: 'INICIAR_DICTADO',    sample: 'iniciar dictado',        action: 'Comenzar transcripcion.' },
  { type: 'FIN_DICTADO',        sample: 'fin dictado',            action: 'Detener transcripcion.' },
  { type: 'ENVIAR',             sample: 'enviar a ana arroba ejemplo punto com', action: 'Abrir el dialogo de envio.' },
  { type: 'LEER_BANDEJA',       sample: 'leer bandeja',           action: 'Listar los envelopes recientes.' },
  { type: 'DETENER_VOZ',        sample: 'detener voz',            action: 'Apagar el microfono.' },
];
