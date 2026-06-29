# Yuemail -- Architecture (Phase III, step 11)

Status: generated 2026-06-10 from the as-built codebase; refreshed
2026-06-11 (PND-004: version labels, verified test counts, settings
feature relabelled D9 to undo the F10 collision). Approved by owner
2026-06-11 (gate 13). Refreshed at v0.4.0: settings feature is now
F14 (RFP adenda PND-006); dialog field dictation generalised (D11).
Refreshed at v0.5.0: Asistente de voz (Brain) anadido como camino 1
(server/brain/*, BrainSettings.tsx); ver docs/ADENDA_v0.5.0_BRAIN.md
(PND-010). RFP: docs/SPEC.md. Refreshed at v0.6.0: voz de Google STT/TTS
(server/voice/*, VoiceSettings.tsx); ver docs/ADENDA_v0.6.0_VOICE.md
(PND-011). **Refreshed 2026-06-28 (doc audit): current version 0.11.0;
inbox now does body fetch + reply + forward; contacts subsystem added;
test counts re-verified against the live suite.**

## System overview

```
 user (voice + keyboard + pointer)
   |
   v
 Browser SPA (React 18, Vite build)            dist/
   - App shell: topbar (mic + settings gear),
     toolbar, editor, inbox card, modals
     (SendDialog, SignaturePad,
     SettingsDialog), toasts
   - Voice: Web Speech API (es-AR), parser
     with global + per-modal contexts
   - a11y: ARIA live regions + NAC3 attrs
   |  fetch /api/*  (same origin)
   v
 Express 4 server (server-dist/)               binds 127.0.0.1:5180 ONLY
   - /api/documents/*   CRUD + .docx render (docx lib, on demand)
   - /api/signature     PNG store
   - /api/email/send    nodemailer SMTP (per-send transport)
   - /api/email/autoconfig  IMAP/SMTP discovery from the address
                        (known table / Mozilla ISPDB / convention)
   - /api/email/verify  live IMAP+SMTP connection test
   - /api/inbox/list    imapflow envelope list + auto-register contacts
   - /api/inbox/fetch/:uid  full message (body, cc, bcc) for reply/forward
   - /api/brain         9-provider AI router config (camino 1)
   - /api/voice         Google STT/TTS router config + stt/tts (camino 1)
   - /api/contacts      address book CRUD (name-based send/reply)
   - /api/kikoe         voice-trainer fingerprint store (add-on)
   - /api/vault         key names + configured booleans (never values)
   |
   v
 Filesystem ~/.yuemail/                        no DB, no telemetry
   - documents/<id>.json   (source of truth; .docx always rebuilt)
   - signatures/default.png
   - vault.salt + encrypted vault (AES-256-GCM, scrypt key)

 CLI bin/yuemail.mjs: launches server, opens browser (open pkg),
 vault list/set/delete/setup wizard.
```

## Layering rules

- Frontend never touches the filesystem or credentials; everything
  goes through `src/lib/api.ts` -> `/api/*`.
- Server modules are route-scoped (`server/routes/*`); shared logic
  (vault, docx-builder, documents, signature stores) lives at
  `server/` top level.
- Secrets only ever flow INTO the vault. No API returns a stored
  value; the UI sees key names + booleans.

## Voice subsystem

- `src/voice/useVoice.ts`: one SpeechRecognition instance for the app
  lifetime (callbacks held in a ref; re-renders do not recreate or
  stop it). On-demand mic, never always-on.
- `src/voice/commands.ts`: pure parser, accent-insensitive +
  filler-tolerant. Two vocabularies: global (10 phrases: acceptance
  #5 base 9 + "abrir configuracion", settings adenda D9) and
  contextual per open modal (send_dialog, signature_pad,
  settings_dialog). With a modal open, global commands are suppressed
  except mic safety. Contextual commands are dispatched by clicking
  the target button via its `data-nac-action`, so voice and pointer
  share one handler (NAC3 symmetry).

## Email autoconfiguration (adenda 2026-06-10, design D9)

- `server/autoconfig.ts`: pure resolution logic, three tiers --
  (1) built-in table of major providers (Gmail, Outlook, Yahoo,
  iCloud, AOL, GMX, Zoho, Fastmail, Yandex) with the per-provider
  app-password caveat; (2) Mozilla ISPDB
  (autoconfig.thunderbird.net) with a 6s timeout, fetch injectable
  for tests; (3) convention guess imap./smtp. + domain, flagged so
  the UI pushes the user to the connection test. Providers without
  public IMAP/SMTP (Proton sans Bridge, Tuta) fail with a human
  explanation instead of a dead guess.
- `server/routes/settings.ts`: `/api/email/autoconfig` (GET) +
  `/api/email/verify` (POST). Verify merges form overrides with
  vault values field-by-field, so the UI can test before saving or
  test the stored credentials; results are per-protocol
  ({imap, smtp} ok/error). Credentials in the verify body flow
  loopback-only and are never persisted nor echoed.
- `src/components/SettingsDialog.tsx`: the gear dialog. Address
  blur triggers autodetection; advanced fieldset exposes the
  resolved servers for manual override; save writes each value to
  the vault over the existing `/api/vault/key` route (empty
  password keeps the stored one).

## Async + error topology

- All API calls wrapped in try/catch at the App handler level; every
  failure surfaces as toast + ARIA announce (assertive for errors).
- SMTP/IMAP transports are built per operation from vault values and
  torn down after; no long-lived connections.

## Observability

- Local-only product: no telemetry, no remote logging (F13). Server
  logs to stdout. Failures are user-visible by design (toast+ARIA).
  Full posture: docs/observability.md.

## Security posture

- Loopback binding only; never LAN (F12).
- Vault: AES-256-GCM, scrypt-derived key, random per-machine salt,
  env-overridable passphrase (F8). 22 key slots (12 mail + 9 brain + 1
  speech). Encrypted-at-rest verified by tests/vault.test.ts. NOTE: the
  default passphrase (hostname + username) is predictable; real at-rest
  secrecy against a local reader requires YUEMAIL_VAULT_PASS.
- Outbound posture: local-FIRST, not zero-outbound when camino-1 features
  are on. With the Brain enabled, request TEXT goes to the chosen AI
  provider; with Google voice enabled, dictated AUDIO + spoken TEXT go to
  Google. API keys stay server-side and never leave the machine. Fully
  local = Brain off (or ollama) + Google voice off (browser Web Speech).

## Build + quality gates

- TypeScript strict + noUncheckedIndexedAccess; tsc for server,
  Vite for SPA.
- Vitest: 24 active suites / **407 tests passing** (3 live-API
  benchmark suites gated off by default -> 410 total), verified green
  2026-06-28 via `npm test` (voice parser + contextual routing + dialog
  field dictation incl. precedence, vault round-trip + at-rest
  encryption, docx magic bytes, NAC3 + voice symmetry, autoconfig tiers,
  ARIA, toolbar labels, server port, email reject, CLI help, design
  tokens, the 9-provider Brain router + safety net, the Google voice
  router + client transport, contacts match/wizard/import).
- prepublishOnly: typecheck + tests + build (acceptance #10).
