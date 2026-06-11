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
| 2026-06-11 | f87ca9b | Canonical docs audit (PND-004): PLAN / ITERATIONS / SUCCESS_CASE / HOW_WE_GOT_HERE created; HANDOFF / manual.es / observability rewritten from stubs; test count verified at 11 suites / 160 green; version labels normalized to v0.3.0; workflow + pendings synchronized (PND-005/006/007 opened). |
| 2026-06-11 | dab3f0f | Owner decisions: Gate 13 approved (PND-005), feedback channel contact@yujin.app (PND-007). |
| 2026-06-11 | (this commit) | v0.4.0: dialog field dictation in every modal (PND-003, design D11) with append-body, multi-address recipients, "fin campo", and dictation precedence (no accidental send, mutation-checked). RFP adenda PND-006: F14 registered, acceptance criteria normalized. 11 suites / 179 tests green. QA package for the manual testing team (docs/qa/). Published to npm. |
