# Yuemail -- Product Specification (Forge Director input)

## Identity

- **Product name**: Yuemail
- **Slug**: yuemail
- **Owner org**: yujinapp
- **Distribution**: public npm package `@yujinapp/yuemail` + binary `yuemail`
- **License**: MIT
- **Status**: greenfield, no prior implementation in this directory

## Primary user

A person with motor impairment, visual impairment, or both, who
needs to dictate a written document, sign it, and send it by
email from their own personal machine, without relying on a
sighted helper or a sustained-precision mouse interaction.

## North-star user journey

> *"Pablo dicta un informe, dice 'firmar', dice 'enviar a ana
> arroba ejemplo punto com', y termina. El sistema desaparece."*

End-to-end target: under 4 minutes from launching the binary to
the recipient seeing the .docx in their inbox. Zero clicks
strictly required (every click has a voice equivalent), one
final visible "Enviar" confirmation as the only mandatory
hand-interaction (which is itself keyboard-tab-accessible).

## Required features

### F1 -- Four explicit named buttons in the toolbar

In addition to voice commands, four buttons must be **visible at
all times** in a toolbar, labelled exactly:

1. `Nuevo documento`
2. `Abrir documento`
3. `Guardar firma`
4. `Firmar`

Each button is keyboard-focusable and screen-reader announced.

### F2 -- Voice commands

The mic is on-demand (toggle button + voice "encender / apagar
microfono"). When on, the system recognises Spanish utterances
and dispatches the following commands (accent-insensitive,
filler-word-tolerant):

| Phrase                                | Action                       |
|---------------------------------------|------------------------------|
| `nuevo documento` / `documento nuevo` | Clear editor, start fresh    |
| `abrir documento [nombre]`            | Load most recent / by name   |
| `guardar firma`                       | Open signature pad           |
| `firmar`                              | Insert saved signature       |
| `iniciar dictado`                     | Begin transcription          |
| `fin dictado`                         | Stop transcription           |
| `enviar a <email>`                    | Open send dialog + prefill   |
| `leer bandeja`                        | List recent inbox envelopes  |
| `detener voz`                         | Mute microphone              |

Spoken "@" recognised as `arroba`. Spoken "." recognised as
`punto`. Extracted email lowercased.

**Adenda 2026-06-10 (approved by owner; implements the zero-click
north-star inside modals):** while a modal is open it owns the voice
channel. Global phrases are suspended (except mic safety: `encender /
apagar microfono`, `detener voz`) and contextual phrases activate:
send dialog -> `confirmar` / `enviar` (send), `cancelar` / `cerrar`
(close); signature pad -> `guardar` (save), `borrar` (clear),
`generar` (bake typed name), `cancelar` / `cerrar` (close). Dictation
is suppressed while a modal is open. Regression-guarded by the
voice/NAC3 symmetry suite in tests/nac3-attrs.test.ts.

### F3 -- Document editor

- Title field (text input, voice editable).
- Ordered list of blocks; each is either a paragraph (free text)
  or a signature image (PNG, displayed inline).
- Dictation appends to the bottom; user can manually edit any
  block.
- Documents persist as JSON under `~/.yuemail/documents/<id>.json`.

### F4 -- Signature management (save AND apply, separate verbs)

- **Guardar firma**: opens a modal with a canvas. User draws
  signature with mouse / finger / stylus, or types their name
  for cursive-rendered baking. Save persists PNG to
  `~/.yuemail/signatures/default.png`.
- **Firmar**: reads the saved PNG and inserts it as a
  `signature_image` block in the current document. If no
  signature is saved yet, auto-opens the pad with a clear voiced
  announce.

### F5 -- .docx generation

- The user's document (title + blocks) renders to a real
  `.docx` (Office Open XML) buffer using the `docx` npm
  library.
- Generated on demand, never persisted as a separate `.docx`
  file (always rebuilt from JSON source-of-truth).
- Used as the email attachment in F6.

### F6 -- Email send via SMTP

- `nodemailer` transport built per-send from vault SMTP credentials.
- Modal dialog with: recipients (comma-separated), subject
  (auto-prefilled from doc title), body (default polite stub),
  attach-doc checkbox (default checked).
- Toast on success / failure. Voiced confirmation + ARIA
  assertive announce on error.

### F7 -- Email inbox read-only

- `imapflow` lists last N envelopes (UID, from, subject, date).
- No body fetch, no reply, no forward in v0.x.
- Refresh on demand (button + voice `leer bandeja`).

### F8 -- BYOK encrypted vault (single-user)

- AES-256-GCM, scrypt-derived key from (passphrase,
  per-machine salt).
- Salt random-once at first launch, persisted to
  `~/.yuemail/vault.salt`.
- Default passphrase: `'yuemail/' + os.hostname() + '/' + username`.
- Overridable via env `YUEMAIL_VAULT_PASS`.
- Keys stored: `imap.host`, `imap.port`, `imap.user`, `imap.pass`,
  `imap.secure`, `smtp.host`, `smtp.port`, `smtp.user`,
  `smtp.pass`, `smtp.secure`, `identity.from`, `identity.name`.
- Vault values never returned by API -- only key names + per-
  category configured-booleans.

### F9 -- NAC3 compliance

- Every interactive element (button, input, textarea, canvas)
  ships `data-nac-id="yuemail.<area>.<element>"`,
  `data-nac-role`, `data-nac-action`.
- Slug namespace = `yuemail.`. Areas: `toolbar`, `topbar`,
  `doc`, `signature`, `email`, `voice`, `inbox`, `settings`.
- Action names are short imperative verbs (e.g. `new_document`,
  `sign_document`, `save_signature`).

### F10 -- Yujin Design System

- Single token file `src/styles/tokens.css` carries the entire
  visual identity (sumi-e ink palette, 8px grid, accent-sakura
  / accent-jade / accent-sky / accent-amber / accent-rose).
- Components reference tokens via CSS variables; **no
  hardcoded** hex / rem / px outside `tokens.css`.

### F11 -- Accessibility

- Two ARIA `aria-live` regions in `index.html` (polite +
  assertive).
- An `announce(text, kind)` helper writes to whichever region
  matches.
- Polite region wiped + rewritten with a 30 ms delay so screen
  readers re-announce identical strings.

### F12 -- CLI binary (npm-installable)

- `bin/yuemail.mjs` is the Node entry. Subcommands:
  - bare `yuemail` -> launch server + open browser
  - `yuemail start` -> server only (no browser)
  - `yuemail vault list` -> key names only
  - `yuemail vault set <name> <value>`
  - `yuemail vault delete <name>`
  - `yuemail vault setup` -> interactive 12-field wizard
  - `yuemail version`
  - `yuemail help`
- Server binds `127.0.0.1` only (loopback). Never LAN. Never
  external interface.

### F13 -- Single-user, local-only, no telemetry

- No login.
- No user table.
- No DB. JSON-on-filesystem under `~/.yuemail/`.
- No outbound network beyond user-configured IMAP/SMTP.

## Non-functional requirements

- **Node**: `>= 18.0.0`.
- **Browser**: Web Speech API requires Chrome / Edge / Safari.
  Other browsers degrade to button-only mode.
- **Server**: Express 4 (well-understood, mature error handling).
- **Build**: TypeScript strict + `noUncheckedIndexedAccess`.
  Vite for the frontend; `tsc -p tsconfig.server.json` for the
  backend.
- **Tests**: Vitest with at least 3 suites covering: voice
  command parser, vault round-trip + encryption-at-rest,
  `.docx` builder magic-bytes check.
- **Package size**: tarball under 100 KB; gzipped JS under 60 KB.
- **prepublishOnly gate**: typecheck + tests + build must all
  pass before `npm publish` is allowed to proceed.

## Deliverables

- `package.json` with scoped name `@yujinapp/yuemail`, `bin`
  field pointing to `bin/yuemail.mjs`, files-whitelist
  publishing only `bin/`, `dist/`, `server-dist/`, `README.md`,
  `LICENSE`.
- `bin/yuemail.mjs` (CLI entry).
- `server/` (TS sources for Express backend).
- `src/` (TS + TSX sources for Vite frontend).
- `tests/` (Vitest suites).
- `docs/SUCCESS_CASE.md` -- product manifest.
- `docs/HOW_WE_GOT_HERE.md` -- problems faced log.
- `docs/ARCHITECTURE.md` -- system overview.
- `docs/DESIGN.md` -- decisions with rationale.
- `docs/PLAN.md` -- analyst output (filled by sprint).
- `docs/ITERATIONS.md` -- bridge log of the sprint.
- `docs/HANDOFF.md` -- what's done + what's deferred.
- `.gitignore` excluding `node_modules`, `dist`, `server-dist`,
  `.yuemail`, `vault*`, `signatures/`, `.env*`.
- `LICENSE` (MIT).
- `README.md` (install + voice command catalogue + privacy).

## Out of scope (deferred to v0.2+)

- Email reply / forward / body fetch.
- Multi-account.
- OAuth (Gmail wants app passwords for now).
- Mobile.
- Multi-document tabs.
- Inline-edit of saved signature image blocks (only delete +
  re-sign supported).
- Auto-update notification.

## Acceptance criteria

A successful build of v0.2.0 must:

1. Install from npm via `npm i -g @yujinapp/yuemail`.
2. Launch with `yuemail`, bind 127.0.0.1:5180, open the browser.
3. Allow `yuemail vault setup` to configure 12 fields without error.
4. Reject `/api/email/send` with a meaningful error when SMTP
   creds are missing.
5. Recognise all 9 voice phrases listed in F2.
6. Render the 4 named buttons in F1 in the toolbar.
7. Produce a `.docx` whose first two bytes are `PK` (ZIP magic)
   when downloaded.
8. Encrypt the vault on disk -- the raw JSON file must not
   contain any plaintext value of any stored secret.
9. Pass at least 25 vitest tests.
10. Pass `prepublishOnly` gate (typecheck + tests + build).
