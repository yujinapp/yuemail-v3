# Yuemail -- Handoff package

Status: rewritten 2026-06-11 (PND-004); replaces the TBD stub
generated 2026-06-10. Refreshed same day (PND-003/006 shipped).
Tier: medium. Version: v0.4.0.

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
- Email: per-send SMTP transport, read-only IMAP envelopes (D3).
- Voice: on-demand mic, es-AR, per-modal contexts own the channel
  (D4, D6); one dispatch table for click + voice, test-enforced (D5).
- Account setup from just the address: 3-tier autoconfig + live
  verify (D9 / F14); every modal field fillable by voice, body with
  append semantics + no-accidental-send precedence (D10, D11).
- Server: Express 4, binds 127.0.0.1:5180 only, never LAN (D8).
- Compliance: n/a -- single-user local, no telemetry (F13).
- Observability: stdout + user-visible failures by design; see
  docs/observability.md.

## Credentials (12 vault keys; never returned by any API)

imap.host / imap.port / imap.user / imap.pass / imap.secure
smtp.host / smtp.port / smtp.user / smtp.pass / smtp.secure
identity.from / identity.name

Setup paths: in-app gear (autoconfig from the address) or
`yuemail vault setup` (CLI wizard).

## Blocks + state (verified 2026-06-11)

F1-F14 implemented plus adendas D9/D10/D11. 11 Vitest suites / 179
tests green; typecheck clean; prepublishOnly gate (typecheck + tests +
build) protects publishes. Detail per block: docs/PLAN.md.

## How to run

- Dev: `npm run dev:web` (Vite) + `npm run dev:server` (tsc watch).
- Prod-like: `npm run build` then `node bin/yuemail.mjs`.
- Tests: `npm test`. Typecheck: `npm run typecheck`.

## Open items (pending registry is canonical)

None at v0.4.0 publish time.

Resolved 2026-06-11: PND-003 (dictation in SendDialog + SignaturePad,
D11), PND-005 (Gate 13 -- owner approved ARCHITECTURE.md + DESIGN.md),
PND-006 (RFP adenda: F14 registered, version + counts normalized) and
PND-007 (feedback channel: contact@yujin.app).

## Deferred by scope (v0.4+ candidates)

Reply / forward / body fetch, OAuth, multi-account, mobile,
multi-document tabs, auto-update notification.
