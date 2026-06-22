# Yuemail -- Solution Design decisions (Phase III, step 12)

Status: generated 2026-06-10 from the as-built codebase; refreshed
2026-06-11 (PND-004: version labels, pending references). Approved by
owner 2026-06-11 (gate 13). Iterated same day under the approved-spec
flow: D11 added with PND-003 (owner-approved), version label v0.4.0.
Iterated at v0.5.0 (PND-010, owner-approved 2026-06-22): decisiones
D-BRAIN-1..7 del Asistente de voz; ver docs/ADENDA_v0.5.0_BRAIN.md.
RFP: docs/SPEC.md. Architecture: docs/ARCHITECTURE.md.

## D1 -- JSON-on-filesystem, no database

Single-user local product (F13). A DB adds setup friction for the
exact user we serve (motor/visual impairment). Documents are JSON
under `~/.yuemail/documents/`; the .docx is ALWAYS rebuilt from JSON
(never persisted) so there is exactly one source of truth (F5).

## D2 -- Vault crypto

AES-256-GCM with scrypt-derived key. Salt generated once per machine.
Default passphrase derives from hostname+username so the zero-config
path still encrypts at rest; `YUEMAIL_VAULT_PASS` overrides for users
who want a real secret. API surface never returns values -- only key
names and configured-booleans -- so a UI bug cannot leak a credential.

Threat-model limit (explicit on purpose): the default passphrase is
predictable. It protects the vault files if they leak ALONE (backup,
synced folder), but a local attacker who can read the files can also
read hostname+username and re-derive the key. At-rest secrecy against
local readers requires `YUEMAIL_VAULT_PASS`. The server reports
`key_source: env | derived` in `/api/vault/status` and the settings
dialog shows the caveat whenever the derived fallback is active.

## D3 -- Per-send SMTP transport, read-only IMAP

Transports are built from vault values per operation and discarded.
No connection pooling: traffic is human-scale (single user) and
short-lived connections avoid stale-auth states. Inbox is envelopes
only (no body fetch) in v0.x -- reading bodies expands attack surface
and scope without serving the north-star journey.

## D4 -- On-demand mic, es-AR, graceful degradation

Web Speech API only exists in Chrome/Edge/Safari; everywhere else the
app remains fully operable by buttons (F1 guarantees the four named
buttons are always visible). Mic is toggled, never always-on.

## D5 -- One dispatch table for click + voice (NAC3 symmetry)

Every actionable element carries `data-nac-id` / `data-nac-role` /
`data-nac-action` (F9). Voice commands resolve the SAME handler as
the button. For contextual (modal) commands this is literal: the
command clicks the button via its `data-nac-action`. The symmetry is
test-enforced: a modal button without a voice route fails
tests/nac3-attrs.test.ts.

## D6 -- Modal voice contexts (adenda 2026-06-10)

A modal owns the voice channel while open. Rationale: with global
vocabulary live behind a dialog, "firmar" inserted the saved
signature into the background document -- invisible to a blind user.
Suppress globals (except mic safety), expose a small unambiguous
per-modal vocabulary (confirmar/cancelar/guardar/borrar/generar),
and suppress dictation into the background document. The speech
recognizer survives re-renders (callbacks in a ref) so opening a
modal does not kill the mic session.

## D7 -- Single token file for visual identity

`src/styles/tokens.css` holds the whole Yujin DS surface (sumi-e ink
palette, 8px grid, accents). No hardcoded hex/px/rem outside it
(F10), enforced by tests/design-tokens.test.ts.

## D8 -- Loopback-only server

`127.0.0.1:5180`, never LAN. The product is personal; exposing it
would turn a credential vault into a network service. Test-enforced
by tests/server-port.test.ts.

## D9 -- Account setup from just the address (adenda 2026-06-10)

A settings gear in the topbar opens the account dialog. The user
types only their email address; the server resolves IMAP/SMTP in
three tiers: built-in table of major providers (instant, offline,
includes each provider's app-password caveat), Mozilla ISPDB for
the long tail of ISPs, and a convention guess (imap./smtp. +
domain) explicitly flagged as a guess. Rationale: the target user
should never have to know what a "port" is. A live connection test
(`/api/email/verify`) closes the loop before saving; saving reuses
the existing vault write route so the no-values-out rule (D2)
holds. Providers with no public IMAP/SMTP (Proton without Bridge,
Tuta) fail with an explanation instead of a guess that can never
connect. The dialog is a voice context like the other two modals
(detectar / probar / guardar / cancelar), symmetry test-enforced.

Note on numbering: early commits and the 2026-06-10 docs labelled
this feature "F10", a number the RFP already assigns to the design
system. RESOLVED 2026-06-11: the RFP adenda (PND-006, owner-approved)
registers it as F14.

## D10 -- Settings field dictation (adenda 2026-06-10 bis)

Voice could navigate the settings modal but not fill it: every value
still needed the keyboard, which contradicts the product's reason to
exist (external review, finding 6). New flow: "campo <nombre>" arms
a field (focus + announce), the next utterance becomes the field
value, "borrar campo [nombre]" empties it for re-dictation, and the
SSL checkboxes take "si" / "no". Spoken forms are translated per
field kind (arroba/punto/guion to symbols, digit words for ports,
space-joined groups for app passwords, names kept verbatim).

Two deliberate constraints:
- Arming is voice-only. Keyboard focus never arms a field, so the
  mic cannot scribble into a field the user is typing in by hand.
  Dictation REPLACES the field content (correcting = re-dictating);
  there is no partial-append mode for short structured values.
- Passwords are never echoed back. The toast/aria announcement
  reports only the captured length, consistent with the D2
  no-values-out rule.

The field table (SETTINGS_FIELD_SPECS in src/voice/commands.ts) is
the single producer/consumer contract, test-enforced in BOTH
directions by tests/nac3-attrs.test.ts: an input without a spec, a
spec without its input, an alias that does not parse, or missing
App routing all fail the suite.

Known limit (was PND-003): the SendDialog fields and the SignaturePad
typed-name field were keyboard-only at first. RESOLVED 2026-06-11 by
D11 below.

## D11 -- Dialog field dictation everywhere + dictation precedence (PND-003, 2026-06-11)

The D10 mechanism generalised to every modal: one spec table per
context (`FIELD_SPECS_BY_CONTEXT` in src/voice/commands.ts), same
"campo <nombre>" arming flow. Three interaction decisions on top:

- **Body APPENDS, never replaces.** Long dictation arrives utterance
  by utterance; each one lands as a new paragraph (blank-line
  separated) and the field stays armed. Replace semantics (D10's
  default for short structured values) would destroy everything said
  so far. The toast echoes only the appended fragment.
- **Dictation precedence while armed (send dialog + signature pad).**
  With a field armed, free speech IS the field value: contextual verbs
  are suppressed so a lone "enviar" inside a dictated sentence cannot
  send the email, and "Guadalupe Borrero" cannot clear the signature
  canvas. The user releases the field with "fin campo" (new command,
  available in all three modals) to get the verbs back. Mic safety
  phrases always pass. Settings deliberately keeps D10's verb-first
  semantics: its values are short + structured and the documented flow
  ends in "guardar"; changing it would break the shipped UX for no
  safety gain.
- **Recipients are multi-address.** Kind `recipients` extracts every
  spoken address ("arroba" / "punto" / "coma" / "y" separators) and
  joins them in the comma-separated form the send route expects.

The symmetry suite now walks the inputs (+ textareas) of all three
modals against their spec tables in both directions, and the
no-accidental-send guard is mutation-checked (the suite was run
against a build with the precedence line disabled and went red on
exactly the three guarding tests).
