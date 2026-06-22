/**
 * /api/brain/* routes (v0.5.0 -- camino 1).
 *
 *  GET  /api/brain/config            -> { config, has_key }
 *  PUT  /api/brain/config            -> body partial -> { config, has_key }
 *  GET  /api/brain/models?provider=  -> model list (live or static)
 *  POST /api/brain/resolve           -> body { utterance, context } ->
 *                                       BrainResolveResult
 *
 * has_key is a boolean only: the decrypted provider key never leaves the
 * server, exactly like the mail credentials.
 *
 * ASCII-only.
 */
import type { Express, Request, Response } from 'express';
import {
  readBrainConfig, patchBrainConfig, vaultSlotForProvider,
  ALL_BRAIN_PROVIDERS, type BrainConfig, type BrainProvider,
} from '../brain/config.js';
import { providerNeedsKey } from '../brain/providers.js';
import { listProviderModels } from '../brain/provider_models.js';
import { resolveUtterance } from '../brain/router.js';
import { getKey } from '../vault.js';

function isProvider(v: unknown): v is BrainProvider {
  return typeof v === 'string' && (ALL_BRAIN_PROVIDERS as readonly string[]).includes(v);
}

async function hasKeyFor(provider: BrainProvider): Promise<boolean> {
  if (!providerNeedsKey(provider)) return true; /* ollama is keyless */
  try {
    const k = await getKey(vaultSlotForProvider(provider));
    return typeof k === 'string' && k.length > 0;
  } catch {
    return false;
  }
}

function publicConfig(cfg: BrainConfig): Record<string, unknown> {
  return {
    enabled: cfg.enabled,
    provider: cfg.provider,
    model: cfg.model,
    min_confidence: cfg.min_confidence,
    timeout_ms: cfg.timeout_ms,
    all_providers: ALL_BRAIN_PROVIDERS,
  };
}

export function registerBrainRoutes(app: Express): void {
  app.get('/api/brain/config', async (_req: Request, res: Response) => {
    const cfg = await readBrainConfig();
    res.json({ ok: true, config: publicConfig(cfg), has_key: await hasKeyFor(cfg.provider) });
  });

  app.put('/api/brain/config', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: Partial<BrainConfig> = {};
    if (typeof body['enabled'] === 'boolean') patch.enabled = body['enabled'];
    if (isProvider(body['provider'])) patch.provider = body['provider'];
    if (typeof body['model'] === 'string') patch.model = body['model'];
    if (typeof body['min_confidence'] === 'number') patch.min_confidence = body['min_confidence'];
    if (typeof body['timeout_ms'] === 'number') patch.timeout_ms = body['timeout_ms'];
    const cfg = await patchBrainConfig(patch);
    res.json({ ok: true, config: publicConfig(cfg), has_key: await hasKeyFor(cfg.provider) });
  });

  app.get('/api/brain/models', async (req: Request, res: Response) => {
    const provider = req.query['provider'];
    if (!isProvider(provider)) {
      res.status(400).json({ ok: false, error: 'unknown provider' });
      return;
    }
    let apiKey: string | null = null;
    try { apiKey = (await getKey(vaultSlotForProvider(provider))) ?? null; } catch { apiKey = null; }
    const result = await listProviderModels(provider, { apiKey });
    res.json({ ok: true, ...result });
  });

  app.post('/api/brain/resolve', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { utterance?: unknown; context?: unknown };
    const utterance = typeof body.utterance === 'string' ? body.utterance : '';
    const ctxRaw = typeof body.context === 'string' ? body.context : 'global';
    const context = (['global', 'send_dialog', 'signature_pad', 'settings_dialog'].includes(ctxRaw)
      ? ctxRaw : 'global') as 'global' | 'send_dialog' | 'signature_pad' | 'settings_dialog';
    if (utterance.trim().length === 0) {
      res.status(400).json({ ok: false, reason: 'unparseable' });
      return;
    }
    const result = await resolveUtterance(utterance, context);
    res.json(result);
  });
}
