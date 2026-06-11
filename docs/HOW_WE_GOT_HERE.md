# Yuemail -- How we got here (problems faced log)

Status: written 2026-06-11 (PND-004), reconstructed from the git
history, the NAC3 voice audit and the external review. RFP
deliverable that was pending since the sprint. New problems get
appended in the same session that hits them.

## P1 -- Voice dead-end inside modals

Voice could OPEN the send dialog and the signature pad but could not
confirm, cancel or save once they were open: a voice-only user needed
the mouse to finish the north-star journey. Found by the NAC3 voice
audit (docs/NAC3_VOICE_AUDIT_2026_06_10.md). Fix: per-modal voice
contexts; globals suspended while a dialog owns the channel.

## P2 -- Global vocabulary live behind modals

Worse than P1: with the signature pad open, saying "firmar" inserted
the OLD stored signature into the background document -- invisible to
a blind user. Same fix as P1, plus dictation suppressed while any
modal is open. Regression-guarded by tests/voice.test.ts.

## P3 -- Speech recognizer died on every re-render

useVoice recreated the SpeechRecognition instance whenever App
re-rendered (effect depended on inline callback identities), so any
toast or modal open killed the mic session. Fix: callbacks in a ref,
recognizer created once for the app lifetime.

## P4 -- A commit that promised files it did not contain

03fbaa8 announced vault sources that were not in the tree; f5f5ba2
repaired it the same day. Lesson folded into practice: verify the
diff before declaring a commit closed (SQ verification-honesty).

## P5 -- External audit: honest tests + derived passphrase

The external review found tests that asserted less than they claimed
and flagged that the default vault passphrase (hostname+username) is
derivable by a local attacker. Closure (03fbaa8): tests tightened,
threat-model limit documented explicitly (DESIGN.md D2), and the
server now reports key_source env|derived so the settings dialog can
show the caveat whenever the derived fallback is active.

## P6 -- Settings navigable by voice but not fillable

Finding 6 of the external review: voice could move through the
settings dialog but every value still needed the keyboard --
contradicting the product's reason to exist. Fix (D10): "campo
<nombre>" arms a field, the next utterance becomes its value with
per-kind spoken-form translation; arming is voice-only and passwords
are announced by length only.

## P7 -- Documentation drift

By 2026-06-11 the docs cited three different test counts (84, 105,
134) while the real suite had 160; version labels said v0.2.0 while
the package was 0.3.0; the settings feature was labelled F10, a
number the RFP already uses for the design system; and 4 RFP
deliverable docs had never been written. Closure: this audit
(PND-004) -- counts verified by running the suite, labels normalized,
missing canon written, RFP adenda proposed as PND-006.
