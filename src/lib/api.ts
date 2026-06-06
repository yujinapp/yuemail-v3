/**
 * Thin fetch wrappers for the /api/* endpoints.
 *
 * Every helper returns the parsed JSON body and rethrows on non-2xx so
 * callers can wrap with try/catch + announce() for ARIA error feedback.
 *
 * ASCII-only.
 */

const BASE = '';

async function send<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, init);
  const text = await res.text();
  let body: unknown = text;
  try { body = JSON.parse(text); } catch { /* keep text */ }
  if (!res.ok) {
    const errMsg = (body as { error?: string })?.error ?? ('HTTP ' + res.status);
    throw new Error(errMsg);
  }
  return body as T;
}

export interface ApiOk {
  ok: true;
}
export interface ApiErr {
  ok: false;
  error: string;
}

export interface VaultStatus {
  ok: true;
  status: {
    imap:     { configured: boolean; missing: string[] };
    smtp:     { configured: boolean; missing: string[] };
    identity: { configured: boolean; missing: string[] };
  };
}

export const api = {
  health() {
    return send<{ ok: boolean; version: string }>('/api/health');
  },
  vaultKeys() {
    return send<{ ok: true; keys: string[] }>('/api/vault/keys');
  },
  vaultStatus() {
    return send<VaultStatus>('/api/vault/status');
  },
  vaultSet(name: string, value: string) {
    return send<void>('/api/vault/key', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, value }),
    });
  },
  vaultDelete(name: string) {
    return send<void>('/api/vault/key/' + encodeURIComponent(name), { method: 'DELETE' });
  },
  documentsList() {
    return send<{ ok: true; documents: Array<{ id: string; title: string; updated_at: string }> }>('/api/documents');
  },
  documentGet(id: string) {
    return send<{ ok: true; document: unknown }>('/api/documents/' + encodeURIComponent(id));
  },
  documentCreate(input: { title?: string; blocks?: unknown[] }) {
    return send<{ ok: true; document: { id: string } }>('/api/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  },
  documentUpdate(id: string, patch: { title?: string; blocks?: unknown[] }) {
    return send<{ ok: true; document: unknown }>('/api/documents/' + encodeURIComponent(id), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
  },
  signatureGet() {
    return send<{ ok: true; exists: boolean; png_b64?: string }>('/api/signature');
  },
  signatureSet(pngBase64: string) {
    return send<void>('/api/signature', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ png_b64: pngBase64 }),
    });
  },
  emailSend(payload: { to: string; subject: string; body_text: string; attach_document_id?: string }) {
    return send<{ ok: true; message_id: string; accepted: string[]; rejected: string[] }>('/api/email/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },
  inboxList(limit = 20) {
    return send<{ ok: true; envelopes: Array<{ uid: number; from: string; subject: string; date: string }> }>(
      '/api/inbox/list?limit=' + limit,
    );
  },
};
