/**
 * ARIA live announce helper (F11).
 *
 * Two regions in the HTML:
 *   <div id="aria-polite"    role="status"     aria-live="polite"    aria-atomic="true"></div>
 *   <div id="aria-assertive" role="alert"      aria-live="assertive" aria-atomic="true"></div>
 *
 * `announce(text, kind)` writes to whichever matches. The polite
 * region is wiped + rewritten with a 30 ms delay so screen readers
 * re-announce identical strings (otherwise duplicate text is silently
 * dropped).
 *
 * The helper is DOM-aware but safe to import in non-DOM contexts:
 * announce() becomes a no-op when document is undefined.
 *
 * ASCII-only.
 */

export type AnnounceKind = 'polite' | 'assertive';

export const POLITE_REGION_ID    = 'aria-polite';
export const ASSERTIVE_REGION_ID = 'aria-assertive';
export const POLITE_REWRITE_DELAY_MS = 30;

interface RegionHost {
  getElementById(id: string): { textContent: string | null } | null;
}

function pickHost(): RegionHost | undefined {
  if (typeof document === 'undefined') return undefined;
  return document as unknown as RegionHost;
}

export function ensureRegions(): void {
  if (typeof document === 'undefined') return;
  const ensure = (id: string, mode: AnnounceKind) => {
    if (document.getElementById(id)) return;
    const el = document.createElement('div');
    el.id = id;
    el.setAttribute('role', mode === 'polite' ? 'status' : 'alert');
    el.setAttribute('aria-live', mode);
    el.setAttribute('aria-atomic', 'true');
    /* Visually hidden but available to screen readers. */
    el.style.position = 'absolute';
    el.style.width    = '1px';
    el.style.height   = '1px';
    el.style.overflow = 'hidden';
    el.style.clip     = 'rect(0 0 0 0)';
    el.style.whiteSpace = 'nowrap';
    document.body.appendChild(el);
  };
  ensure(POLITE_REGION_ID, 'polite');
  ensure(ASSERTIVE_REGION_ID, 'assertive');
}

export function announce(text: string, kind: AnnounceKind = 'polite'): void {
  const host = pickHost();
  if (!host) return;
  ensureRegions();
  const id = kind === 'assertive' ? ASSERTIVE_REGION_ID : POLITE_REGION_ID;
  const region = host.getElementById(id);
  if (!region) return;
  if (kind === 'polite') {
    /* Wipe + rewrite so duplicate strings re-announce. */
    region.textContent = '';
    setTimeout(() => {
      const r2 = host.getElementById(id);
      if (r2) r2.textContent = text;
    }, POLITE_REWRITE_DELAY_MS);
  } else {
    region.textContent = text;
  }
}
