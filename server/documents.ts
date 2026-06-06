/**
 * Yuemail document store (F3 / F13).
 *
 * Documents persist as JSON under ~/.yuemail/documents/<id>.json. No DB,
 * no user table, single-user. The store is process-local; callers are
 * responsible for serialising writes per document id.
 *
 * ASCII-only.
 */
import { promises as fs, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import type { YuemailDocument, DocumentBlock } from './docx-builder.js';

function homeDir(): string {
  const env = process.env['YUEMAIL_HOME'];
  return env ? path.resolve(env) : path.join(os.homedir(), '.yuemail');
}
function docsRoot(): string { return path.join(homeDir(), 'documents'); }

function ensureDocsDir(): void {
  const d = docsRoot();
  if (!existsSync(d)) {
    mkdirSync(d, { recursive: true, mode: 0o700 });
  }
}

function newId(): string {
  return 'doc-' + randomBytes(6).toString('hex');
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function listDocuments(): Promise<Array<{ id: string; title: string; updated_at: string }>> {
  ensureDocsDir();
  const files = (await fs.readdir(docsRoot())).filter((f) => f.endsWith('.json'));
  const out: Array<{ id: string; title: string; updated_at: string }> = [];
  for (const f of files) {
    try {
      const raw = await fs.readFile(path.join(docsRoot(), f), 'utf-8');
      const d = JSON.parse(raw) as YuemailDocument;
      out.push({ id: d.id, title: d.title, updated_at: d.updated_at });
    } catch { /* skip corrupt */ }
  }
  out.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return out;
}

export async function getDocument(id: string): Promise<YuemailDocument | undefined> {
  ensureDocsDir();
  const p = path.join(docsRoot(), id + '.json');
  if (!existsSync(p)) return undefined;
  const raw = await fs.readFile(p, 'utf-8');
  return JSON.parse(raw) as YuemailDocument;
}

export async function createDocument(input: { title?: string; blocks?: DocumentBlock[] }): Promise<YuemailDocument> {
  ensureDocsDir();
  const doc: YuemailDocument = {
    id: newId(),
    title: input.title ?? '',
    blocks: input.blocks ?? [],
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await fs.writeFile(path.join(docsRoot(), doc.id + '.json'), JSON.stringify(doc, null, 2), { mode: 0o600 });
  return doc;
}

export async function updateDocument(id: string, patch: Partial<Pick<YuemailDocument, 'title' | 'blocks'>>): Promise<YuemailDocument | undefined> {
  const existing = await getDocument(id);
  if (!existing) return undefined;
  const next: YuemailDocument = {
    ...existing,
    title:  patch.title  ?? existing.title,
    blocks: patch.blocks ?? existing.blocks,
    updated_at: nowIso(),
  };
  await fs.writeFile(path.join(docsRoot(), id + '.json'), JSON.stringify(next, null, 2), { mode: 0o600 });
  return next;
}

export async function deleteDocument(id: string): Promise<boolean> {
  const p = path.join(docsRoot(), id + '.json');
  if (!existsSync(p)) return false;
  await fs.unlink(p);
  return true;
}

export function docsDir(): string {
  return docsRoot();
}

/* Backwards-compatible alias for an inadvertent reference. */
