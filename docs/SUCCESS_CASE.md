# Yuemail -- Success case (product manifest)

Status: written 2026-06-11 (PND-004); RFP deliverable that was
pending since the sprint.

## What it is

Yuemail is a voice-first, single-user, local-only email client for
people with motor and/or visual impairment. It lets its user dictate
a written document in Spanish, sign it, and send it as a real .docx
attachment -- without a sighted helper and without sustained-precision
mouse work.

## North star

> "Pablo dicta un informe, dice 'firmar', dice 'enviar a ana arroba
> ejemplo punto com', y termina. El sistema desaparece."

Target: under 4 minutes end-to-end, zero strictly-required clicks
(the one mandatory confirmation is keyboard-tab-accessible).

## Why it matters as a Yujin case

- Dogfoods the full Forge greenfield workflow (Experiment B baseline
  built in a single Sumi-Forge session on 2026-06-05).
- Demonstrates NAC3 symmetry as an enforced contract: every button is
  voice-reachable, every voice command resolves the same handler as
  the click, and the test suite fails when either side drifts (SQ 14).
- Demonstrates the lema: the system learns the user's words (arroba,
  punto, campo contrasena, digit words for ports) instead of teaching
  the user ports and protocols. Account setup needs only the address.

## Quality numbers (verified 2026-06-11)

- 11 Vitest suites / 179 tests green; typecheck strict +
  noUncheckedIndexedAccess clean; prepublishOnly gate enforces
  typecheck + tests + build before any publish.
- Vault encrypted at rest (AES-256-GCM, scrypt) -- at-rest secrecy
  test-verified; API never returns a stored value.
- Server binds 127.0.0.1 only, test-enforced.
- No DB, no telemetry, no login: JSON under ~/.yuemail/.

## Distribution

Public npm package @yujinapp/yuemail (bin: yuemail), MIT license,
v0.4.0. Install: npm i -g @yujinapp/yuemail.

## Current frontier

Deferred to v0.4+: reply/forward/body fetch, OAuth, multi-account,
mobile, dictation into SendDialog/SignaturePad fields (PND-003).
