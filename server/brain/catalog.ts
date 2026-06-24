/**
 * Brain command catalog -- the set of Yuemail commands the AI router may
 * choose from (the "NAC3 tools" exposed to the brain). One entry per
 * action, grouped by the UI context where it is reachable.
 *
 * The command ids here MUST stay a subset of VoiceCommandType in
 * src/voice/commands.ts. tests/brain/catalog-symmetry.test.ts enforces it
 * in both directions so the brain can never pick a command the client
 * cannot execute, and a new global command is never silently unreachable
 * by voice (producer/consumer symmetry, SQ 14).
 *
 * ASCII-only.
 */

export type BrainContext = 'global' | 'send_dialog' | 'signature_pad' | 'settings_dialog';

export interface BrainCommandSpec {
  /** Matches a VoiceCommandType. */
  type: string;
  /** What the command does, in plain Spanish -- this is what the model reads. */
  description: string;
  /** Example utterances a person might say to trigger it. */
  examples: string[];
  /** 'email'/'name'/'contact' for a recipient, 'field' for a modal field,
   *  'title' for a dictated document title; absent otherwise. */
  payload?: 'email' | 'name' | 'field' | 'contact' | 'title';
}

/** Global commands -- reachable with no modal open. This is the main
 *  camino-1 surface. */
export const GLOBAL_COMMANDS: ReadonlyArray<BrainCommandSpec> = [
  { type: 'NUEVO_DOCUMENTO',     description: 'Vaciar el editor y empezar un documento nuevo.', examples: ['nuevo documento', 'arranquemos uno nuevo', 'borra todo y empezamos de cero', 'quiero escribir una carta nueva'] },
  { type: 'ABRIR_DOCUMENTO',     description: 'Abrir un documento guardado; opcionalmente por nombre.', examples: ['abrir documento', 'abri el informe', 'carga el ultimo que escribi', 'mostrame el documento del banco'], payload: 'name' },
  { type: 'GUARDAR_FIRMA',       description: 'Abrir el pad para crear o guardar la firma.', examples: ['guardar firma', 'quiero hacer mi firma', 'abri donde se dibuja la firma'] },
  { type: 'FIRMAR',              description: 'Insertar la firma ya guardada en el documento.', examples: ['firmar', 'firma el documento', 'pone mi firma aca', 'agrega la firma al final'] },
  { type: 'INICIAR_DICTADO',     description: 'Empezar a transcribir lo que la persona dicta al cuerpo del documento.', examples: ['iniciar dictado', 'voy a dictar', 'empeza a escribir lo que digo', 'tomame nota'] },
  { type: 'FIN_DICTADO',         description: 'Dejar de transcribir el dictado.', examples: ['fin dictado', 'listo, pare de escribir', 'termine de dictar'] },
  { type: 'ENVIAR',              description: 'Abrir el dialogo para enviar el documento por correo. El destinatario puede ser el NOMBRE de un contacto de la agenda (preferido) o una direccion de correo dictada.', examples: ['enviar a Maximiliano', 'mandaselo a ana arroba ejemplo punto com', 'envialo a mi hijo', 'enviar a Tamara'], payload: 'contact' },
  { type: 'RESPONDER',           description: 'Responder un correo. Sin nombre, responde al ultimo correo leido de la bandeja; con nombre, responde a ese contacto de la agenda.', examples: ['responder', 'contestar', 'responder a Ana', 'respondele a mi hijo'], payload: 'contact' },
  { type: 'LEER_BANDEJA',        description: 'Listar y leer los correos recibidos en la bandeja.', examples: ['leer bandeja', 'que correos tengo', 'fijate si llego algo', 'lee mis mensajes'] },
  { type: 'PONER_TITULO',        description: 'Poner o cambiar el titulo del documento que se esta escribiendo.', examples: ['poner titulo Carta al banco', 'el titulo es Informe anual', 'titular esto como Reclamo', 'ponle de titulo Solicitud'], payload: 'title' },
  { type: 'ABRIR_CONTACTOS',     description: 'Abrir la agenda de contactos (lista de personas a las que se les puede escribir).', examples: ['abrir contactos', 'mis contactos', 'la agenda', 'mostrame los contactos'] },
  { type: 'AGREGAR_CONTACTO',    description: 'Iniciar el alta guiada de un contacto nuevo: la app pide primero el nombre y despues el correo. Opcionalmente el nombre puede venir dicho ("agregar contacto Juan").', examples: ['agregar contacto', 'agendar a mi hijo', 'quiero anotar un contacto nuevo', 'dar de alta a Tamara', 'guarda este contacto'], payload: 'name' },
  { type: 'ABRIR_CONFIGURACION', description: 'Abrir la configuracion de la cuenta de correo.', examples: ['abrir configuracion', 'ajustes', 'quiero configurar mi correo', 'donde pongo mi clave'] },
  { type: 'ENCENDER_MICROFONO',  description: 'Encender el microfono.', examples: ['encender microfono', 'prende el microfono', 'activa la voz'] },
  { type: 'APAGAR_MICROFONO',    description: 'Apagar el microfono.', examples: ['apagar microfono', 'apaga el microfono'] },
  { type: 'DETENER_VOZ',         description: 'Silenciar / detener la voz.', examples: ['detener voz', 'silencio', 'calla', 'basta'] },
];

export const SEND_DIALOG_COMMANDS: ReadonlyArray<BrainCommandSpec> = [
  { type: 'CONFIRMAR_ENVIO', description: 'Confirmar y enviar el correo.', examples: ['confirmar', 'enviar ya', 'mandalo', 'dale, envialo'] },
  { type: 'CANCELAR',        description: 'Cerrar el dialogo sin enviar.', examples: ['cancelar', 'cerra', 'no, no lo mandes', 'volver'] },
  { type: 'ENFOCAR_CAMPO',   description: 'Enfocar un campo del envio para dictarlo (destinatario, asunto, cuerpo, adjuntar).', examples: ['campo destinatario', 'el asunto', 'quiero dictar el cuerpo', 'poner para quien es'], payload: 'field' },
  { type: 'BORRAR_CAMPO',    description: 'Vaciar el campo enfocado para dictarlo de nuevo.', examples: ['borrar campo', 'borralo y lo digo otra vez'] },
  { type: 'FIN_CAMPO',       description: 'Soltar el campo enfocado y recuperar los comandos del dialogo.', examples: ['fin campo', 'listo el campo'] },
];

export const SIGNATURE_PAD_COMMANDS: ReadonlyArray<BrainCommandSpec> = [
  { type: 'GUARDAR_FIRMA_PAD', description: 'Guardar la firma dibujada.', examples: ['guardar', 'listo', 'guarda esta firma'] },
  { type: 'BORRAR_FIRMA',      description: 'Limpiar el lienzo de firma.', examples: ['borrar', 'limpiar', 'empezar la firma de nuevo'] },
  { type: 'GENERAR_FIRMA',     description: 'Generar la firma cursiva a partir del nombre escrito.', examples: ['generar', 'hacela en cursiva', 'genera la firma'] },
  { type: 'CANCELAR',          description: 'Cerrar el pad sin guardar.', examples: ['cancelar', 'cerra', 'salir'] },
  { type: 'ENFOCAR_CAMPO',     description: 'Enfocar el nombre para dictarlo y generar la firma cursiva.', examples: ['campo nombre', 'quiero poner mi nombre'], payload: 'field' },
  { type: 'BORRAR_CAMPO',      description: 'Vaciar el nombre para dictarlo de nuevo.', examples: ['borrar campo'] },
  { type: 'FIN_CAMPO',         description: 'Soltar el campo.', examples: ['fin campo'] },
];

export const SETTINGS_DIALOG_COMMANDS: ReadonlyArray<BrainCommandSpec> = [
  { type: 'DETECTAR_SERVIDORES', description: 'Autocompletar los servidores a partir de la direccion de correo.', examples: ['detectar', 'autodetectar servidores', 'completalo automatico'] },
  { type: 'PROBAR_CONEXION',     description: 'Probar la conexion IMAP y SMTP en vivo.', examples: ['probar', 'verificar conexion', 'fijate si funciona'] },
  { type: 'GUARDAR_CONFIG',      description: 'Guardar la configuracion en la boveda cifrada.', examples: ['guardar', 'listo, guardalo'] },
  { type: 'CANCELAR',            description: 'Cerrar la configuracion sin guardar.', examples: ['cancelar', 'cerra', 'salir'] },
  { type: 'ENFOCAR_CAMPO',       description: 'Enfocar un campo de la configuracion para dictarlo (nombre, correo, contrasena, servidores, puertos, ssl).', examples: ['campo correo', 'la contrasena', 'servidor de entrada', 'quiero poner mi mail'], payload: 'field' },
  { type: 'BORRAR_CAMPO',        description: 'Vaciar el campo enfocado.', examples: ['borrar campo'] },
  { type: 'FIN_CAMPO',           description: 'Soltar el campo enfocado.', examples: ['fin campo'] },
];

export const COMMANDS_BY_CONTEXT: Record<BrainContext, ReadonlyArray<BrainCommandSpec>> = {
  global:          GLOBAL_COMMANDS,
  send_dialog:     SEND_DIALOG_COMMANDS,
  signature_pad:   SIGNATURE_PAD_COMMANDS,
  settings_dialog: SETTINGS_DIALOG_COMMANDS,
};

/** Every command type the brain may ever return, across all contexts. */
export function allBrainCommandTypes(): Set<string> {
  const s = new Set<string>();
  for (const ctx of Object.keys(COMMANDS_BY_CONTEXT) as BrainContext[]) {
    for (const c of COMMANDS_BY_CONTEXT[ctx]) s.add(c.type);
  }
  return s;
}
