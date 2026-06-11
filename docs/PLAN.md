# Yuemail -- Build plan (analyst output, Phase II/III)

Status: reconstructed 2026-06-11 (PND-004) as the canonical record of
the plan the greenfield sprint executed. The build predates this file;
nothing here is speculative -- every block listed is SHIPPED and the
suite column names the test file that guards it today.
RFP: docs/SPEC.md. Architecture: docs/ARCHITECTURE.md.
Design: docs/DESIGN.md. Iteration log: docs/ITERATIONS.md.

## Block decomposition (F1-F13 + adendas)

| Block | Scope | Primary test guard |
|-------|-------|--------------------|
| F1 toolbar | 4 named buttons, always visible, focusable | tests/toolbar.test.ts |
| F2 voice | Spanish parser, 10 global phrases + modal contexts | tests/voice.test.ts (74 tests) |
| F3 editor | title + ordered blocks (paragraph / signature), JSON persistence | no dedicated suite; covered indirectly by nac3-attrs + aria |
| F4 signature | save (pad: draw / type+bake) and apply as block | tests/nac3-attrs.test.ts + voice contextual cases |
| F5 docx | render title+blocks to .docx on demand, never persisted | tests/docx.test.ts |
| F6 smtp send | per-send nodemailer transport from vault | tests/email-reject.test.ts |
| F7 inbox | imapflow envelopes read-only, refresh on demand | no dedicated suite; exercised manually (see PLAN gaps) |
| F8 vault | AES-256-GCM, scrypt, per-machine salt, no values out | tests/vault.test.ts (15 tests) |
| F9 nac3 | data-nac-* on every interactive element | tests/nac3-attrs.test.ts (10 tests) |
| F10 design system | single token file, no hardcoded values outside it | tests/design-tokens.test.ts |
| F11 a11y | dual aria-live regions + announce helper | tests/aria.test.ts |
| F12 cli | bin/yuemail.mjs subcommands, loopback-only server | tests/cli-help.test.ts + tests/server-port.test.ts |
| F13 local-only | no DB, no telemetry, no LAN | tests/server-port.test.ts + vault suite |
| Adenda D9 settings autoconfig | gear dialog, 3-tier IMAP/SMTP resolution, live verify | tests/autoconfig.test.ts (38 tests) |
| Adenda D10 field dictation | voice-armed settings fields, per-kind translation | tests/voice.test.ts + tests/nac3-attrs.test.ts symmetry |

## Build order (as executed)

1. Scaffold: Vite + React 18 + Express 4 + TS strict + tokens.css.
2. Editor + document store (F3) -- the data spine everything hangs on.
3. Signature pad + apply (F4), docx rendering (F5).
4. Vault (F8) before any credential-consuming feature.
5. Email send (F6) + inbox (F7) on top of the vault.
6. Voice parser + Web Speech hook (F2) wiring every prior block.
7. NAC3 attributes (F9), a11y regions (F11), design tokens (F10).
8. CLI binary + loopback hardening (F12, F13).
9. Adendas 2026-06-10: modal voice contexts, settings autoconfig
   (D9 / F14), settings field dictation (D10).
10. Adenda 2026-06-11: dialog field dictation in every modal with
    append-body + dictation precedence (D11, PND-003).

## Test plan

Post-implementation per the Forge testing policy: every block ships
with its suite in the same iteration. Producer/consumer symmetry
(SQ 14) is itself test-enforced (tests/nac3-attrs.test.ts fails when
a modal button lacks a voice route or a settings input lacks a field
spec). Verified totals 2026-06-11 (v0.4.0): 11 suites / 179 tests
green, including a mutation red-check of the no-accidental-send
guard.

## Known gaps accepted by this plan

- F3 and F7 lack dedicated suites (tracked as canon debt; acceptable
  while their behavior is covered indirectly and the product is alpha).

## Risks identified up front

- Web Speech API only in Chrome/Edge/Safari -> button parity (F1).
- Default vault passphrase is derivable -> documented threat-model
  limit (DESIGN.md D2) + key_source caveat surfaced in the UI.
- Gmail/Outlook app-password friction -> provider caveats in the
  autoconfig table (D9).
