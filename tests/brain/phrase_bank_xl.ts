/**
 * Extended ("XL") phrase bank for the live Brain efficiency bench (v0.5.0).
 *
 * This bank is NOT for the deterministic matcher test -- it exercises the
 * REAL model (camino 1) against the kind of input a person who depends on
 * Yuemail actually produces through the browser's speech-to-text:
 *
 *   - freeform: natural paraphrases, regional variants (voseo, peninsular,
 *     mexican), polite filler, long rambling requests with the intent buried.
 *   - asr_noise: the browser STT mis-hears words (missing accents, split or
 *     glued words, homophones). The Brain must still route the intent.
 *   - email: spoken email addresses ("arroba", "punto", "guion") the Brain
 *     must normalise.
 *   - negative: off-topic chit-chat / impossible asks. The Brain MUST decline
 *     (low confidence / not in catalog) so the app falls back to the safety
 *     net INSTEAD of firing a wrong command. For someone who cannot easily
 *     undo an action, a false positive is worse than a graceful fallback.
 *
 * Used by tests/brain/live-bench-xl.test.ts (gated on BRAIN_LIVE_XL=1).
 *
 * ASCII-only.
 */
import type { VoiceCommandType, VoiceContext } from '../../src/voice/commands.js';

export interface XlCase {
  utterance: string;
  /** Expected command, or null when the Brain should decline (negative). */
  expected: VoiceCommandType | null;
  context: VoiceContext;
  kind: 'freeform' | 'asr_noise' | 'email' | 'negative';
  /** For ENVIAR cases, the normalised email the Brain should surface. */
  expectedEmail?: string;
}

export const PHRASE_BANK_XL: ReadonlyArray<XlCase> = [
  /* ===================== GLOBAL -- freeform ===================== */
  { utterance: 'che, empecemos una carta nueva de cero', expected: 'NUEVO_DOCUMENTO', context: 'global', kind: 'freeform' },
  { utterance: 'borra todo esto y arrancamos limpio', expected: 'NUEVO_DOCUMENTO', context: 'global', kind: 'freeform' },
  { utterance: 'necesito escribir una nota nueva para el medico', expected: 'NUEVO_DOCUMENTO', context: 'global', kind: 'freeform' },
  { utterance: 'abrime lo que escribi ayer sobre el banco', expected: 'ABRIR_DOCUMENTO', context: 'global', kind: 'freeform' },
  { utterance: 'mostrame el ultimo documento que tenia guardado', expected: 'ABRIR_DOCUMENTO', context: 'global', kind: 'freeform' },
  { utterance: 'quiero ver la carta que le mande a mi nieta', expected: 'ABRIR_DOCUMENTO', context: 'global', kind: 'freeform' },
  { utterance: 'pone mi firma abajo de todo', expected: 'FIRMAR', context: 'global', kind: 'freeform' },
  { utterance: 'agregale mi firma al documento por favor', expected: 'FIRMAR', context: 'global', kind: 'freeform' },
  { utterance: 'quiero crear mi firma para usarla despues', expected: 'GUARDAR_FIRMA', context: 'global', kind: 'freeform' },
  { utterance: 'llevame a donde se dibuja la firma', expected: 'GUARDAR_FIRMA', context: 'global', kind: 'freeform' },
  { utterance: 'voy a dictarte una carta, anota lo que digo', expected: 'INICIAR_DICTADO', context: 'global', kind: 'freeform' },
  { utterance: 'empeza a escribir todo lo que voy hablando', expected: 'INICIAR_DICTADO', context: 'global', kind: 'freeform' },
  { utterance: 'pará de escribir que ya termine', expected: 'FIN_DICTADO', context: 'global', kind: 'freeform' },
  { utterance: 'listo, dejá de tomar nota', expected: 'FIN_DICTADO', context: 'global', kind: 'freeform' },
  { utterance: 'quiero mandar este correo que escribi', expected: 'ENVIAR', context: 'global', kind: 'freeform' },
  { utterance: 'ya esta, mandalo', expected: 'ENVIAR', context: 'global', kind: 'freeform' },
  { utterance: 'fijate si me llego algun correo nuevo', expected: 'LEER_BANDEJA', context: 'global', kind: 'freeform' },
  { utterance: 'leeme los mensajes que tengo en la bandeja', expected: 'LEER_BANDEJA', context: 'global', kind: 'freeform' },
  { utterance: 'que mails me llegaron hoy', expected: 'LEER_BANDEJA', context: 'global', kind: 'freeform' },
  { utterance: 'necesito cambiar la clave de mi correo, llevame ahi', expected: 'ABRIR_CONFIGURACION', context: 'global', kind: 'freeform' },
  { utterance: 'abrime los ajustes de la cuenta', expected: 'ABRIR_CONFIGURACION', context: 'global', kind: 'freeform' },
  { utterance: 'prende el microfono asi te hablo', expected: 'ENCENDER_MICROFONO', context: 'global', kind: 'freeform' },
  { utterance: 'activa la voz por favor', expected: 'ENCENDER_MICROFONO', context: 'global', kind: 'freeform' },
  { utterance: 'apaga el microfono un momento', expected: 'APAGAR_MICROFONO', context: 'global', kind: 'freeform' },
  { utterance: 'basta, callate', expected: 'DETENER_VOZ', context: 'global', kind: 'freeform' },
  { utterance: 'pará de hablar', expected: 'DETENER_VOZ', context: 'global', kind: 'freeform' },

  /* long rambling requests with the intent buried */
  { utterance: 'mira, hoy me desperté temprano y me acorde que tengo que escribirle al doctor asi que bueno, arranquemos un documento nuevo', expected: 'NUEVO_DOCUMENTO', context: 'global', kind: 'freeform' },
  { utterance: 'estuve toda la mañana esperando noticias del laboratorio, podes revisar si llego algo a la bandeja', expected: 'LEER_BANDEJA', context: 'global', kind: 'freeform' },
  { utterance: 'bueno creo que ya quedo bien la carta, asi que dale, enviala de una vez', expected: 'ENVIAR', context: 'global', kind: 'freeform' },

  /* ===================== GLOBAL -- asr_noise ===================== */
  { utterance: 'nuevo docu mento', expected: 'NUEVO_DOCUMENTO', context: 'global', kind: 'asr_noise' },
  { utterance: 'leer band eja', expected: 'LEER_BANDEJA', context: 'global', kind: 'asr_noise' },
  { utterance: 'avri el documento', expected: 'ABRIR_DOCUMENTO', context: 'global', kind: 'asr_noise' },
  { utterance: 'inisiar dictado', expected: 'INICIAR_DICTADO', context: 'global', kind: 'asr_noise' },
  { utterance: 'firma el docu', expected: 'FIRMAR', context: 'global', kind: 'asr_noise' },
  { utterance: 'enbiar', expected: 'ENVIAR', context: 'global', kind: 'asr_noise' },
  { utterance: 'configurasion', expected: 'ABRIR_CONFIGURACION', context: 'global', kind: 'asr_noise' },
  { utterance: 'prende el microfino', expected: 'ENCENDER_MICROFONO', context: 'global', kind: 'asr_noise' },
  { utterance: 'detene la bos', expected: 'DETENER_VOZ', context: 'global', kind: 'asr_noise' },
  { utterance: 'guarda mi firmar', expected: 'GUARDAR_FIRMA', context: 'global', kind: 'asr_noise' },

  /* ===================== GLOBAL -- email extraction ===================== */
  { utterance: 'mandaselo a ana arroba ejemplo punto com', expected: 'ENVIAR', context: 'global', kind: 'email', expectedEmail: 'ana@ejemplo.com' },
  { utterance: 'enviaselo a juan punto perez arroba gmail punto com', expected: 'ENVIAR', context: 'global', kind: 'email', expectedEmail: 'juan.perez@gmail.com' },
  { utterance: 'mandalo a maria guion lopez arroba hotmail punto com', expected: 'ENVIAR', context: 'global', kind: 'email', expectedEmail: 'maria-lopez@hotmail.com' },
  { utterance: 'envialo a mi hijo a pedro arroba yahoo punto com punto ar', expected: 'ENVIAR', context: 'global', kind: 'email', expectedEmail: 'pedro@yahoo.com.ar' },

  /* ===================== NEGATIVES (must decline -> fallback) ===================== */
  { utterance: 'que lindo dia que esta hoy no', expected: null, context: 'global', kind: 'negative' },
  { utterance: 'me podes contar un chiste', expected: null, context: 'global', kind: 'negative' },
  { utterance: 'cuanto es dos mas dos', expected: null, context: 'global', kind: 'negative' },
  { utterance: 'pedime una pizza con muzzarella', expected: null, context: 'global', kind: 'negative' },
  { utterance: 'que hora es en tokio', expected: null, context: 'global', kind: 'negative' },
  { utterance: 'gracias, sos un genio', expected: null, context: 'global', kind: 'negative' },
  { utterance: 'reproduci musica de los beatles', expected: null, context: 'global', kind: 'negative' },

  /* ===================== SEND DIALOG -- freeform ===================== */
  { utterance: 'dale, mandalo ya mismo', expected: 'CONFIRMAR_ENVIO', context: 'send_dialog', kind: 'freeform' },
  { utterance: 'si, enviar', expected: 'CONFIRMAR_ENVIO', context: 'send_dialog', kind: 'freeform' },
  { utterance: 'no, mejor no lo mandes todavia', expected: 'CANCELAR', context: 'send_dialog', kind: 'freeform' },
  { utterance: 'cerra esto que me equivoque', expected: 'CANCELAR', context: 'send_dialog', kind: 'freeform' },
  { utterance: 'quiero dictar para quien es el correo', expected: 'ENFOCAR_CAMPO', context: 'send_dialog', kind: 'freeform' },
  { utterance: 'dejame escribir el asunto', expected: 'ENFOCAR_CAMPO', context: 'send_dialog', kind: 'freeform' },
  { utterance: 'borra lo que puse en este campo', expected: 'BORRAR_CAMPO', context: 'send_dialog', kind: 'freeform' },

  /* ===================== SETTINGS DIALOG -- freeform ===================== */
  { utterance: 'completa los servidores vos solo', expected: 'DETECTAR_SERVIDORES', context: 'settings_dialog', kind: 'freeform' },
  { utterance: 'fijate si la conexion al correo anda', expected: 'PROBAR_CONEXION', context: 'settings_dialog', kind: 'freeform' },
  { utterance: 'proba si se conecta bien', expected: 'PROBAR_CONEXION', context: 'settings_dialog', kind: 'freeform' },
  { utterance: 'guarda esta configuracion', expected: 'GUARDAR_CONFIG', context: 'settings_dialog', kind: 'freeform' },
  { utterance: 'dejame poner mi contrasena', expected: 'ENFOCAR_CAMPO', context: 'settings_dialog', kind: 'freeform' },
  { utterance: 'quiero escribir mi direccion de correo', expected: 'ENFOCAR_CAMPO', context: 'settings_dialog', kind: 'freeform' },

  /* ===================== SIGNATURE PAD -- freeform ===================== */
  { utterance: 'guarda esta firma asi quedo', expected: 'GUARDAR_FIRMA_PAD', context: 'signature_pad', kind: 'freeform' },
  { utterance: 'borra y la hago de nuevo', expected: 'BORRAR_FIRMA', context: 'signature_pad', kind: 'freeform' },
  { utterance: 'hacela en cursiva a partir de mi nombre', expected: 'GENERAR_FIRMA', context: 'signature_pad', kind: 'freeform' },
  { utterance: 'cerra esto sin guardar', expected: 'CANCELAR', context: 'signature_pad', kind: 'freeform' },

  /* ===================== ADVERSARIAL TRAPS ===================== */
  /* negation: the command word appears but is negated -> must NOT fire it */
  { utterance: 'no, no lo mandes todavia, despues sigo', expected: null, context: 'global', kind: 'negative' },
  { utterance: 'no abras la configuracion que ya la vi', expected: null, context: 'global', kind: 'negative' },
  { utterance: 'todavia no borres nada eh', expected: null, context: 'global', kind: 'negative' },

  /* context confusion: a modal-only command said with NO modal open.
   * "enfocar el campo asunto" has no global equivalent -> must decline.
   * "confirmar envio" DOES map to a sensible global action (ENVIAR opens the
   * send dialog): routing it there advances the user's intent, so that is the
   * correct behavior, not a misfire -- expected ENVIAR, not a decline. */
  { utterance: 'confirmar envio', expected: 'ENVIAR', context: 'global', kind: 'freeform' },
  { utterance: 'enfocar el campo asunto', expected: null, context: 'global', kind: 'negative' },

  /* ambiguity between two near commands -- the documented distinction is
   * FIRMAR = insert the saved signature; GUARDAR_FIRMA = open the pad to
   * create one */
  { utterance: 'firma el documento con la que ya tengo guardada', expected: 'FIRMAR', context: 'global', kind: 'freeform' },
  { utterance: 'todavia no tengo firma, quiero armar una', expected: 'GUARDAR_FIRMA', context: 'global', kind: 'freeform' },

  /* code-switching ES/EN and very indirect/polite phrasings */
  { utterance: 'open my inbox por favor', expected: 'LEER_BANDEJA', context: 'global', kind: 'freeform' },
  { utterance: 'te molesto si revisas si me llego correo', expected: 'LEER_BANDEJA', context: 'global', kind: 'freeform' },
  { utterance: 'sera mucho pedir que arranquemos un documento limpio', expected: 'NUEVO_DOCUMENTO', context: 'global', kind: 'freeform' },

  /* heavy ASR mangling of multi-word intents */
  { utterance: 'a brir configura cion de la cuenta', expected: 'ABRIR_CONFIGURACION', context: 'global', kind: 'asr_noise' },
  { utterance: 'leeme la van deja de entrada', expected: 'LEER_BANDEJA', context: 'global', kind: 'asr_noise' },

  /* send-dialog negation trap: "no canceles" must not fire CANCELAR */
  { utterance: 'no canceles, dejalo abierto', expected: null, context: 'send_dialog', kind: 'negative' },
];

export const XL_BY_KIND = (kind: XlCase['kind']): XlCase[] =>
  PHRASE_BANK_XL.filter((c) => c.kind === kind);
