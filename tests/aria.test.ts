/**
 * ARIA live region helper (F11).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* Minimal DOM stub for the helper. The cast through `unknown` is the
 * recommended TS escape hatch for stubbing globals with a partial
 * shape; the helper only touches getElementById + createElement +
 * body.appendChild. */
function setupDom() {
  const elements = new Map<string, { textContent: string | null }>();
  globalThis.document = {
    getElementById: (id: string) => elements.get(id) ?? null,
    createElement: (_tag: string) => ({
      id: '',
      textContent: '' as string | null,
      style: {} as Record<string, string>,
      setAttribute: vi.fn(),
    }),
    body: { appendChild: vi.fn() },
  } as unknown as Document;
  return {
    register: (id: string) => {
      const node = { textContent: null as string | null };
      elements.set(id, node);
      return node;
    },
  };
}

describe('announce()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('writes to the polite region after a 30ms delay', async () => {
    const { register } = setupDom();
    const polite = register('aria-polite');
    const { announce } = await import('../src/lib/ariaLive.js');
    announce('Documento guardado.');
    expect(polite.textContent).toBe('');  /* wipe step */
    await vi.advanceTimersByTimeAsync(40);
    expect(polite.textContent).toBe('Documento guardado.');
  });

  it('writes immediately to the assertive region', async () => {
    const { register } = setupDom();
    const assertive = register('aria-assertive');
    const { announce } = await import('../src/lib/ariaLive.js');
    announce('Error al enviar.', 'assertive');
    expect(assertive.textContent).toBe('Error al enviar.');
  });

  it('no-op when document is undefined', async () => {
    (globalThis as { document?: Document }).document = undefined;
    const { announce } = await import('../src/lib/ariaLive.js');
    expect(() => announce('cualquier cosa')).not.toThrow();
  });
});
