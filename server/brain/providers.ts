/**
 * Brain provider clients -- raw fetch, no SDK (keeps the package light, the
 * lesson Forge learned: SDKs blow the bundle budget). One text-in/text-out
 * surface, three wire formats:
 *
 *   google_ai  -> Gemini generateContent  (default brain)
 *   anthropic  -> /v1/messages
 *   openai-compatible group (openai/deepseek/xai/mistral/qwen/zai/ollama)
 *              -> /chat/completions
 *
 * The API key is passed in (the router reads it from the vault); it travels
 * in a header, never a query string, and is never logged.
 *
 * ASCII-only.
 */
import type { BrainProvider } from './config.js';

export interface CompleteOpts {
  provider: BrainProvider;
  model: string;
  apiKey: string | null;
  system: string;
  user: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

/** OpenAI-compatible base URLs (no trailing slash; '/chat/completions' is
 *  appended). Ollama is local; override with YUEMAIL_OLLAMA_BASE_URL. */
function openAiCompatBase(provider: BrainProvider): string {
  switch (provider) {
    case 'openai':   return 'https://api.openai.com/v1';
    case 'deepseek': return 'https://api.deepseek.com/v1';
    case 'xai':      return 'https://api.x.ai/v1';
    case 'mistral':  return 'https://api.mistral.ai/v1';
    case 'qwen':     return 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
    case 'zai':      return 'https://open.bigmodel.cn/api/paas/v4';
    case 'ollama':   return process.env['YUEMAIL_OLLAMA_BASE_URL'] || 'http://localhost:11434/v1';
    default:         return '';
  }
}

function isOpenAiCompatible(p: BrainProvider): boolean {
  return p === 'openai' || p === 'deepseek' || p === 'xai' || p === 'mistral'
    || p === 'qwen' || p === 'zai' || p === 'ollama';
}

/** Some providers need a key; ollama is keyless (local). */
export function providerNeedsKey(p: BrainProvider): boolean {
  return p !== 'ollama';
}

async function withTimeout<T>(timeoutMs: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(t);
  }
}

async function httpJson(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<unknown> {
  const r = await fetchImpl(url, { ...init, signal });
  if (!r.ok) {
    let detail = '';
    try { detail = (await r.text()).slice(0, 120).replace(/\s+/g, ' '); } catch { /* ignore */ }
    throw new Error('http ' + r.status + (detail ? ' ' + detail : ''));
  }
  return await r.json();
}

async function completeGemini(o: CompleteOpts, fetchImpl: typeof fetch): Promise<string> {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
    + encodeURIComponent(o.model) + ':generateContent';
  const body = {
    /* Gemini folds the system prompt into systemInstruction. */
    systemInstruction: { parts: [{ text: o.system }] },
    contents: [{ role: 'user', parts: [{ text: o.user }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  };
  return withTimeout(o.timeoutMs, async (signal) => {
    const j = await httpJson(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': o.apiKey ?? '' },
      body: JSON.stringify(body),
    }, fetchImpl, signal) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const parts = j.candidates?.[0]?.content?.parts ?? [];
    return parts.map((p) => p.text ?? '').join('').trim();
  });
}

async function completeAnthropic(o: CompleteOpts, fetchImpl: typeof fetch): Promise<string> {
  const body = {
    model: o.model,
    max_tokens: 512,
    temperature: 0,
    system: o.system,
    messages: [{ role: 'user', content: o.user }],
  };
  return withTimeout(o.timeoutMs, async (signal) => {
    const j = await httpJson('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': o.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    }, fetchImpl, signal) as { content?: Array<{ text?: string }> };
    return (j.content ?? []).map((c) => c.text ?? '').join('').trim();
  });
}

async function completeOpenAiCompatible(o: CompleteOpts, fetchImpl: typeof fetch): Promise<string> {
  const base = openAiCompatBase(o.provider);
  const body: Record<string, unknown> = {
    model: o.model,
    temperature: 0,
    messages: [
      { role: 'system', content: o.system },
      { role: 'user', content: o.user },
    ],
  };
  /* Ask for a JSON object where the API supports it (OpenAI proper). The
   * prompt also demands JSON, so providers that ignore this still comply. */
  if (o.provider === 'openai') body['response_format'] = { type: 'json_object' };
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (o.apiKey) headers['authorization'] = 'Bearer ' + o.apiKey;
  return withTimeout(o.timeoutMs, async (signal) => {
    const j = await httpJson(base + '/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }, fetchImpl, signal) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return (j.choices?.[0]?.message?.content ?? '').trim();
  });
}

/**
 * One round-trip to the configured brain. Returns the raw model text
 * (expected to be JSON; the router parses it). Throws on transport error,
 * non-2xx, or timeout so the caller can fall back to the phrase matcher.
 */
export async function complete(o: CompleteOpts): Promise<string> {
  const fetchImpl = o.fetchImpl ?? fetch;
  if (o.provider === 'google_ai') return completeGemini(o, fetchImpl);
  if (o.provider === 'anthropic') return completeAnthropic(o, fetchImpl);
  if (isOpenAiCompatible(o.provider)) return completeOpenAiCompatible(o, fetchImpl);
  throw new Error('unknown provider: ' + o.provider);
}
