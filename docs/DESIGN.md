# Yuemail -- Solution Design decisions (Phase III, step 12)

Status: generated 2026-06-10 from the as-built v0.2.0 codebase.
Pending owner approval (workflow gate 13). RFP: docs/SPEC.md.
Architecture: docs/ARCHITECTURE.md.

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
