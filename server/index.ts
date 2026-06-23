/**
 * Yuemail HTTP server.
 *
 * Express 4. Binds 127.0.0.1:5180 (loopback only -- never LAN, never
 * external interface). Mounts:
 *   /api/health
 *   /api/vault/*       (BYOK -- read key names + statuses; write set/delete)
 *   /api/documents/*   (CRUD + .docx render on demand)
 *   /api/signature/*   (PNG read/write/delete)
 *   /api/email/send    (POST -- rejects when SMTP unconfigured)
 *   /api/email/autoconfig (GET -- IMAP/SMTP discovery from the address)
 *   /api/email/verify  (POST -- live IMAP/SMTP connection test)
 *   /api/inbox/list    (GET  -- imapflow last N envelopes)
 *   /api/contacts/*    (CRUD -- address book; senders auto-register here)
 *   /*                 (static SPA from dist/, when present)
 *
 * ASCII-only.
 */
import express, { type Express } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

import { registerVaultRoutes }     from './routes/vault.js';
import { registerDocumentsRoutes } from './routes/documents.js';
import { registerSignatureRoutes } from './routes/signature.js';
import { registerEmailRoutes }     from './routes/email.js';
import { registerInboxRoutes }     from './routes/inbox.js';
import { registerContactsRoutes }  from './routes/contacts.js';
import { registerSettingsRoutes }  from './routes/settings.js';
import { registerBrainRoutes }     from './routes/brain.js';
import { registerVoiceRoutes }     from './routes/voice.js';

export const HOST = '127.0.0.1';
export const PORT = 5180;

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/** The package version, read from package.json at startup so /api/health
 *  never drifts from the published version again (the 0.3.0 vs 0.4.0
 *  mismatch was a hardcoded string). Walks up from the build dir to find it. */
function readPackageVersion(): string {
  for (const up of ['..', '../..', '../../..']) {
    try {
      const p = path.join(__dirname, up, 'package.json');
      if (existsSync(p)) {
        const v = (JSON.parse(readFileSync(p, 'utf-8')) as { version?: unknown }).version;
        if (typeof v === 'string' && v) return v;
      }
    } catch { /* keep walking up */ }
  }
  return '0.0.0';
}
export const APP_VERSION = readPackageVersion();

export interface BuildAppOpts {
  /** Override the static SPA root. Defaults to ../dist. */
  staticRoot?: string;
}

export function buildApp(opts: BuildAppOpts = {}): Express {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, version: APP_VERSION });
  });

  registerVaultRoutes(app);
  registerDocumentsRoutes(app);
  registerSignatureRoutes(app);
  registerEmailRoutes(app);
  registerInboxRoutes(app);
  registerContactsRoutes(app);
  registerSettingsRoutes(app);
  registerBrainRoutes(app);
  registerVoiceRoutes(app);

  /* Static SPA -- present in production builds, absent in dev. */
  const staticRoot = opts.staticRoot ?? path.resolve(__dirname, '..', 'dist');
  if (existsSync(staticRoot)) {
    app.use(express.static(staticRoot));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(staticRoot, 'index.html'));
    });
  }

  /* Error fallback. Keeps the response shape stable for the SPA. */
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: message });
  });

  return app;
}

export async function startServer(opts: BuildAppOpts = {}): Promise<{ close: () => Promise<void>; url: string }> {
  const app = buildApp(opts);
  return await new Promise((resolve, reject) => {
    const server = app.listen(PORT, HOST, () => {
      const url = 'http://' + HOST + ':' + PORT;
      resolve({
        url,
        close: () => new Promise<void>((r) => { server.close(() => r()); }),
      });
    });
    server.on('error', reject);
  });
}

/* Direct-run entry: `node server-dist/index.js`. */
const isDirectRun =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
  startServer().then((s) => {
    process.stdout.write('Yuemail server listening at ' + s.url + '\n');
  }).catch((err) => {
    process.stderr.write('Failed to start: ' + (err instanceof Error ? err.message : String(err)) + '\n');
    process.exitCode = 1;
  });
}
