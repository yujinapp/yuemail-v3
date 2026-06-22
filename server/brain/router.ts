/**
 * Brain router -- turns a free-spoken request into a Yuemail command.
 *
 * This is camino 1. Flow:
 *   1. Read brain config. If disabled -> { ok:false, reason:'disabled' }.
 *   2. Read the provider key from the vault (none + key required ->
 *      { ok:false, reason:'no_key' }).
 *   3. Ask the model to classify the utterance against the context's
 *      command catalog and return strict JSON {type, payload, confidence}.
 *   4. Validate: type must exist in the context catalog; confidence must
 *      clear min_confidence. Otherwise { ok:false, reason:'low_confidence'|
 *      'unparseable'|'not_in_catalog' }.
 *
 * Any { ok:false } (including a thrown transport/timeout error, caught
 * here) tells the caller to fall back to the fixed-phrase matcher. The
 * payload is returned raw -- the client normalises it (email extraction,
 * field-key resolution) where the field specs already live.
 *
 * ASCII-only.
 */
import { readBrainConfig } from './config.js';
import { vaultSlotForProvider } from './config.js';
import { complete, providerNeedsKey } from './providers.js';
import { COMMANDS_BY_CONTEXT, type BrainContext, type BrainCommandSpec } from './catalog.js';
import { getKey } from '../vault.js';

export interface BrainResolveOk {
  ok: true;
  type: string;
  payload?: string;
  confidence: number;
  source: 'brain';
  model: string;
}
export interface BrainResolveMiss {
  ok: false;
  reason: 'disabled' | 'no_key' | 'unparseable' | 'not_in_catalog' | 'low_confidence' | 'error';
  detail?: string;
}
export type BrainResolveResult = BrainResolveOk | BrainResolveMiss;

export interface ResolveOpts {
  /** Test seam: inject a fake fetch. */
  fetchImpl?: typeof fetch;
  /** Test seam: inject the key instead of reading the vault. */
  apiKeyOverride?: string | null;
}

function buildSystemPrompt(context: BrainContext, commands: ReadonlyArray<BrainCommandSpec>): string {
  const lines: string[] = [];
  lines.push('Sos el cerebro de Yuemail, un cliente de correo por voz para personas con discapacidad.');
  lines.push('Tu unica tarea: leer lo que la persona dijo y elegir EXACTAMENTE UNO de los comandos de la lista.');
  lines.push('Contexto actual de la pantalla: ' + context + '.');
  lines.push('');
  lines.push('Comandos disponibles (elegi el id tal cual):');
  for (const c of commands) {
    const ex = c.examples.slice(0, 3).join(' | ');
    const pay = c.payload ? ' [payload: ' + c.payload + ']' : '';
    lines.push('- ' + c.type + pay + ': ' + c.description + ' Ej: ' + ex);
  }
  lines.push('');
  lines.push('Reglas:');
  lines.push('- Responde SOLO con un objeto JSON, sin texto extra, sin markdown.');
  lines.push('- Forma: {"type": "<ID>", "payload": "<texto o vacio>", "confidence": <0 a 1>}.');
  lines.push('- "type" debe ser uno de los ids de arriba, en mayusculas, identico.');
  lines.push('- Para payload "email": devolve el correo normalizado (ej. "ana@ejemplo.com").');
  lines.push('- Para payload "name": devolve el nombre del documento mencionado.');
  lines.push('- Para payload "field": devolve el nombre del campo mencionado (ej. "correo", "asunto").');
  lines.push('- Si no hay payload, usa "".');
  lines.push('');
  lines.push('Cuando NO debes elegir comando, responde {"type": "NINGUNO", "payload": "", "confidence": 0}:');
  lines.push('- Si la persona NIEGA o pospone la accion ("no lo mandes", "todavia no borres", "no abras"). Una negacion NUNCA dispara el comando negado.');
  lines.push('- Si es una pregunta, un saludo, un agradecimiento o charla que no pide ninguna accion de la lista.');
  lines.push('- Si el pedido se parece a una accion que NO figura en la lista de arriba: NO elijas la mas parecida, responde NINGUNO.');
  lines.push('- Ante la duda, NINGUNO. Para una persona que depende de esta app, no hacer nada es mejor que ejecutar el comando equivocado.');
  lines.push('Elegi un comando de la lista SOLO si la persona pide hacer esa accion concreta, ahora y en forma afirmativa.');
  return lines.join('\n');
}

/** Pull the first JSON object out of a model reply (handles stray prose or
 *  ```json fences a provider may add despite instructions). */
function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(trimmed); } catch { /* try to locate a brace span */ }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(trimmed.slice(start, end + 1)); } catch { /* give up */ }
  }
  return null;
}

/** Parse + validate a raw model reply against the context catalog. Exported
 *  for unit testing without a network round-trip. */
export function parseBrainReply(
  raw: string,
  context: BrainContext,
  minConfidence: number,
  model: string,
): BrainResolveResult {
  const obj = extractJsonObject(raw);
  if (!obj || typeof obj !== 'object') return { ok: false, reason: 'unparseable' };
  const rec = obj as Record<string, unknown>;
  const type = typeof rec['type'] === 'string' ? (rec['type'] as string).trim().toUpperCase() : '';
  /* Explicit decline sentinel: the model judged no command applies (negation,
   * question, chit-chat, or an action outside this context's catalog). Treat
   * it as a clean low-confidence miss so the caller falls back, rather than a
   * hallucinated-command miss. */
  if (type === 'NINGUNO' || type === 'NADA') return { ok: false, reason: 'low_confidence', detail: 'ninguno' };
  const known = new Set(COMMANDS_BY_CONTEXT[context].map((c) => c.type));
  if (!type || !known.has(type)) return { ok: false, reason: 'not_in_catalog', detail: type };
  let confidence = typeof rec['confidence'] === 'number' ? rec['confidence'] : 0;
  if (Number.isNaN(confidence)) confidence = 0;
  if (confidence < 0) confidence = 0;
  if (confidence > 1) confidence = 1;
  if (confidence < minConfidence) return { ok: false, reason: 'low_confidence', detail: String(confidence) };
  const result: BrainResolveOk = { ok: true, type, confidence, source: 'brain', model };
  const payload = rec['payload'];
  if (typeof payload === 'string' && payload.trim().length > 0) result.payload = payload.trim();
  return result;
}

export async function resolveUtterance(
  utterance: string,
  context: BrainContext = 'global',
  opts: ResolveOpts = {},
): Promise<BrainResolveResult> {
  const text = (utterance ?? '').trim();
  if (text.length === 0) return { ok: false, reason: 'unparseable' };

  const cfg = await readBrainConfig();
  if (!cfg.enabled) return { ok: false, reason: 'disabled' };

  let apiKey: string | null = opts.apiKeyOverride ?? null;
  if (apiKey === null && opts.apiKeyOverride === undefined) {
    try { apiKey = (await getKey(vaultSlotForProvider(cfg.provider))) ?? null; } catch { apiKey = null; }
  }
  if (providerNeedsKey(cfg.provider) && !apiKey) return { ok: false, reason: 'no_key' };

  const commands = COMMANDS_BY_CONTEXT[context];
  const system = buildSystemPrompt(context, commands);

  try {
    const raw = await complete({
      provider: cfg.provider,
      model: cfg.model,
      apiKey,
      system,
      user: text,
      timeoutMs: cfg.timeout_ms,
      fetchImpl: opts.fetchImpl,
    });
    return parseBrainReply(raw, context, cfg.min_confidence, cfg.model);
  } catch (err) {
    return { ok: false, reason: 'error', detail: err instanceof Error ? err.message.slice(0, 120) : String(err) };
  }
}
