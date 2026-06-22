/**
 * Phrase bank for the Brain (v0.5.0).
 *
 * Two kinds of entries:
 *   - canonical: the documented phrasings; the fixed-phrase matcher (camino
 *     2 / safety net) MUST route these, so the app works even with the
 *     Brain off or offline.
 *   - freeform:  natural, paraphrased requests a person actually says; only
 *     the Brain (camino 1) is expected to route these. The live bench
 *     (tools/brain_bench.mjs) measures how many the real model gets right.
 *
 * ASCII-only.
 */
import type { VoiceCommandType, VoiceContext } from '../../src/voice/commands.js';

export interface PhraseCase {
  utterance: string;
  expected: VoiceCommandType;
  context: VoiceContext;
  kind: 'canonical' | 'freeform';
  /** For ENVIAR cases, the email the resolver should land on. */
  expectedEmail?: string;
}

export const PHRASE_BANK: ReadonlyArray<PhraseCase> = [
  /* --- canonical (matcher must catch) --- */
  { utterance: 'nuevo documento', expected: 'NUEVO_DOCUMENTO', context: 'global', kind: 'canonical' },
  { utterance: 'documento nuevo', expected: 'NUEVO_DOCUMENTO', context: 'global', kind: 'canonical' },
  { utterance: 'abrir documento', expected: 'ABRIR_DOCUMENTO', context: 'global', kind: 'canonical' },
  { utterance: 'guardar firma', expected: 'GUARDAR_FIRMA', context: 'global', kind: 'canonical' },
  { utterance: 'firmar', expected: 'FIRMAR', context: 'global', kind: 'canonical' },
  { utterance: 'iniciar dictado', expected: 'INICIAR_DICTADO', context: 'global', kind: 'canonical' },
  { utterance: 'fin dictado', expected: 'FIN_DICTADO', context: 'global', kind: 'canonical' },
  { utterance: 'enviar a ana arroba ejemplo punto com', expected: 'ENVIAR', context: 'global', kind: 'canonical', expectedEmail: 'ana@ejemplo.com' },
  { utterance: 'leer bandeja', expected: 'LEER_BANDEJA', context: 'global', kind: 'canonical' },
  { utterance: 'abrir configuracion', expected: 'ABRIR_CONFIGURACION', context: 'global', kind: 'canonical' },
  { utterance: 'detener voz', expected: 'DETENER_VOZ', context: 'global', kind: 'canonical' },
  { utterance: 'encender microfono', expected: 'ENCENDER_MICROFONO', context: 'global', kind: 'canonical' },

  /* --- freeform (Brain only) --- */
  { utterance: 'che, arranquemos una carta nueva', expected: 'NUEVO_DOCUMENTO', context: 'global', kind: 'freeform' },
  { utterance: 'borra todo que empiezo de cero', expected: 'NUEVO_DOCUMENTO', context: 'global', kind: 'freeform' },
  { utterance: 'mostrame lo ultimo que escribi', expected: 'ABRIR_DOCUMENTO', context: 'global', kind: 'freeform' },
  { utterance: 'abrime el informe del banco', expected: 'ABRIR_DOCUMENTO', context: 'global', kind: 'freeform' },
  { utterance: 'pone mi firma al final', expected: 'FIRMAR', context: 'global', kind: 'freeform' },
  { utterance: 'quiero hacer mi firma', expected: 'GUARDAR_FIRMA', context: 'global', kind: 'freeform' },
  { utterance: 'voy a dictarte algo, tomame nota', expected: 'INICIAR_DICTADO', context: 'global', kind: 'freeform' },
  { utterance: 'listo, ya termine de dictar', expected: 'FIN_DICTADO', context: 'global', kind: 'freeform' },
  { utterance: 'mandaselo a juan arroba correo punto com por favor', expected: 'ENVIAR', context: 'global', kind: 'freeform', expectedEmail: 'juan@correo.com' },
  { utterance: 'quiero enviar este correo', expected: 'ENVIAR', context: 'global', kind: 'freeform' },
  { utterance: 'fijate si me llego algo nuevo', expected: 'LEER_BANDEJA', context: 'global', kind: 'freeform' },
  { utterance: 'que correos tengo sin leer', expected: 'LEER_BANDEJA', context: 'global', kind: 'freeform' },
  { utterance: 'donde configuro mi cuenta de correo', expected: 'ABRIR_CONFIGURACION', context: 'global', kind: 'freeform' },
  { utterance: 'basta, callate', expected: 'DETENER_VOZ', context: 'global', kind: 'freeform' },

  /* --- freeform inside modals --- */
  { utterance: 'dale, mandalo ya', expected: 'CONFIRMAR_ENVIO', context: 'send_dialog', kind: 'freeform' },
  { utterance: 'no, mejor no lo mandes', expected: 'CANCELAR', context: 'send_dialog', kind: 'freeform' },
  { utterance: 'queres probar si la conexion anda', expected: 'PROBAR_CONEXION', context: 'settings_dialog', kind: 'freeform' },
  { utterance: 'completa los servidores solo', expected: 'DETECTAR_SERVIDORES', context: 'settings_dialog', kind: 'freeform' },
];

export const CANONICAL_CASES = PHRASE_BANK.filter((c) => c.kind === 'canonical');
export const FREEFORM_CASES = PHRASE_BANK.filter((c) => c.kind === 'freeform');
