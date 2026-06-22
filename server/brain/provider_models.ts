/**
 * Brain model lists per provider (mirrors Forge provider_models): a live
 * query when a key is present, a small embedded static list otherwise so
 * the selector is never empty offline.
 *
 * Keys travel in headers only, never query strings, never logged.
 * ASCII-only.
 */
import type { BrainProvider } from './config.js';

export interface ProviderModel { id: string; display_name: string }
export interface ModelListResult {
  provider: BrainProvider;
  models: ProviderModel[];
  source: 'live' | 'static';
  error?: string;
}

/* Static fallback -- stable ids known at build time. The user's default
 * (Gemini Flash Lite) leads the google_ai list. */
const STATIC_MODELS: Record<BrainProvider, ProviderModel[]> = {
  google_ai: [
    { id: 'gemini-3.1-flash-lite', display_name: 'Gemini 3.1 Flash Lite (default)' },
    { id: 'gemini-2.5-flash-lite', display_name: 'Gemini 2.5 Flash Lite' },
    { id: 'gemini-2.5-flash',      display_name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro',        display_name: 'Gemini 2.5 Pro' },
  ],
  anthropic: [
    { id: 'claude-haiku-4-5-20251001', display_name: 'Claude Haiku 4.5' },
    { id: 'claude-sonnet-4-6',         display_name: 'Claude Sonnet 4.6' },
    { id: 'claude-opus-4-8',           display_name: 'Claude Opus 4.8' },
  ],
  openai: [
    { id: 'gpt-4o-mini', display_name: 'GPT-4o mini' },
    { id: 'gpt-4o',      display_name: 'GPT-4o' },
  ],
  deepseek: [
    { id: 'deepseek-chat',     display_name: 'DeepSeek Chat' },
    { id: 'deepseek-reasoner', display_name: 'DeepSeek Reasoner' },
  ],
  xai: [
    { id: 'grok-3', display_name: 'Grok 3' },
  ],
  mistral: [
    { id: 'mistral-small-latest', display_name: 'Mistral Small' },
    { id: 'mistral-large-latest', display_name: 'Mistral Large' },
  ],
  qwen: [
    { id: 'qwen-plus', display_name: 'Qwen Plus' },
    { id: 'qwen-max',  display_name: 'Qwen Max' },
  ],
  zai: [
    { id: 'glm-4.6',     display_name: 'GLM-4.6' },
    { id: 'glm-4.5-air', display_name: 'GLM-4.5 Air' },
  ],
  ollama: [
    { id: 'llama3.1', display_name: 'Llama 3.1 (8B, local)' },
    { id: 'qwen2.5',  display_name: 'Qwen 2.5 (local)' },
  ],
};

function staticResult(provider: BrainProvider, error?: string): ModelListResult {
  const r: ModelListResult = { provider, models: STATIC_MODELS[provider] ?? [], source: 'static' };
  if (error) r.error = error.slice(0, 120);
  return r;
}

async function fetchJson(url: string, headers: Record<string, string>, fetchImpl: typeof fetch, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetchImpl(url, { headers, signal: controller.signal });
    if (!r.ok) throw new Error('http ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/** List models for a provider. Never throws -- degrades to the static list. */
export async function listProviderModels(
  provider: BrainProvider,
  opts: { apiKey?: string | null; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<ModelListResult> {
  const key = opts.apiKey ?? null;
  if (!key) return staticResult(provider);
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 4000;
  try {
    let models: ProviderModel[];
    if (provider === 'google_ai') {
      const j = await fetchJson('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100',
        { 'x-goog-api-key': key }, fetchImpl, timeoutMs) as {
        models?: Array<{ name?: string; displayName?: string; supportedGenerationMethods?: string[] }>;
      };
      models = (j.models ?? [])
        .filter((m) => typeof m.name === 'string' && (m.supportedGenerationMethods ?? []).includes('generateContent'))
        .map((m) => ({ id: (m.name as string).replace(/^models\//, ''), display_name: m.displayName || (m.name as string).replace(/^models\//, '') }));
    } else if (provider === 'anthropic') {
      const j = await fetchJson('https://api.anthropic.com/v1/models?limit=50',
        { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, fetchImpl, timeoutMs) as {
        data?: Array<{ id?: string; display_name?: string }>;
      };
      models = (j.data ?? []).filter((m) => typeof m.id === 'string').map((m) => ({ id: m.id as string, display_name: m.display_name || (m.id as string) }));
    } else if (provider === 'openai') {
      const j = await fetchJson('https://api.openai.com/v1/models',
        { 'authorization': 'Bearer ' + key }, fetchImpl, timeoutMs) as { data?: Array<{ id?: string }> };
      models = (j.data ?? []).filter((m) => typeof m.id === 'string' && /^(gpt|o[0-9])/.test(m.id as string)).map((m) => ({ id: m.id as string, display_name: m.id as string }));
    } else {
      return staticResult(provider);
    }
    if (models.length === 0) return staticResult(provider, 'empty model list');
    return { provider, models, source: 'live' };
  } catch (err) {
    return staticResult(provider, err instanceof Error ? err.message : String(err));
  }
}
