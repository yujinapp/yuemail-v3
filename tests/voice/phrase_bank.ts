/**
 * Voice phrase bank for the live end-to-end voice bench (v0.6.0).
 *
 * This bank drives the FULL camino-1 ear+brain pipe, not the matcher:
 *
 *   text -> Google Text-to-Speech (audio) -> Google Speech-to-Text
 *        -> transcript -> Brain router -> command
 *
 * The success metric is COMMAND ACCURACY (did the spoken phrase route to the
 * right Yuemail command?), NOT letter-for-letter transcription: Google STT
 * legitimately rewrites "juan punto perez arroba gmail punto com" as
 * "juan.perez@gmail.com", and the Brain still has to route ENVIAR with the
 * right address. So the bench checks the command, and email payload only as a
 * secondary signal.
 *
 * HONESTY NOTE (stated in the bench output too): synthetic TTS voice is a
 * clean, well-articulated speaker -- it is NOT a person with dysarthria or
 * the slow/atypical speech this audience often produces. This bank proves the
 * whole pipe works and that Google STT + the Brain route correctly in good
 * conditions; the real-world number with atypical speech will be lower. The
 * 'asr_noise' cases deliberately feed already-garbled text so at least part of
 * the bank stresses the Brain the way a bad transcription would.
 *
 * Kinds:
 *   - clean:     a natural request, spoken plainly.
 *   - freeform:  paraphrase / regional variant, intent buried in filler.
 *   - email:     a spoken email address to be normalised + routed (ENVIAR).
 *   - asr_noise: text pre-garbled the way browser/Google STT mis-hears, so
 *                the synthesised audio carries the noise into the pipe.
 *   - negative:  off-topic / impossible. The Brain MUST decline so the app
 *                falls back instead of firing a wrong command. For someone who
 *                cannot easily undo an action, a false positive is the worst
 *                outcome -- worse than a graceful fallback.
 *
 * ASCII-only.
 */
import type { VoiceCommandType, VoiceContext } from '../../src/voice/commands.js';

export interface VoiceCase {
  /** The text we synthesise into speech and feed back through the ear. */
  text: string;
  /** Expected command, or null when the Brain should decline (negative). */
  expected: VoiceCommandType | null;
  context: VoiceContext;
  kind: 'clean' | 'freeform' | 'email' | 'asr_noise' | 'negative';
  /** For ENVIAR cases, the normalised email the route should surface. */
  expectedEmail?: string;
}

export const VOICE_PHRASE_BANK: ReadonlyArray<VoiceCase> = [
  /* ===================== clean global commands ===================== */
  { text: 'nuevo documento', expected: 'NUEVO_DOCUMENTO', context: 'global', kind: 'clean' },
  { text: 'abrir documento', expected: 'ABRIR_DOCUMENTO', context: 'global', kind: 'clean' },
  { text: 'firmar el documento', expected: 'FIRMAR', context: 'global', kind: 'clean' },
  { text: 'guardar firma', expected: 'GUARDAR_FIRMA', context: 'global', kind: 'clean' },
  { text: 'iniciar dictado', expected: 'INICIAR_DICTADO', context: 'global', kind: 'clean' },
  { text: 'finalizar dictado', expected: 'FIN_DICTADO', context: 'global', kind: 'clean' },
  { text: 'leer la bandeja de entrada', expected: 'LEER_BANDEJA', context: 'global', kind: 'clean' },
  { text: 'abrir la configuracion del correo', expected: 'ABRIR_CONFIGURACION', context: 'global', kind: 'clean' },
  { text: 'encender el microfono', expected: 'ENCENDER_MICROFONO', context: 'global', kind: 'clean' },
  { text: 'apagar el microfono', expected: 'APAGAR_MICROFONO', context: 'global', kind: 'clean' },

  /* ===================== freeform global ===================== */
  { text: 'che, empecemos una carta nueva de cero', expected: 'NUEVO_DOCUMENTO', context: 'global', kind: 'freeform' },
  { text: 'mostrame el ultimo documento que tenia guardado', expected: 'ABRIR_DOCUMENTO', context: 'global', kind: 'freeform' },
  { text: 'pone mi firma abajo de todo por favor', expected: 'FIRMAR', context: 'global', kind: 'freeform' },
  { text: 'voy a dictarte una carta, anota lo que digo', expected: 'INICIAR_DICTADO', context: 'global', kind: 'freeform' },
  { text: 'fijate si me llego algun correo nuevo', expected: 'LEER_BANDEJA', context: 'global', kind: 'freeform' },
  { text: 'necesito cambiar la clave de mi correo, llevame ahi', expected: 'ABRIR_CONFIGURACION', context: 'global', kind: 'freeform' },
  { text: 'ya esta, mandalo', expected: 'ENVIAR', context: 'global', kind: 'freeform' },
  { text: 'quiero mandar este correo que escribi', expected: 'ENVIAR', context: 'global', kind: 'freeform' },

  /* ===================== email (ENVIAR + spoken address) ===================== */
  { text: 'enviar a ana arroba ejemplo punto com', expected: 'ENVIAR', context: 'global', kind: 'email', expectedEmail: 'ana@ejemplo.com' },
  /* No "punto" between juan and perez -> the faithful reading glues them:
   * "juanperez@gmail.com". Asserting that keeps the bench honest. */
  { text: 'mandale el correo a juan perez arroba gmail punto com', expected: 'ENVIAR', context: 'global', kind: 'email', expectedEmail: 'juanperez@gmail.com' },
  { text: 'enviarle esto a mi hija a maria arroba hotmail punto com', expected: 'ENVIAR', context: 'global', kind: 'email', expectedEmail: 'maria@hotmail.com' },

  /* ===================== asr_noise (pre-garbled text into the pipe) ===================== */
  { text: 'nuebo documento', expected: 'NUEVO_DOCUMENTO', context: 'global', kind: 'asr_noise' },
  { text: 'leer band eja', expected: 'LEER_BANDEJA', context: 'global', kind: 'asr_noise' },
  { text: 'abrir configurasion', expected: 'ABRIR_CONFIGURACION', context: 'global', kind: 'asr_noise' },
  { text: 'firma r documento', expected: 'FIRMAR', context: 'global', kind: 'asr_noise' },

  /* ===================== contextual: send_dialog ===================== */
  { text: 'confirmar el envio', expected: 'CONFIRMAR_ENVIO', context: 'send_dialog', kind: 'clean' },
  { text: 'cancelar', expected: 'CANCELAR', context: 'send_dialog', kind: 'clean' },
  { text: 'campo destinatario', expected: 'ENFOCAR_CAMPO', context: 'send_dialog', kind: 'clean' },

  /* ===================== contextual: settings_dialog ===================== */
  { text: 'detectar los servidores automaticamente', expected: 'DETECTAR_SERVIDORES', context: 'settings_dialog', kind: 'freeform' },
  { text: 'probar la conexion', expected: 'PROBAR_CONEXION', context: 'settings_dialog', kind: 'clean' },
  { text: 'guardar la configuracion', expected: 'GUARDAR_CONFIG', context: 'settings_dialog', kind: 'clean' },

  /* ===================== negatives (Brain MUST decline) ===================== */
  { text: 'no, todavia no lo mandes', expected: null, context: 'global', kind: 'negative' },
  { text: 'que lindo dia hace hoy para salir a caminar', expected: null, context: 'global', kind: 'negative' },
  { text: 'me podes contar un chiste', expected: null, context: 'global', kind: 'negative' },
  { text: 'pedile una pizza a la pizzeria de la esquina', expected: null, context: 'global', kind: 'negative' },
];
