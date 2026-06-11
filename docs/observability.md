# Yuemail -- Observability posture

Status: rewritten 2026-06-11 (PND-004); replaces the generic
dashboard stub of 2026-06-10, which prescribed remote dashboards
this product must not have.

## Posture (by design, not by omission)

Yuemail is single-user, local-only and telemetry-free (F13 + D8):
there is no remote backend to dashboard, no error-rate endpoint, no
cost meter, no free-tier watchdog. Adding remote observability would
contradict the RFP. Therefore:

- Server logs go to stdout of the terminal that runs `yuemail`.
- Every failure is user-visible by design: toast + assertive ARIA
  announce with a human-readable Spanish reason (F11).
- The prepublishOnly gate (typecheck + tests + build) is the
  pre-release health check; the Vitest suite (11 suites / 179 tests,
  verified 2026-06-11) is the regression net.

## Diagnosing in the field

1. Reproduce with the terminal visible: server-side errors print to
   stdout with the failing route.
2. Email failures: the settings dialog's live verify
   (/api/email/verify) tests IMAP and SMTP independently and reports
   per-protocol ok/error -- first stop for credential issues.
3. Vault state: `yuemail vault list` shows key names (never values);
   /api/vault/status reports key_source env|derived.

## KPI

The only KPI is the north-star journey: dictate -> sign -> send in
under 4 minutes with zero strictly-required clicks. It is measured
by direct user feedback, not instrumentation (feedback channel:
contact@yujin.app, owner decision 2026-06-11).
