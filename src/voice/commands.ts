/**
 * Voice command parser (F2 / acceptance #5).
 *
 * Recognises 10 Spanish phrases (accent-insensitive, filler-word-tolerant):
 *
 *   nuevo documento / documento nuevo  -> NUEVO_DOCUMENTO
 *   abrir documento [nombre]           -> ABRIR_DOCUMENTO (payload = nombre)
 *   guardar firma                      -> GUARDAR_FIRMA
 *   firmar                             -> FIRMAR
 *   iniciar dictado                    -> INICIAR_DICTADO
 *   fin dictado                        -> FIN_DICTADO
 *   enviar a <email>                   -> ENVIAR (payload = email)
 *   leer bandeja                       -> LEER_BANDEJA
 *   abrir configuracion / ajustes      -> ABRIR_CONFIGURACION
 *   detener voz                        -> DETENER_VOZ
 *
 * Plus the always-on mic-toggle pair from F2:
 *   encender microfono                 -> ENCENDER_MICROFONO
 *   apagar microfono                   -> APAGAR_MICROFONO
 *
 * Plus contextual commands while a modal is open (VoiceContext):
 *   send_dialog:     confirmar/enviar -> CONFIRMAR_ENVIO, cancelar/cerrar -> CANCELAR
 *   signature_pad:   guardar -> GUARDAR_FIRMA_PAD, borrar -> BORRAR_FIRMA,
 *                    generar -> GENERAR_FIRMA, cancelar/cerrar -> CANCELAR
 *   settings_dialog: detectar -> DETECTAR_SERVIDORES, probar -> PROBAR_CONEXION,
 *                    guardar -> GUARDAR_CONFIG, cancelar/cerrar -> CANCELAR
 * With a modal open, global commands are suppressed except the mic pair
 * + detener voz.
 *
 * Dialog field dictation (every modal context):
 *   campo <nombre>            -> ENFOCAR_CAMPO (arm a field for dictation)
 *   borrar campo [nombre]     -> BORRAR_CAMPO  (empty it for re-dictation)
 *   fin campo / listo campo   -> FIN_CAMPO     (release the armed field)
 *   anything else while armed -> the utterance becomes the field value
 *   (spoken forms translated per field kind, see spokenFieldValue).
 * In send_dialog and signature_pad an ARMED field gives dictation
 * precedence over the contextual verbs (a lone "enviar" mid-sentence
 * must not send the email); release with "fin campo" to get the verbs
 * back. settings_dialog keeps its original semantics: values there are
 * short + structured and the documented flow ends with "guardar".
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
  | 'RESPONDER'
  | 'REENVIAR'
  | 'LEER_BANDEJA'
  | 'PONER_TITULO'
  | 'ABRIR_CONTACTOS'
  | 'AGREGAR_CONTACTO'
  | 'ABRIR_CONFIGURACION'
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
  | 'DETECTAR_SERVIDORES'
  | 'PROBAR_CONEXION'
  | 'GUARDAR_CONFIG'
  | 'ENFOCAR_CAMPO'
  | 'BORRAR_CAMPO'
  | 'FIN_CAMPO'
  | 'UNKNOWN';

/* Runtime list of every command type the client can dispatch -- the single
 * source of truth the Brain catalog is checked against (producer/consumer
 * symmetry, SQ 14). The `satisfies` keeps every entry a valid type; the
 * exhaustiveness check below fails the build if a new type is left out. */
export const ALL_VOICE_COMMAND_TYPES = [
  'NUEVO_DOCUMENTO', 'ABRIR_DOCUMENTO', 'GUARDAR_FIRMA', 'FIRMAR',
  'INICIAR_DICTADO', 'FIN_DICTADO', 'ENVIAR', 'RESPONDER', 'REENVIAR', 'LEER_BANDEJA',
  'PONER_TITULO', 'ABRIR_CONTACTOS', 'AGREGAR_CONTACTO',
  'ABRIR_CONFIGURACION', 'DETENER_VOZ', 'ENCENDER_MICROFONO', 'APAGAR_MICROFONO',
  'CONFIRMAR_ENVIO', 'CANCELAR', 'GUARDAR_FIRMA_PAD', 'BORRAR_FIRMA',
  'GENERAR_FIRMA', 'DETECTAR_SERVIDORES', 'PROBAR_CONEXION', 'GUARDAR_CONFIG',
  'ENFOCAR_CAMPO', 'BORRAR_CAMPO', 'FIN_CAMPO', 'UNKNOWN',
] as const satisfies readonly VoiceCommandType[];

/* Compile-time exhaustiveness: if a VoiceCommandType is missing from the
 * list above, _MissingVoiceType resolves to that type (not never) and the
 * assignment errors. */
type _MissingVoiceType = Exclude<VoiceCommandType, (typeof ALL_VOICE_COMMAND_TYPES)[number]>;
const _voiceTypesExhaustive: _MissingVoiceType extends never ? true : false = true;
void _voiceTypesExhaustive;

/**
 * Where the utterance is being parsed. With a modal open, global commands
 * are suppressed (except the mic-safety pair + "detener voz") so a phrase
 * like "firmar" cannot reach the document behind the dialog. Each context
 * exposes its own small command set instead.
 */
export type VoiceContext = 'global' | 'send_dialog' | 'signature_pad' | 'settings_dialog';

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

/**
 * Stronger email extraction for a DICTATED address, tolerant of the
 * pauses a real speech engine inserts ("maximiliano linares arroba gmail
 * punto com" -> "maximilianolinares@gmail.com"). The old extractEmail
 * matched a regex on the spaced text and kept only the chunk glued to the
 * "@", so "<name> 23 arroba gmail punto com" came out as "23@gmail.com"
 * (PND-020). Here we substitute the spoken symbols, strip ALL whitespace,
 * and accept the result only if the whole thing is a single valid address.
 * Returns undefined when the utterance is not a dictated email (e.g. a
 * bare contact name), so the caller can route it to the address book.
 */
export function extractSpokenEmail(s: string): string | undefined {
  const lowered = stripAccents(s).toLowerCase();
  const sub = lowered
    .replace(/\barroba\b/g, '@')
    .replace(/\bat\b/g, '@')
    .replace(/\bpunto\b/g, '.')
    .replace(/\bdot\b/g, '.')
    .replace(/\bguion\s+bajo\b/g, '_')
    .replace(/\bguion\b/g, '-');
  const compact = sub.replace(/\s+/g, '');
  if (/^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(compact)) return compact;
  /* Fall back to the loose single-token extractor (literal address typed
   * mid-sentence, already glued together). */
  return extractEmail(s);
}

/** True when the text carries an email signal worth parsing as an address
 *  rather than a contact name. */
export function looksLikeEmail(s: string): boolean {
  return /@|\barroba\b|\bat\b/i.test(stripAccents(s).toLowerCase());
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
  /* RESPONDER must come BEFORE ENVIAR so "responder a ana" is not mis-read;
   * neither "responder" nor "contestar" contains the ENVIAR triggers, but
   * keeping the recipient verbs grouped makes the intent obvious. */
  {
    type: 'RESPONDER',
    patterns: [
      /\bresponder\b/,
      /\brespondele\b/,
      /\bresponde\b/,
      /\bcontestar\b/,
      /\bcontesta\b/,
    ],
  },
  {
    type: 'REENVIAR',
    patterns: [
      /\breenviar\b/,
      /\bforward\b/,
    ],
  },
  {
    type: 'ENVIAR',
    patterns: [
      /\benviar\b/,
      /\bmandar\b/,
    ],
  },
  /* PONER_TITULO: dictate the document title. "titulo" alone is enough in
   * the global (document) context -- there is no other global command that
   * uses the word, and inside modals this matcher never runs (the send
   * dialog routes "campo titulo" to the subject field first). */
  {
    type: 'PONER_TITULO',
    patterns: [
      /\b(?:poner|pon|pone|ponle|escribir|cambiar|titular)\s+(?:el\s+)?titulo\b/,
      /\btitulo\b/,
    ],
  },
  /* AGREGAR_CONTACTO: start the guided "add a new contact" voice flow
   * (PND-028). MUST come before ABRIR_CONTACTOS so "agregar contacto" opens
   * the wizard instead of the address book. Patterns require an explicit
   * add/save verb next to "contacto" (singular) -- a bare "contactos" /
   * "agenda" still opens the book. "agendar a <nombre>" jumps in with the
   * name already heard. */
  {
    type: 'AGREGAR_CONTACTO',
    patterns: [
      /\b(?:agregar|agrega|agregame|anotar|anota|anotame|guardar|guarda|crear|crea|nuevo|nueva|sumar|suma)\s+(?:(?:un|una|el|la|nuevo|nueva|este|esta|ese|esa|mi|su|otro|otra)\s+){0,2}contacto\b/,
      /* "agendar" (to schedule/add) is distinct from "agenda" (the book,
       * -> ABRIR_CONTACTOS); the word boundary keeps them apart. Matching the
       * lone verb survives the filler-stripper eating the "a" of "agendar a
       * Maria"; the name is recovered from the raw utterance below. */
      /\bagendar\b/,
      /\bdar\s+de\s+alta\b/,
    ],
  },
  /* ABRIR_CONTACTOS: open the address book. */
  {
    type: 'ABRIR_CONTACTOS',
    patterns: [
      /\bcontactos\b/,
      /\bagenda\b/,
      /\blista\s+de\s+contactos\b/,
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
  /* Dictation toggles. The patterns tolerate the connector word a real
   * speech-to-text engine slips in ("iniciar EL dictado", "fin DEL dictado")
   * and the natural verb variants ("detener / cortar dictado"). Without this
   * width the recogniser's transcript missed the canonical phrase, the toggle
   * did not fire, and the closing words were written into the document as a
   * paragraph -- exactly the tester's case #8 (PND-016). */
  {
    type: 'INICIAR_DICTADO',
    patterns: [
      /\b(?:iniciar|comenzar|empezar|arrancar|activar)\s+(?:el\s+|con\s+(?:el\s+)?)?dictado\b/,
      /* "a" is a filler word and gets stripped before matching, so accept
       * "empezar dictar" too (not just "empezar a dictar"). */
      /\b(?:empezar|comenzar|arrancar)\s+(?:a\s+)?dictar\b/,
      /\bdictado\s+(?:on|encendido)\b/,
    ],
  },
  {
    type: 'FIN_DICTADO',
    patterns: [
      /\bfin\s+(?:de\s+|del\s+)?dictado\b/,
      /\b(?:finalizar|terminar|parar|detener|cortar)\s+(?:el\s+|de\s+|del\s+)?dictado\b/,
      /\bdictado\s+(?:off|apagado|terminado)\b/,
      /* Bare stop words, but ONLY as the WHOLE utterance (PND-019, bug 1).
       * The tester said just "fin" to stop and it got written as a paragraph.
       * Anchoring to ^...$ keeps a "fin" inside dictated prose (e.g. "el fin
       * de semana") from cutting dictation -- a lone "fin" stops, "...fin..."
       * mid-sentence does not. */
      /^(?:fin|terminar|finalizar|basta|parar|stop)$/,
    ],
  },
  /* LEER_BANDEJA: read the inbox. Recognition was too narrow (only the
   * exact "leer bandeja"), so a real recogniser transcript like "leer LA
   * bandeja", "ver bandeja" or a bare "bandeja" fell through to UNKNOWN --
   * and while dictating those got written into the document (PND-029, the
   * tester's report). The bare /\bbandeja\b/ catch-all makes every natural
   * way of asking for the inbox land here; the "correos / mensajes" forms
   * cover the phrasings that never say the word "bandeja". ("ver bandeja"
   * also reaches this via the filler-stripper eating "ver" -> "bandeja".) */
  {
    type: 'LEER_BANDEJA',
    patterns: [
      /\bbandeja\b/,
      /\bleer\s+(?:los\s+|mis\s+)?(?:correos|emails|mensajes)\b/,
      /\bleeme\s+(?:los\s+|mis\s+)?(?:correos|emails|mensajes)\b/,
      /\bmostrar\s+(?:correos|emails|mensajes)\b/,
      /\bmis\s+correos\b/,
      /\bnuevos\s+correos\b/,
      /\bque\s+correos\s+tengo\b/,
    ],
  },
  {
    type: 'ABRIR_CONFIGURACION',
    patterns: [
      /\bconfiguracion\b/,
      /\bajustes\b/,
      /\bconfigurar\s+(?:el\s+|la\s+)?(?:correo|cuenta|email|mail)\b/,
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

/* Option B -- STRICT dictation (PND-029). While dictation is active, ONLY
 * these command types act as commands; every other utterance (a verb like
 * "leer bandeja" included) is captured as document content. So the user
 * must close dictation with "fin dictado" before issuing any command -- the
 * two-step model the owner chose over making a few verbs always-on. The
 * dictation semaphore (visual badge + spoken "Dictado iniciado/finalizado")
 * tells the user capture is on so they never get trapped writing commands.
 * The mic-safety trio stays in so the mic can always be silenced. */
export const DICTATION_COMMAND_ALLOWLIST: ReadonlySet<VoiceCommandType> = new Set([
  'FIN_DICTADO', 'INICIAR_DICTADO',
  'ENCENDER_MICROFONO', 'APAGAR_MICROFONO', 'DETENER_VOZ',
]);

/** True when `type` may run as a command mid-dictation; false means the
 *  utterance is dictated content, not a command (strict mode, PND-029). */
export function isAllowedWhileDictating(type: VoiceCommandType): boolean {
  return DICTATION_COMMAND_ALLOWLIST.has(type);
}

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
  settings_dialog: [
    {
      type: 'DETECTAR_SERVIDORES',
      patterns: [/\bdetectar\b/, /\bautodetectar\b/, /\bautomatic[ao]s?\b/],
    },
    {
      type: 'PROBAR_CONEXION',
      patterns: [/\bprobar\b/, /\bprueba\b/, /\bverificar\b/],
    },
    {
      type: 'GUARDAR_CONFIG',
      patterns: [/\bguardar\b/, /\blisto\b/],
    },
    {
      type: 'CANCELAR',
      patterns: [/\bcancelar\b/, /\bcerrar\b/, /\bsalir\b/, /\bvolver\b/],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Dialog field dictation (voice parity for the modal inputs).         */
/* Settings came first (F10 / D10); send + signature joined with       */
/* PND-003. One spec table per modal context, same mechanism.          */
/* ------------------------------------------------------------------ */

export type DialogFieldKind =
  | 'text' | 'email' | 'recipients' | 'password' | 'host' | 'port'
  | 'checkbox' | 'body';

export interface DialogFieldSpec {
  /** Canonical key carried as the ENFOCAR_CAMPO payload. */
  key: string;
  /** Human label for toasts / aria announcements. */
  label: string;
  /** Spoken names, stored normalized (lowercase, accent-free, no articles). */
  aliases: string[];
  /** data-nac-action of the input this spec drives (producer/consumer symmetry). */
  nac_action: string;
  kind: DialogFieldKind;
}

/* Every dictatable control of the settings dialog. The symmetry suite
 * (tests/nac3-attrs.test.ts) checks this table against the actual
 * <input> markup in SettingsDialog.tsx in BOTH directions: an input
 * without a spec here, or a spec without its input, goes red. */
export const SETTINGS_FIELD_SPECS: ReadonlyArray<DialogFieldSpec> = [
  { key: 'nombre',        label: 'Tu nombre',           aliases: ['nombre', 'remitente', 'nombre remitente'],                            nac_action: 'set_identity_name',    kind: 'text' },
  { key: 'correo',        label: 'Direccion de correo', aliases: ['correo', 'email', 'mail', 'direccion', 'direccion correo', 'cuenta'], nac_action: 'set_account_email',    kind: 'email' },
  { key: 'contrasena',    label: 'Contrasena',          aliases: ['contrasena', 'clave', 'password'],                                    nac_action: 'set_account_password', kind: 'password' },
  { key: 'servidor_imap', label: 'Servidor IMAP',       aliases: ['servidor imap', 'imap', 'servidor entrada', 'servidor recepcion'],    nac_action: 'set_imap_host',        kind: 'host' },
  { key: 'puerto_imap',   label: 'Puerto IMAP',         aliases: ['puerto imap', 'puerto entrada'],                                      nac_action: 'set_imap_port',        kind: 'port' },
  { key: 'ssl_imap',      label: 'SSL IMAP',            aliases: ['ssl imap', 'seguridad imap'],                                         nac_action: 'toggle_imap_ssl',      kind: 'checkbox' },
  { key: 'servidor_smtp', label: 'Servidor SMTP',       aliases: ['servidor smtp', 'smtp', 'servidor salida', 'servidor envio'],         nac_action: 'set_smtp_host',        kind: 'host' },
  { key: 'puerto_smtp',   label: 'Puerto SMTP',         aliases: ['puerto smtp', 'puerto salida'],                                       nac_action: 'set_smtp_port',        kind: 'port' },
  { key: 'ssl_smtp',      label: 'SSL SMTP',            aliases: ['ssl smtp', 'seguridad smtp'],                                         nac_action: 'toggle_smtp_ssl',      kind: 'checkbox' },
];

/* Dictatable controls of the send dialog (PND-003). The body uses
 * APPEND semantics (each utterance lands as a new paragraph); the rest
 * replace, like settings. Same bidirectional symmetry enforcement
 * against SendDialog.tsx in tests/nac3-attrs.test.ts. */
export const SEND_FIELD_SPECS: ReadonlyArray<DialogFieldSpec> = [
  { key: 'destinatario', label: 'Destinatarios',      aliases: ['destinatario', 'destinatarios', 'para', 'correo destino'], nac_action: 'set_recipients', kind: 'recipients' },
  { key: 'asunto',       label: 'Asunto',             aliases: ['asunto', 'titulo', 'tema'],                                nac_action: 'set_subject',    kind: 'text' },
  { key: 'cuerpo',       label: 'Cuerpo',             aliases: ['cuerpo', 'mensaje', 'texto', 'cuerpo mensaje'],            nac_action: 'set_body',       kind: 'body' },
  { key: 'adjuntar',     label: 'Adjuntar documento', aliases: ['adjuntar', 'adjunto', 'documento adjunto'],                nac_action: 'toggle_attach',  kind: 'checkbox' },
];

/* Dictatable controls of the signature pad (PND-003): the typed name
 * for cursive baking. */
export const SIGNATURE_FIELD_SPECS: ReadonlyArray<DialogFieldSpec> = [
  { key: 'nombre', label: 'Nombre para la firma', aliases: ['nombre', 'nombre firma', 'firma'], nac_action: 'type_signature_name', kind: 'text' },
];

/** Field-spec table per modal context (the dictation producer/consumer contract). */
export const FIELD_SPECS_BY_CONTEXT: Record<Exclude<VoiceContext, 'global'>, ReadonlyArray<DialogFieldSpec>> = {
  settings_dialog: SETTINGS_FIELD_SPECS,
  send_dialog:     SEND_FIELD_SPECS,
  signature_pad:   SIGNATURE_FIELD_SPECS,
};

/* Articles/connectors dropped before alias matching, so "campo de la
 * cuenta" or "servidor de entrada" resolve. FILLERS already went away
 * during normalize. */
const FIELD_STOPWORDS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'al', 'mi', 'su']);

/** Resolve a spoken field name ("servidor de entrada") to its spec. */
export function resolveDialogField(spoken: string, specs: ReadonlyArray<DialogFieldSpec>): DialogFieldSpec | undefined {
  const cleaned = normalize(spoken)
    .split(' ')
    .filter((w) => w.length > 0 && !FIELD_STOPWORDS.has(w))
    .join(' ');
  if (cleaned.length === 0) return undefined;
  return specs.find((s) => s.aliases.includes(cleaned));
}

/* Recognisers usually emit numerals, but a slow spelled-out port
 * ("nueve nueve tres") must land too. */
const SPOKEN_DIGITS: ReadonlyArray<[RegExp, string]> = [
  [/\bcero\b/g, '0'], [/\buno\b/g, '1'], [/\bdos\b/g, '2'], [/\btres\b/g, '3'],
  [/\bcuatro\b/g, '4'], [/\bcinco\b/g, '5'], [/\bseis\b/g, '6'], [/\bsiete\b/g, '7'],
  [/\bocho\b/g, '8'], [/\bnueve\b/g, '9'],
];

/* Spoken-form symbol substitutions shared by the value kinds. */
function substSpokenSymbols(s: string): string {
  return s
    .replace(/\s+arroba\s+/g, '@')
    .replace(/\s+at\s+/g, '@')
    .replace(/\s+punto\s+/g, '.')
    .replace(/\s+dot\s+/g, '.')
    .replace(/\s+guion\s+bajo\s+/g, '_')
    .replace(/\s+guion\s+/g, '-');
}

/**
 * Turn a final dictation utterance into the value for a settings field.
 * Dictation REPLACES the whole field (correcting = dictate again); an
 * empty result means "nothing usable was heard" and the caller re-asks.
 */
export function spokenFieldValue(raw: string, kind: DialogFieldKind): string {
  /* Keep '.' (literal emails/hosts); drop the rest of the punctuation
   * a recogniser may sprinkle in. */
  const lowered = stripAccents(raw).toLowerCase().replace(/[,!?;:]+/g, ' ').trim();
  switch (kind) {
    case 'email': {
      const direct = extractEmail(raw);
      if (direct) return direct;
      return substSpokenSymbols(lowered).replace(/\s+/g, '');
    }
    case 'recipients': {
      /* One or several addresses, separated by "y" / "coma" / a literal
       * comma. Extract every email after spoken-symbol substitution and
       * join them in the comma-separated form SendDialog expects. */
      const spaced = ' ' + stripAccents(raw).toLowerCase().replace(/\bcoma\b/g, ' , ') + ' ';
      const sub = substSpokenSymbols(spaced);
      const found = sub.match(/[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}/g);
      if (found && found.length > 0) return found.join(', ');
      return substSpokenSymbols(lowered).replace(/\s+/g, '');
    }
    case 'body':
      /* Long free dictation: keep the utterance verbatim (punctuation,
       * casing). The APPEND-as-paragraph semantics live in the App
       * layer, which knows the current textarea content. */
      return raw.trim();
    case 'host':
      return substSpokenSymbols(lowered).replace(/\s+/g, '');
    case 'port': {
      let s = lowered;
      for (const [re, digit] of SPOKEN_DIGITS) s = s.replace(re, digit);
      return (s.match(/\d+/g) ?? []).join('');
    }
    case 'password':
      /* Casing is kept (app passwords may be case-sensitive); the
       * recogniser splits them into spaced groups, so spaces go away. */
      return substSpokenSymbols(stripAccents(raw).trim()).replace(/\s+/g, '');
    case 'text':
    default:
      return raw.trim();
  }
}

/** Parse a spoken yes/no for checkbox fields. Undefined = not understood. */
export function spokenCheckboxValue(raw: string): boolean | undefined {
  const n = normalize(raw);
  if (/\b(?:si|activar|activado|activada|encendido|encender|prender|on)\b/.test(n)) return true;
  if (/\b(?:no|desactivar|desactivado|desactivada|apagado|apagar|off)\b/.test(n)) return false;
  return undefined;
}

export interface ParseOpts {
  /** True when a dialog field is currently armed for dictation. */
  armed?: boolean;
}

export function parseCommand(raw: string, context: VoiceContext = 'global', opts: ParseOpts = {}): VoiceCommand {
  const normalizedRaw = normalize(raw);
  const cleaned = stripFillers(normalizedRaw.split(' ')).join(' ').trim();
  const normalized = cleaned.length > 0 ? cleaned : normalizedRaw;

  if (context !== 'global') {
    const specs = FIELD_SPECS_BY_CONTEXT[context];
    /* Field commands run first. Order matters within them too:
     * "borrar campo correo" must clear, not arm; "fin campo" must
     * release, not arm. */
    const clear = normalized.match(/\b(?:borrar|limpiar|vaciar)\s+campo\b\s*(.*)$/);
    if (clear) {
      const cmd: VoiceCommand = { type: 'BORRAR_CAMPO', raw, normalized };
      const spec = resolveDialogField(clear[1] ?? '', specs);
      if (spec) cmd.payload = spec.key;
      return cmd;
    }
    /* "campos?" tolerates the plural the recogniser sometimes returns
     * ("fin campos"), part of the bug-3 inconsistency (PND-019). */
    if (/\b(?:fin|finalizar|terminar|cerrar|listo|soltar)\s+(?:de\s+|del\s+|el\s+)?campos?\b/.test(normalized)) {
      return { type: 'FIN_CAMPO', raw, normalized };
    }
    const focus = normalized.match(/\bcampo\s+(.+)$/);
    if (focus) {
      const cmd: VoiceCommand = { type: 'ENFOCAR_CAMPO', raw, normalized };
      const spec = resolveDialogField(focus[1] ?? '', specs);
      if (spec) cmd.payload = spec.key;
      return cmd;
    }
    /* With a field armed in the send dialog or the signature pad,
     * dictation has precedence: free speech IS the field value, so the
     * contextual verbs must not fire (a lone "enviar" inside a dictated
     * sentence would send the email). The user releases the field with
     * "fin campo" to get the verbs back. Settings keeps its original
     * verb-first semantics (short structured values, flow ends in
     * "guardar"). Mic safety still passes below in every case. */
    const dictationFirst = opts.armed === true && (context === 'send_dialog' || context === 'signature_pad');
    if (!dictationFirst) {
      for (const m of CONTEXT_MATCHERS[context]) {
        for (const re of m.patterns) {
          if (re.test(normalized)) return { type: m.type, raw, normalized };
        }
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
          /* Strip the verb (+ optional "a"/"al") so only the recipient
           * remains. A dictated address wins; otherwise the remainder is a
           * contact NAME the App resolves against the address book. Stripping
           * first is what stops "enviar a" gluing onto the local part. */
          const remainder = raw.replace(/^.*?\b(?:enviar|mandar)\b\s*(?:a\s+|al\s+)?/i, '').trim();
          const email = looksLikeEmail(remainder) ? extractSpokenEmail(remainder) : undefined;
          if (email) cmd.payload = email;
          else if (remainder.length > 0) cmd.payload = remainder;
        } else if (m.type === 'RESPONDER') {
          /* Optional "responder a <nombre>"; bare "responder" -> last read. */
          const remainder = raw.replace(/^.*?\b(?:responder|respondele|responde|contestar|contesta)\b\s*(?:a\s+|al\s+)?/i, '').trim();
          const email = looksLikeEmail(remainder) ? extractSpokenEmail(remainder) : undefined;
          if (email) cmd.payload = email;
          else if (remainder.length > 0) cmd.payload = remainder;
        } else if (m.type === 'PONER_TITULO') {
          /* Title text from the RAW utterance to keep its casing. */
          const mt = raw.match(/t[ií]tulo\s+(.+)$/i);
          if (mt && mt[1] && mt[1].trim().length > 0) cmd.payload = mt[1].trim();
        } else if (m.type === 'ABRIR_DOCUMENTO') {
          /* Extract optional document name after the trigger. */
          const after = normalized.replace(/^.*?(?:abrir|cargar)\s+(?:documento|archivo)\s*/, '').trim();
          if (after.length > 0) cmd.payload = after;
        } else if (m.type === 'AGREGAR_CONTACTO') {
          /* Optional name said in one go ("agregar contacto Juan Perez",
           * "agendar a Maria"). Taken from the RAW utterance to keep its
           * casing; the wizard skips straight to the email step when set.
           * Bare "agregar contacto" leaves payload empty -> ask the name. */
          const after = raw
            .replace(/^.*?\b(?:agendar\s+a|contacto|de\s+alta)\b\s*(?:a\s+|al\s+)?/i, '')
            .trim();
          if (after.length > 0 && !/^contacto/i.test(after)) cmd.payload = after;
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
  /** True when the command drives the voice-armed settings field rather than one fixed element. */
  field_scope?: boolean;
}

/** Catalogue of recognised commands. Exposed for UI/help screens. */
export const COMMAND_CATALOG: ReadonlyArray<CommandCatalogEntry> = [
  { type: 'NUEVO_DOCUMENTO',    sample: 'nuevo documento',        action: 'Vaciar el editor y empezar de cero.' },
  { type: 'ABRIR_DOCUMENTO',    sample: 'abrir documento informe', action: 'Cargar el documento mas reciente o por nombre.' },
  { type: 'GUARDAR_FIRMA',      sample: 'guardar firma',          action: 'Abrir el pad de firma.' },
  { type: 'FIRMAR',             sample: 'firmar',                 action: 'Insertar la firma guardada.' },
  { type: 'INICIAR_DICTADO',    sample: 'iniciar dictado',        action: 'Comenzar transcripcion.' },
  { type: 'FIN_DICTADO',        sample: 'fin dictado',            action: 'Detener transcripcion.' },
  { type: 'ENVIAR',             sample: 'enviar a Maximiliano',    action: 'Enviar a un contacto de la agenda (por nombre) o a una direccion dictada.' },
  { type: 'RESPONDER',          sample: 'responder',              action: 'Responder al ultimo correo leido; o "responder a <nombre>" a un contacto.' },
  { type: 'REENVIAR',           sample: 'reenviar',               action: 'Reenviar el ultimo correo leido a nuevos destinatarios.' },
  { type: 'LEER_BANDEJA',       sample: 'leer bandeja',           action: 'Listar los envelopes recientes.' },
  { type: 'PONER_TITULO',       sample: 'poner titulo Carta al banco', action: 'Poner o cambiar el titulo del documento.' },
  { type: 'ABRIR_CONTACTOS',    sample: 'abrir contactos',        action: 'Abrir la agenda de contactos.' },
  { type: 'AGREGAR_CONTACTO',   sample: 'agregar contacto',       action: 'Agendar un contacto nuevo guiado por voz: primero el nombre, despues el correo.' },
  { type: 'ABRIR_CONFIGURACION', sample: 'abrir configuracion',   action: 'Abrir la configuracion de la cuenta de correo.' },
  { type: 'DETENER_VOZ',        sample: 'detener voz',            action: 'Apagar el microfono.' },
  /* Contextual: send dialog open. */
  { type: 'CONFIRMAR_ENVIO', sample: 'confirmar envio', action: 'Confirmar y enviar el correo.',      context: 'send_dialog',  nac_action: 'send_email' },
  { type: 'CANCELAR',        sample: 'cancelar',        action: 'Cerrar el dialogo sin enviar.',      context: 'send_dialog',  nac_action: 'cancel_send' },
  /* Contextual: send dialog field dictation (PND-003). */
  { type: 'ENFOCAR_CAMPO', sample: 'campo destinatario', action: 'Enfocar los destinatarios para dictarlos (arroba / punto / coma).',      context: 'send_dialog', nac_action: 'set_recipients' },
  { type: 'ENFOCAR_CAMPO', sample: 'campo asunto',       action: 'Enfocar el asunto para dictarlo.',                                       context: 'send_dialog', nac_action: 'set_subject' },
  { type: 'ENFOCAR_CAMPO', sample: 'campo cuerpo',       action: 'Enfocar el cuerpo; cada frase dictada se agrega como parrafo nuevo.',    context: 'send_dialog', nac_action: 'set_body' },
  { type: 'ENFOCAR_CAMPO', sample: 'campo adjuntar',     action: 'Enfocar la casilla del adjunto; despues deci "si" o "no".',              context: 'send_dialog', nac_action: 'toggle_attach' },
  { type: 'BORRAR_CAMPO',  sample: 'borrar campo',       action: 'Vaciar el campo enfocado para dictarlo de nuevo.',                       context: 'send_dialog', field_scope: true },
  { type: 'FIN_CAMPO',     sample: 'fin campo',          action: 'Soltar el campo enfocado y recuperar los comandos del dialogo.',         context: 'send_dialog', field_scope: true },
  /* Contextual: signature pad open. */
  { type: 'GUARDAR_FIRMA_PAD', sample: 'guardar',                action: 'Guardar la firma dibujada.',          context: 'signature_pad', nac_action: 'save_signature' },
  { type: 'BORRAR_FIRMA',      sample: 'borrar',                 action: 'Limpiar el lienzo de firma.',         context: 'signature_pad', nac_action: 'clear_signature' },
  { type: 'GENERAR_FIRMA',     sample: 'generar firma cursiva',  action: 'Renderizar el nombre escrito como firma.', context: 'signature_pad', nac_action: 'bake_signature_name' },
  { type: 'CANCELAR',          sample: 'cancelar',               action: 'Cerrar el pad sin guardar.',          context: 'signature_pad', nac_action: 'cancel_signature' },
  /* Contextual: signature pad field dictation (PND-003). */
  { type: 'ENFOCAR_CAMPO', sample: 'campo nombre', action: 'Enfocar el nombre para dictarlo y generar la firma cursiva.', context: 'signature_pad', nac_action: 'type_signature_name' },
  { type: 'BORRAR_CAMPO',  sample: 'borrar campo', action: 'Vaciar el nombre para dictarlo de nuevo.',                    context: 'signature_pad', field_scope: true },
  { type: 'FIN_CAMPO',     sample: 'fin campo',    action: 'Soltar el campo y recuperar los comandos del pad.',           context: 'signature_pad', field_scope: true },
  /* Contextual: settings dialog open. */
  { type: 'DETECTAR_SERVIDORES', sample: 'detectar servidores', action: 'Autocompletar los servidores a partir de la direccion.', context: 'settings_dialog', nac_action: 'autodetect_servers' },
  { type: 'PROBAR_CONEXION',     sample: 'probar conexion',     action: 'Probar la conexion IMAP y SMTP en vivo.',               context: 'settings_dialog', nac_action: 'test_connection' },
  { type: 'GUARDAR_CONFIG',      sample: 'guardar',             action: 'Guardar la configuracion cifrada en la boveda.',        context: 'settings_dialog', nac_action: 'save_settings' },
  { type: 'CANCELAR',            sample: 'cancelar',            action: 'Cerrar la configuracion sin guardar.',                  context: 'settings_dialog', nac_action: 'cancel_settings' },
  /* Contextual: settings field dictation. "campo X" arms the field; the
   * next utterance becomes its value; "borrar campo" empties it. */
  { type: 'ENFOCAR_CAMPO', sample: 'campo nombre',        action: 'Enfocar el campo del nombre para dictarle el valor.',           context: 'settings_dialog', nac_action: 'set_identity_name' },
  { type: 'ENFOCAR_CAMPO', sample: 'campo correo',        action: 'Enfocar la direccion de correo para dictarla.',                 context: 'settings_dialog', nac_action: 'set_account_email' },
  { type: 'ENFOCAR_CAMPO', sample: 'campo contrasena',    action: 'Enfocar la contrasena para dictarla (nunca se lee en voz alta).', context: 'settings_dialog', nac_action: 'set_account_password' },
  { type: 'ENFOCAR_CAMPO', sample: 'campo servidor imap', action: 'Enfocar el servidor IMAP para dictarlo.',                       context: 'settings_dialog', nac_action: 'set_imap_host' },
  { type: 'ENFOCAR_CAMPO', sample: 'campo puerto imap',   action: 'Enfocar el puerto IMAP para dictarlo.',                         context: 'settings_dialog', nac_action: 'set_imap_port' },
  { type: 'ENFOCAR_CAMPO', sample: 'campo ssl imap',      action: 'Enfocar SSL de IMAP; despues deci "si" o "no".',                context: 'settings_dialog', nac_action: 'toggle_imap_ssl' },
  { type: 'ENFOCAR_CAMPO', sample: 'campo servidor smtp', action: 'Enfocar el servidor SMTP para dictarlo.',                       context: 'settings_dialog', nac_action: 'set_smtp_host' },
  { type: 'ENFOCAR_CAMPO', sample: 'campo puerto smtp',   action: 'Enfocar el puerto SMTP para dictarlo.',                         context: 'settings_dialog', nac_action: 'set_smtp_port' },
  { type: 'ENFOCAR_CAMPO', sample: 'campo ssl smtp',      action: 'Enfocar SSL de SMTP; despues deci "si" o "no".',                context: 'settings_dialog', nac_action: 'toggle_smtp_ssl' },
  { type: 'BORRAR_CAMPO',  sample: 'borrar campo',        action: 'Vaciar el campo enfocado para dictarlo de nuevo.',              context: 'settings_dialog', field_scope: true },
  { type: 'FIN_CAMPO',     sample: 'fin campo',           action: 'Soltar el campo enfocado.',                                     context: 'settings_dialog', field_scope: true },
];
