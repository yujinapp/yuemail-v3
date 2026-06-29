# Yuemail -- Handoff package

Status: rewritten 2026-06-11 (PND-004); replaces the TBD stub
generated 2026-06-10. Refreshed same day (PND-003/006 shipped).
**Refreshed 2026-06-28 (doc audit) to the current shipped state.**
Tier: medium. **Current version: 0.11.0** (single source of truth:
`package.json`). The v0.4.0 lines below are kept where they describe the
original RFP baseline; current-state figures are marked "2026-06-28".

## What this app is

Voice-first, single-user, local-only email client for people with
motor and/or visual impairment: dictate a document in Spanish, sign
it, send it as a .docx attachment. Public npm package
@yujinapp/yuemail (bin: yuemail), MIT.

## Architecture decisions (full rationale in docs/DESIGN.md)

- Persistence: JSON on filesystem under ~/.yuemail; no DB (D1). The
  .docx is always rebuilt from JSON, never persisted (F5).
- Secrets: AES-256-GCM vault, scrypt key, per-machine salt; API never
  returns values; derived-passphrase caveat surfaced in UI (D2).
- Email: per-send SMTP transport; IMAP envelope list (D3) plus, since
  PND-024, single-message body fetch for reply/forward (see F7).
- Voice: on-demand mic, es-AR, per-modal contexts own the channel
  (D4, D6); one dispatch table for click + voice, test-enforced (D5).
- Account setup from just the address: 3-tier autoconfig + live
  verify (D9 / F14); every modal field fillable by voice, body with
  append semantics + no-accidental-send precedence (D10, D11).
- Server: Express 4, binds 127.0.0.1:5180 only, never LAN (D8).
- Compliance: n/a -- single-user local, no telemetry (F13).
- Observability: stdout + user-visible failures by design; see
  docs/observability.md.

## Credentials (22 vault keys; never returned by any API)

Mail + identity (12):
imap.host / imap.port / imap.user / imap.pass / imap.secure
smtp.host / smtp.port / smtp.user / smtp.pass / smtp.secure
identity.from / identity.name

Brain providers (9, v0.5.0): brain.google_ai / brain.anthropic /
brain.openai / brain.deepseek / brain.xai / brain.mistral / brain.qwen /
brain.zai / brain.ollama

Google voice (1, v0.6.0): speech.google

Setup paths: in-app gear (autoconfig from the address) or
`yuemail vault setup` (CLI wizard) for the 12 mail fields; the Brain and
voice keys are set from their topbar panels or `yuemail vault set`.

Caveat: the default vault passphrase (hostname + username) is
predictable; set `YUEMAIL_VAULT_PASS` for real at-rest secrecy.

## Blocks + state (v0.4.0 baseline verified 2026-06-11)

F1-F14 implemented plus adendas D9/D10/D11. (At v0.4.0: 11 suites / 179
tests.) typecheck clean; prepublishOnly gate (typecheck + tests + build)
protects publishes. Detail per block: docs/PLAN.md.

## Current state (2026-06-28 doc audit, v0.11.0)

Since v0.4.0, the shipped scope grew substantially:

- **AI Brain (v0.5.0):** 9-provider router (Gemini default), fails closed
  to the fixed-phrase matcher. server/brain/*, BrainSettings.tsx.
- **Google voice STT/TTS (v0.6.0):** camino-1 hearing + speaking, Web
  Speech fallback. server/voice/*, VoiceSettings.tsx.
- **Inbox reply / forward / body fetch (F7):** RESPONDER, REENVIAR,
  GET /api/inbox/fetch/:uid. App.tsx + server/routes/inbox.ts.
- **Contacts subsystem (F15):** name-based send/reply, guided add flow,
  auto-registration from the inbox. server/contacts.ts.
- **Voice trainer:** shipped (VoiceTrainer.tsx, server/routes/kikoe.ts,
  add-on @yujinapp/nac3-kikoe).

Test suite (2026-06-28): **407 tests passing** across 24 active suites
(3 live-API benchmark suites gated off -> 410 total); typecheck clean.

## How to run

- Dev: `npm run dev:web` (Vite) + `npm run dev:server` (tsc watch).
- Prod-like: `npm run build` then `node bin/yuemail.mjs`.
- Tests: `npm test`. Typecheck: `npm run typecheck`.

## Open items (pending registry is canonical)

*Historical snapshot:* "None at v0.4.0 publish time" -- that was true at
the v0.4.0 cut. Resolved 2026-06-11: PND-003 (dictation in SendDialog +
SignaturePad, D11), PND-005 (Gate 13 -- owner approved ARCHITECTURE.md +
DESIGN.md), PND-006 (RFP adenda: F14 registered, version + counts
normalized) and PND-007 (feedback channel: contact@yujin.app).

*Current (2026-06-28):* the pending registry is canonical for live work.
Known doc-level follow-up from this audit: the per-version adendas
(v0.5.0/v0.6.0) still quote their as-shipped test counts (239/259) as
point-in-time snapshots; the live count is 407 (see "Current state").
Atypical-voice measurement with real users remains open (ADENDA v0.6.0
sec. 6) even though the voice trainer itself shipped.

## Deferred by scope (still open)

OAuth, multi-account, mobile, multi-document tabs, auto-update
notification. (Reply / forward / body fetch and contacts are NO LONGER
deferred -- they shipped; see "Current state".)
