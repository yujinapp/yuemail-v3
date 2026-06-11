# Yuemail -- Sprint iteration log

Status: reconstructed 2026-06-11 from the git history (PND-004) as
the canonical bridge log the RFP deliverables list requires. From
this date on, new iterations get appended here in the same commit
that ships them.

| Date | Commit | Milestone |
|------|--------|-----------|
| 2026-06-05 | ff13532 | v0.3.0 Experiment B baseline: full greenfield build of F1-F13 (Sumi-Forge, single session). |
| 2026-06-10 | b0b0fb7 | Modal voice contexts: globals suspended while a dialog is open, contextual vocabulary per modal, recognizer survives re-renders. Semantic graph repaired + workflow persisted. |
| 2026-06-10 | 6cea90d | Workflow deliverables generated: ARCHITECTURE.md, DESIGN.md, HANDOFF/manual/observability stubs, NAC3 voice audit. |
| 2026-06-10 | 0598bf5 | Settings gear with 3-tier email autoconfiguration + live IMAP/SMTP verify (design D9). |
| 2026-06-10 | 03fbaa8 | External audit closure: honest tests, vault key_source caveat surfaced, warnings. |
| 2026-06-10 | f5f5ba2 | Fix: vault sources that 03fbaa8 promised but did not include. |
| 2026-06-10 | 0af1e0b | Settings field dictation (design D10, closed PND-002): voice-armed fields, per-kind spoken-form translation, symmetry test-enforced. |
| 2026-06-11 | (this commit) | Canonical docs audit (PND-004): PLAN / ITERATIONS / SUCCESS_CASE / HOW_WE_GOT_HERE created; HANDOFF / manual.es / observability rewritten from stubs; test count verified at 11 suites / 160 green; version labels normalized to v0.3.0; workflow + pendings synchronized (PND-005/006/007 opened). |
