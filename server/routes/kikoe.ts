/**
 * /api/kikoe/* routes -- the voice trainer (add-on @yujinapp/nac3-kikoe).
 *
 *  GET  /api/kikoe/state    -> { ok, mode, metrics, templates }
 *  GET  /api/kikoe/config   -> { ok, mode }
 *  PUT  /api/kikoe/config   -> { mode } -> { ok, mode }
 *  POST /api/kikoe/enroll   -> { command, fingerprints, replace? } -> { ok, samples }
 *  POST /api/kikoe/train    -> { command? } -> { ok, trained }
 *  POST /api/kikoe/forget   -> { command } -> { ok }
 *  POST /api/kikoe/observe-outcome -> { command, accepted } -> { ok }
 *  POST /api/kikoe/observe-cloud   -> { command, agreed }   -> { ok }
 *
 * The browser extracts the numeric fingerprints (so audio never leaves the
 * device) and posts only numbers here. Templates are returned so the client
 * can match locally without a round-trip per utterance.
 *
 * ASCII-only.
 */
import { type Express, type Request, type Response } from 'express';
import { getKikoeEngine, DEFAULT_MODE } from '../voice/kikoe.js';
import { ALL_ROUTER_MODES, type Fingerprint, type RouterMode } from '@yujinapp/nac3-kikoe';

/** Validate + coerce posted fingerprints into clean number[][] frames. Returns
 *  null when the payload is not a usable fingerprint list. */
function parseFingerprints(v: unknown): Fingerprint[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const out: Fingerprint[] = [];
  for (const fp of v) {
    const frames = (fp as { frames?: unknown })?.frames;
    if (!Array.isArray(frames) || frames.length === 0) return null;
    const cleanFrames: number[][] = [];
    for (const row of frames) {
      if (!Array.isArray(row) || row.length === 0) return null;
      const nums = row.filter((n) => typeof n === 'number' && Number.isFinite(n)) as number[];
      if (nums.length !== row.length) return null;
      cleanFrames.push(nums);
    }
    out.push({ frames: cleanFrames });
  }
  return out;
}

function isMode(v: unknown): v is RouterMode {
  return (ALL_ROUTER_MODES as readonly string[]).includes(v as string);
}

export function registerKikoeRoutes(app: Express): void {
  const engine = getKikoeEngine();

  app.get('/api/kikoe/state', async (_req: Request, res: Response) => {
    const [mode, metrics, templates] = await Promise.all([
      engine.getMode(), engine.listMetrics(), engine.getTemplates(),
    ]);
    res.json({ ok: true, mode, metrics, templates });
  });

  app.get('/api/kikoe/config', async (_req: Request, res: Response) => {
    res.json({ ok: true, mode: await engine.getMode() });
  });

  app.put('/api/kikoe/config', async (req: Request, res: Response) => {
    const mode = (req.body ?? {})['mode'];
    if (!isMode(mode)) {
      res.status(400).json({ ok: false, error: 'Modo invalido. Use: ' + ALL_ROUTER_MODES.join(', ') + '.' });
      return;
    }
    await engine.setMode(mode);
    res.json({ ok: true, mode });
  });

  app.post('/api/kikoe/enroll', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const command = typeof body['command'] === 'string' ? body['command'].trim() : '';
    if (command.length === 0) {
      res.status(400).json({ ok: false, error: 'Falta el comando a entrenar.' });
      return;
    }
    const fingerprints = parseFingerprints(body['fingerprints']);
    if (!fingerprints) {
      res.status(400).json({ ok: false, error: 'Las huellas enviadas no son validas (se esperan vectores numericos).' });
      return;
    }
    const replace = body['replace'] === true;
    await engine.enrollFingerprints(command, fingerprints, { replace });
    const metrics = await engine.listMetrics();
    const row = metrics.find((m) => m.command === command);
    res.json({ ok: true, samples: row?.samples ?? fingerprints.length });
  });

  app.post('/api/kikoe/train', async (req: Request, res: Response) => {
    const command = typeof (req.body ?? {})['command'] === 'string' ? (req.body['command'] as string).trim() : undefined;
    const { trained } = await engine.train(command && command.length > 0 ? command : undefined);
    res.json({ ok: true, trained });
  });

  app.post('/api/kikoe/forget', async (req: Request, res: Response) => {
    const command = typeof (req.body ?? {})['command'] === 'string' ? (req.body['command'] as string).trim() : '';
    if (command.length === 0) {
      res.status(400).json({ ok: false, error: 'Falta el comando a olvidar.' });
      return;
    }
    await engine.forget(command);
    res.json({ ok: true });
  });

  app.post('/api/kikoe/observe-outcome', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const command = typeof body['command'] === 'string' ? body['command'].trim() : '';
    if (command.length === 0 || typeof body['accepted'] !== 'boolean') {
      res.status(400).json({ ok: false, error: 'Se requiere command y accepted (booleano).' });
      return;
    }
    await engine.observeOutcome(command, body['accepted']);
    res.json({ ok: true });
  });

  app.post('/api/kikoe/observe-cloud', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const command = typeof body['command'] === 'string' ? body['command'].trim() : '';
    if (command.length === 0 || typeof body['agreed'] !== 'boolean') {
      res.status(400).json({ ok: false, error: 'Se requiere command y agreed (booleano).' });
      return;
    }
    await engine.observeCloud(command, body['agreed']);
    res.json({ ok: true });
  });

  /* Expose the default mode so the client can label the perilla. */
  app.get('/api/kikoe/default-mode', (_req: Request, res: Response) => {
    res.json({ ok: true, mode: DEFAULT_MODE });
  });
}
