# Yuemail -- Product Specification (Forge Director input)

## Identity

- **Product name**: Yuemail
- **Slug**: yuemail
- **Owner org**: yujinapp
- **Distribution**: public npm package `@yujinapp/yuemail` + binary `yuemail`
- **License**: MIT
- **Status**: shipped. **Current version: 0.11.0** (single source of
  truth: `package.json`). This SPEC is the living contract; the
  per-version adendas below record how scope grew past the original
  greenfield RFP.
- **v0.5.0 adenda**: la decision "sin IA" fue revertida por el owner
  (2026-06-22). Yuemail incorpora un Asistente de voz (Brain) como
  camino 1 por defecto; ver docs/ADENDA_v0.5.0_BRAIN.md (PND-010).
- **v0.6.0 adenda**: voz de Google (STT/TTS) como camino 1 por defecto;
  ver docs/ADENDA_v0.6.0_VOICE.md (PND-011).
- **Scope correction (2026-06-28 doc audit)**: F7 reply/forward/body
  fetch and the contacts subsystem are SHIPPED (see F7, F15 below); the
  "deferred to v0.2+" list no longer claims them.

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
| `enviar a <nombre>`                   | Resolve a contact by name    |
| `agregar contacto [nombre]`           | Start guided add-contact flow|
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

**Adenda 2026-06-24 (PND-028) -- guided add-contact flow:** a person
on voice must never hit a dead end when a recipient is not in the
address book. Saying `agregar contacto` starts a guided wizard that
asks FIRST for the name, THEN for the email ("provider"), and reads the
address back ("ana arroba gmail punto com") for confirmation before
saving -- the spoken read-back guards the costliest error (a wrong
address). The name may be said in one go (`agregar contacto Juan`,
`agendar a Maria`) to skip to the email step. Additionally, when
`enviar a <nombre>` finds no contact, the same wizard starts with the
name pre-filled and, once saved, opens the send dialog to the brand-new
address. While the wizard captures, speech is routed offline (like
dictation) so the Brain never re-reads a name/email as a command; only
the mic-safety trio and the wizard's own `cancelar` interrupt it. Pure
state machine in src/voice/contactWizard.ts, regression-guarded by
tests/contact-wizard.test.ts.

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

### F7 -- Email inbox (list + body fetch + reply + forward)

- `imapflow` lists last N envelopes (UID, from, subject, date).
- Refresh on demand (button + voice `leer bandeja`).
- **Body fetch (SHIPPED, PND-024):** `GET /api/inbox/fetch/:uid`
  returns the full message (from, cc, bcc, subject, body_text, date).
- **Reply (SHIPPED, RESPONDER):** `responder` replies to the last read
  message; `responder a <nombre>` resolves a contact by name.
- **Forward (SHIPPED, REENVIAR):** `reenviar` fetches the last read
  message body and opens the send dialog to new recipients.

*Scope note: the original RFP said "No body fetch, no reply, no forward
in v0.x." That line is superseded -- all three are implemented in
App.tsx + server/routes/inbox.ts and covered by tests.*

### F8 -- BYOK encrypted vault (single-user)

- AES-256-GCM, scrypt-derived key from (passphrase,
  per-machine salt).
- Salt random-once at first launch, persisted to
  `~/.yuemail/vault.salt`.
- Default passphrase: `'yuemail/' + os.hostname() + '/' + username`.
- Overridable via env `YUEMAIL_VAULT_PASS`.
- Keys stored: **22 slots** total (the allowlist is `VAULT_KEYS` in
  `server/vault.ts`):
  - **Mail + identity (12):** `imap.host`, `imap.port`, `imap.user`,
    `imap.pass`, `imap.secure`, `smtp.host`, `smtp.port`, `smtp.user`,
    `smtp.pass`, `smtp.secure`, `identity.from`, `identity.name`.
  - **Brain providers (9, v0.5.0):** `brain.google_ai`,
    `brain.anthropic`, `brain.openai`, `brain.deepseek`, `brain.xai`,
    `brain.mistral`, `brain.qwen`, `brain.zai`, `brain.ollama`.
  - **Google voice (1, v0.6.0):** `speech.google`.
- Vault values never returned by API -- only key names + per-
  category configured-booleans.
- **Derived-passphrase caveat:** the default passphrase
  (`hostname + username`) is predictable; real at-rest secrecy against a
  local reader requires `YUEMAIL_VAULT_PASS`. The UI surfaces the source
  (`env` vs `derived`).

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

## Out of scope (still deferred)

*(Updated 2026-06-28: email reply / forward / body fetch were SHIPPED
and moved INTO scope -- see F7. The contacts subsystem also shipped --
see F15. They are no longer deferred.)*

- Multi-account.
- OAuth (Gmail wants app passwords for now).
- Mobile.
- Multi-document tabs.
- Inline-edit of saved signature image blocks (only delete +
  re-sign supported).
- Auto-update notification.

## F14 -- Account settings with autoconfig (adenda 2026-06-11, PND-006)

*Registered retroactively: shipped 2026-06-10, mislabelled "F10" in
early commits (a number this RFP already assigns to the design
system). Canonical number: F14. Decision record: docs/DESIGN.md D9/D10.*

- A settings gear in the topbar opens the account dialog.
- The user types (or dictates) only their email address; the server
  resolves IMAP/SMTP in three tiers: built-in provider table,
  Mozilla ISPDB, convention guess (flagged as a guess).
- Live connection test (`/api/email/verify`) before saving.
- Saving writes through the existing vault route (F8); the
  no-values-out rule holds.
- The dialog is a voice context: `detectar` / `probar` / `guardar` /
  `cancelar`, plus per-field dictation (`campo <nombre>`, value
  utterance, `borrar campo`, `fin campo`).
- Adds the 10th global phrase: `abrir configuracion` / `ajustes`.

## Adenda 2026-06-11 bis (PND-003, approved by owner) -- dialog field dictation everywhere

Every modal input is now dictatable, not just settings:

- **Send dialog**: `campo destinatario` (multi-address: `arroba` /
  `punto` / `coma` / "y"), `campo asunto` (replace), `campo cuerpo`
  (APPEND: each utterance lands as a new paragraph), `campo adjuntar`
  ("si" / "no").
- **Signature pad**: `campo nombre` (typed name for cursive baking).
- `fin campo` releases the armed field and restores the dialog verbs.
- **Dictation precedence (safety)**: while a field is armed in the
  send dialog or the signature pad, free speech IS the field value --
  a lone `enviar` inside a dictated sentence must NOT send the email.
  Mic safety phrases always pass. Settings keeps verb-first semantics
  (short structured values; the documented flow ends in `guardar`).
- Regression-guarded: the dictation symmetry suite covers the inputs
  of all three modals in both directions, and mutation-checked tests
  pin the no-accidental-send guard.

## F15 -- Contacts / address book (shipped; PND-022 / PND-024 / PND-028)

A local address book so a voice user can send and reply by NAME, never
hitting a dead end when spelling an address out is hard.

- `server/contacts.ts`: JSON store under `~/.yuemail/`; surface includes
  `listContacts`, `addContact`, `upsertSender`, `upsertCC`,
  `upsertRecipientsFromSend`, `updateContact`, `deleteContact`.
- **Voice:** `abrir contactos` / `agenda` opens the book;
  `enviar a <nombre>` and `responder a <nombre>` resolve by name;
  `agregar contacto [nombre]` runs the guided add flow (name first, then
  email, spoken read-back before saving -- see F2 adenda 2026-06-24).
- **Auto-registration:** `leer bandeja` upserts senders + CC recipients
  into the book (best-effort; never breaks the inbox read).
- Regression-guarded by tests/contacts*.test.ts, contact-match,
  contact-wizard, contacts-import.

## Acceptance criteria

*(version + counts normalized by the 2026-06-11 adenda PND-006; test
counts refreshed by the 2026-06-28 doc audit against the live suite.)*

The shipped build (current **v0.11.0**) must:

1. Install from npm via `npm i -g @yujinapp/yuemail`.
2. Launch with `yuemail`, bind 127.0.0.1:5180, open the browser.
3. Allow `yuemail vault setup` to configure the 12 mail fields without
   error.
4. Reject `/api/email/send` with a meaningful error when SMTP
   creds are missing.
5. Recognise all the global voice phrases (incl. `abrir configuracion`,
   F14; reply/forward, F7; contacts, F15) and the contextual vocabulary
   of the three modals, including field dictation.
6. Render the 4 named buttons in F1 in the toolbar.
7. Produce a `.docx` whose first two bytes are `PK` (ZIP magic)
   when downloaded.
8. Encrypt the vault on disk -- the raw JSON file must not
   contain any plaintext value of any stored secret.
9. Pass the vitest suite: **407 tests passing** (3 live-API benchmarks
   gated off by default; 410 total) across 24 active suites, verified
   green via `npm test` on 2026-06-28.
10. Pass `prepublishOnly` gate (typecheck + tests + build).
