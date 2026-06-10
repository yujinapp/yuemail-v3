# NAC3 voice coverage audit -- 2026-06-10

Scope: every action, modal and view in yuemail-v3; do all of them have
NAC3 markup AND a voice route? Requested by Pablo after suspecting the
modal close buttons lacked coverage.

Verdict (pre-fix): NAC3 attribute markup was COMPLETE. The voice
ROUTING was not -- modals were a dead end for voice-only operation.
Fixed in this same session (see "Fix shipped" below).

## 1. NAC3 attribute inventory (pre-fix, all present)

### Topbar / App shell
| element            | data-nac-id              | data-nac-action       |
|--------------------|--------------------------|-----------------------|
| topbar             | yuemail.topbar.root      | --                    |
| mic toggle         | yuemail.voice.btn-mic    | mic_on / mic_off      |
| send card button   | yuemail.email.btn-open   | open_send_dialog      |
| inbox refresh      | yuemail.inbox.btn-refresh| refresh_inbox         |

### SendDialog (modal)
| element       | data-nac-id             | data-nac-action |
|---------------|-------------------------|-----------------|
| dialog root   | yuemail.email.dialog    | -- (role=dialog)|
| recipients    | yuemail.email.to        | set_recipients  |
| subject       | yuemail.email.subject   | set_subject     |
| body          | yuemail.email.body      | set_body        |
| attach toggle | yuemail.email.attach    | toggle_attach   |
| cancel button | yuemail.email.btn-cancel| cancel_send     |
| send button   | yuemail.email.btn-send  | send_email      |

### SignaturePad (modal)
| element       | data-nac-id                  | data-nac-action     |
|---------------|------------------------------|---------------------|
| modal root    | yuemail.signature.modal      | -- (role=dialog)    |
| canvas        | yuemail.signature.canvas     | draw_signature      |
| typed name    | yuemail.signature.typed-name | type_signature_name |
| bake button   | yuemail.signature.btn-bake   | bake_signature_name |
| clear button  | yuemail.signature.btn-clear  | clear_signature     |
| cancel button | yuemail.signature.btn-cancel | cancel_signature    |
| save button   | yuemail.signature.btn-save   | save_signature      |

Toolbar + Editor: fully attributed (see tests/nac3-attrs.test.ts).

## 2. The real gap: voice routing asymmetry (pre-fix)

The parser knew 11 global phrases; ZERO reached inside an open modal:

- Voice could OPEN SendDialog ("enviar a ...") and SignaturePad
  ("guardar firma") but could not confirm, cancel or save once open.
  Voice-only users hit a dead end and needed the mouse.
- Worse: global phrases stayed live behind the modal. Saying "firmar"
  with the pad open inserted the OLD stored signature into the
  background document.
- Root cause #2 (found during the fix): useVoice recreated the speech
  recognizer on EVERY render of App (effect depended on inline callback
  identities), so any toast or modal open killed the mic session.

## 3. Fix shipped (this session)

1. `src/voice/commands.ts`
   - New `VoiceContext` = global | send_dialog | signature_pad.
   - Contextual matchers: CONFIRMAR_ENVIO, CANCELAR, GUARDAR_FIRMA_PAD,
     BORRAR_FIRMA, GENERAR_FIRMA.
   - With a modal open, global commands are suppressed EXCEPT the mic
     safety set (encender/apagar microfono, detener voz).
   - COMMAND_CATALOG entries now carry `context` + `nac_action` so the
     vocabulary is statically checkable against the DOM markup.
2. `src/voice/useVoice.ts`
   - Callbacks moved to a ref; the recognizer is created once and
     survives re-renders (mic no longer dies on toast/modal).
   - New `getContext` option reports the active modal at utterance time.
3. `src/App.tsx`
   - Tracks the active voice context (signature_pad > send_dialog >
     global).
   - Contextual commands click the target button via its
     data-nac-action, so voice and click share the exact same handler.
   - Dictation is suppressed while a modal is open (no more transcribing
     into the background document).

## 4. Regression guard

- tests/voice.test.ts: 19 new cases (contextual parsing, suppression,
  mic passthrough, catalog/context coherence).
- tests/nac3-attrs.test.ts: producer/consumer symmetry suite (SQ 14):
  every `<button data-nac-action>` inside a modal file MUST have a
  contextual COMMAND_CATALOG entry AND a clickNacAction route in
  App.tsx. Adding a modal button without a voice route now fails CI.

Suite status after fix: 10 files / 84 tests green; tsc --noEmit clean.

## 5. Voice command reference (post-fix)

Global (9, unchanged -- acceptance #5): nuevo documento, abrir
documento [nombre], guardar firma, firmar, iniciar dictado, fin
dictado, enviar a <email>, leer bandeja, detener voz (+ mic pair).

SendDialog open: "confirmar" / "enviar" / "mandar" -> send;
"cancelar" / "cerrar" / "salir" / "volver" -> close.

SignaturePad open: "guardar" / "listo" -> save; "borrar" / "limpiar"
-> clear canvas; "generar" / "cursiva" -> bake typed name;
"cancelar" / "cerrar" / "salir" / "volver" -> close.

Any modal: "apagar microfono" / "detener voz" always work.
