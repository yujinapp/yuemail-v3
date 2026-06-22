/**
 * Camino-1 command resolver (v0.5.0).
 *
 * The Brain (server-side AI) leads: it reads the free-spoken utterance and
 * picks the Yuemail command. The fixed-phrase matcher (parseCommand) is
 * camino 2 -- the safety net used when the Brain is disabled, has no key,
 * the network is down, or it answers below its confidence threshold. A
 * person who depends on this app is never left without it.
 *
 * The Brain returns a command type + a raw payload; payload normalisation
 * (email extraction, field-key resolution) happens here, where the field
 * specs already live, so the server stays decoupled from the UI vocabulary.
 *
 * ASCII-only.
 */
import {
  parseCommand,
  extractEmail,
  resolveDialogField,
  FIELD_SPECS_BY_CONTEXT,
  type VoiceCommand,
  type VoiceCommandType,
  type VoiceContext,
  type ParseOpts,
} from './commands.js';
import { api, type BrainResolveResponse } from '../lib/api.js';

/** Map the Brain's {type, payload} onto a VoiceCommand, normalising the
 *  payload per command. Returns undefined when the payload is required but
 *  cannot be resolved, so the caller can fall back to the matcher. */
function brainToCommand(
  brain: Extract<BrainResolveResponse, { ok: true }>,
  raw: string,
  context: VoiceContext,
): VoiceCommand | undefined {
  const type = brain.type as VoiceCommandType;
  const normalized = raw.toLowerCase().trim();
  const cmd: VoiceCommand = { type, raw, normalized };

  if (type === 'ENVIAR') {
    /* Prefer the Brain's normalised email; verify it; else mine the raw. */
    const candidate = brain.payload && /@/.test(brain.payload) ? brain.payload.toLowerCase() : undefined;
    const email = candidate && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : extractEmail(raw);
    if (email) cmd.payload = email;
    return cmd;
  }

  if (type === 'ABRIR_DOCUMENTO') {
    if (brain.payload && brain.payload.length > 0) cmd.payload = brain.payload;
    return cmd;
  }

  if (type === 'ENFOCAR_CAMPO') {
    if (context === 'global') return undefined;
    const specs = FIELD_SPECS_BY_CONTEXT[context];
    const spec = brain.payload ? resolveDialogField(brain.payload, specs) : undefined;
    if (!spec) return undefined; /* cannot focus an unknown field -> let matcher try */
    cmd.payload = spec.key;
    return cmd;
  }

  if (type === 'BORRAR_CAMPO') {
    if (context !== 'global' && brain.payload) {
      const spec = resolveDialogField(brain.payload, FIELD_SPECS_BY_CONTEXT[context]);
      if (spec) cmd.payload = spec.key;
    }
    return cmd;
  }

  return cmd;
}

/**
 * Decide whether an utterance must be resolved by the fast literal matcher
 * instead of the cloud Brain. Two cases need instant, network-free routing
 * in the global (no-modal) context:
 *
 *   1. The dictation toggles ("iniciar dictado" / "fin dictado"). If these
 *      waited on the Brain, dictation would flip LATE: the first phrases get
 *      dropped while "iniciar" is still resolving, and "fin dictado" gets
 *      written as a paragraph because "stop" has not landed yet. They must
 *      take effect the instant they are heard. (PND-015)
 *   2. Any utterance WHILE dictation is already active: spoken words are
 *      document CONTENT, not commands, so the Brain must not re-read them.
 *
 * Returns the literal VoiceCommand to use, or undefined to defer to the
 * Brain. The toggles short-circuit even when dictation is OFF -- that is the
 * fix for the "first phrases lost" half of the bug.
 */
export function resolveLiterallyFirst(
  raw: string,
  context: VoiceContext,
  opts: ParseOpts,
  dictationOn: boolean,
): VoiceCommand | undefined {
  if (context !== 'global') return undefined;
  const literal = parseCommand(raw, context, opts);
  if (literal.type === 'INICIAR_DICTADO' || literal.type === 'FIN_DICTADO') return literal;
  if (dictationOn) return literal;
  return undefined;
}

export interface ResolveDeps {
  /** Test seam: stub the brain call. Defaults to api.brainResolve. */
  brainResolve?: (utterance: string, context: string) => Promise<BrainResolveResponse>;
}

/**
 * Resolve one finalised utterance into a command. Brain first; on any miss
 * or failure, the fixed-phrase matcher. Never throws: a transport error is
 * treated as a Brain miss.
 */
export async function resolveCommand(
  raw: string,
  context: VoiceContext = 'global',
  opts: ParseOpts = {},
  deps: ResolveDeps = {},
): Promise<VoiceCommand> {
  const fallback = (): VoiceCommand => parseCommand(raw, context, opts);

  /* While a field is armed inside a modal, the utterance IS the dictated
   * value -- do not send it to the Brain to be re-interpreted as a command.
   * The matcher already routes armed dictation to UNKNOWN, which the App
   * turns into the field value. */
  if (opts.armed === true && (context === 'send_dialog' || context === 'signature_pad')) {
    return fallback();
  }

  const call = deps.brainResolve ?? ((u, c) => api.brainResolve(u, c));
  let brain: BrainResolveResponse;
  try {
    brain = await call(raw, context);
  } catch {
    return fallback();
  }
  if (!brain.ok) return fallback();

  const mapped = brainToCommand(brain, raw, context);
  return mapped ?? fallback();
}
