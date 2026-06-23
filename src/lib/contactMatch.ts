/**
 * Contact name matching (v0.6.4 / PND-022).
 *
 * A person who cannot reliably spell an address says a NAME ("enviar a
 * Maximiliano"); this resolves that spoken name to a contact in the
 * address book. Deterministic, accent-insensitive, tolerant of partial
 * names (first name only, an alias, or the email's local part).
 *
 * The result separates a confident single match from an ambiguous set
 * (several plausible contacts) so the App can confirm by voice instead of
 * silently picking the wrong person -- sending to the wrong contact is the
 * costliest failure for these users.
 *
 * ASCII-only.
 */

export interface Contact {
  id: string;
  name: string;
  email: string;
  aliases: string[];
  source?: 'manual' | 'inbox';
  created_at?: number;
  updated_at?: number;
}

export interface MatchResult {
  /** The top contact, when it clears the confidence threshold. */
  best?: Contact;
  /** Every contact within striking distance of the top score (>= 1 entry
   *  when best is set). More than one => ambiguous. */
  candidates: Contact[];
  ambiguous: boolean;
}

const THRESHOLD = 0.5;
const CLOSE_BAND = 0.12;

/* Drop every non-ASCII byte. After NFD decomposition the accents become
 * separate combining marks (all above code 127), so dropping them strips
 * the accent and keeps the base ASCII letter ("Jose" from "Jose" with an
 * accent). Done by char code to keep this source file ASCII-pure (SQ 3). */
function stripNonAscii(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) <= 127) out += s.charAt(i);
  }
  return out;
}

function norm(s: string): string {
  return stripNonAscii(s.normalize('NFD'))
    .toLowerCase()
    .replace(/[.,!?;:_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pairScore(q: string, t: string): number {
  if (q.length === 0 || t.length === 0) return 0;
  if (q === t) return 1;
  const qt = q.split(' ').filter(Boolean);
  const tt = t.split(' ').filter(Boolean);
  /* Every spoken token appears in the target (e.g. "maxi linares" -> a
   * contact "Maximiliano Linares" once aliases cover "maxi"). */
  if (qt.length > 0 && qt.every((x) => tt.includes(x))) return 0.85;
  /* First name match ("Ana" -> "Ana Gomez"). */
  if (tt[0] && qt[0] && tt[0] === qt[0]) return 0.7;
  /* Substring either way ("maximiliano" within the name, etc.). */
  if (t.includes(q) || q.includes(t)) return 0.6;
  /* Loose token overlap, scaled down. */
  const overlap = qt.filter((x) => tt.includes(x)).length;
  const denom = Math.max(qt.length, tt.length);
  return denom > 0 ? (overlap / denom) * 0.5 : 0;
}

function scoreContact(query: string, c: Contact): number {
  const q = norm(query);
  if (q.length === 0) return 0;
  /* The NAME (and aliases) are the primary signal at full weight. The
   * email's local part is only a weak fallback (a coincidental "ana@..."
   * must NOT outrank the name match, or "ana" would silently pick one of
   * two Anas instead of asking which -- the costly failure we guard). */
  let best = 0;
  for (const t of [c.name, ...(c.aliases ?? [])].map(norm).filter((x) => x.length > 0)) {
    best = Math.max(best, pairScore(q, t));
  }
  const local = norm(c.email.split('@')[0] ?? '');
  if (local.length > 0) best = Math.max(best, pairScore(q, local) * 0.75);
  return best;
}

export function matchContacts(query: string, contacts: ReadonlyArray<Contact>): MatchResult {
  const scored = contacts
    .map((c) => ({ c, s: scoreContact(query, c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || (a.c.name || a.c.email).localeCompare(b.c.name || b.c.email));

  const top = scored[0];
  if (!top || top.s < THRESHOLD) return { candidates: [], ambiguous: false };

  const close = scored.filter((x) => top.s - x.s <= CLOSE_BAND && x.s >= THRESHOLD).map((x) => x.c);
  return { best: top.c, candidates: close, ambiguous: close.length > 1 };
}
