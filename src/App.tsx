/**
 * Yuemail App shell.
 *
 * Wires topbar + toolbar + editor + side panel + voice + modals.
 * Voice commands route via the shared dispatch table so a button click
 * and the spoken phrase fire the same handler.
 *
 * ASCII-only.
 */
import * as React from 'react';
import { Toolbar, type ToolbarAction } from './components/Toolbar.js';
import { Editor, type DocumentBlock } from './components/Editor.js';
import { SignaturePad } from './components/SignaturePad.js';
import { SendDialog } from './components/SendDialog.js';
import { SettingsDialog } from './components/SettingsDialog.js';
import { BrainSettings } from './components/BrainSettings.js';
import { VoiceSettings } from './components/VoiceSettings.js';
import { useVoice } from './voice/useVoice.js';
import {
  FIELD_SPECS_BY_CONTEXT,
  parseCommand,
  spokenCheckboxValue,
  spokenFieldValue,
  type DialogFieldSpec,
  type VoiceCommand,
  type VoiceContext,
} from './voice/commands.js';
import { resolveCommand, resolveLiterallyFirst } from './voice/resolveCommand.js';
import { diagLog } from './voice/diagnostics.js';
import { announce, ensureRegions } from './lib/ariaLive.js';
import { api } from './lib/api.js';

interface InboxEnvelope { uid: number; from: string; subject: string; date: string }

interface Toast { kind: 'info' | 'success' | 'error'; text: string; id: number }

export function App(): React.ReactElement {
  const [docId, setDocId]       = React.useState<string | undefined>(undefined);
  const [title, setTitle]       = React.useState('');
  const [blocks, setBlocks]     = React.useState<DocumentBlock[]>([]);
  const [signatureExists, setSignatureExists] = React.useState(false);
  const [showSignaturePad, setShowSignaturePad] = React.useState(false);
  const [showSendDialog, setShowSendDialog]   = React.useState(false);
  const [showSettings, setShowSettings]       = React.useState(false);
  const [showBrain, setShowBrain]             = React.useState(false);
  const [showVoice, setShowVoice]             = React.useState(false);
  const [sendPrefillTo, setSendPrefillTo]     = React.useState('');
  const [envelopes, setEnvelopes] = React.useState<InboxEnvelope[]>([]);
  const [toasts, setToasts]       = React.useState<Toast[]>([]);
  const [dictation, setDictation] = React.useState(false);
  /* Mirror dictation into a ref so the voice resolver always reads the
   * current value: while dictating, speech is CONTENT, not a command, so
   * the Brain must not re-interpret it (the matcher still catches the
   * literal "fin dictado" to stop). */
  const dictationRef = React.useRef(false);
  dictationRef.current = dictation;

  React.useEffect(() => { ensureRegions(); }, []);
  React.useEffect(() => {
    api.signatureGet().then((s) => setSignatureExists(s.exists)).catch(() => { /* ignore */ });
  }, []);

  function pushToast(kind: Toast['kind'], text: string) {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { kind, text, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    announce(text, kind === 'error' ? 'assertive' : 'polite');
  }

  async function ensureDocument(): Promise<string> {
    if (docId) return docId;
    const res = await api.documentCreate({ title, blocks });
    setDocId(res.document.id);
    return res.document.id;
  }

  async function persistCurrent() {
    if (!docId) return;
    await api.documentUpdate(docId, { title, blocks });
  }

  /* --- handlers shared by buttons + voice --- */

  async function onNewDocument() {
    if (docId) await persistCurrent();
    setDocId(undefined);
    setTitle('');
    setBlocks([]);
    pushToast('info', 'Documento nuevo abierto.');
  }

  async function onOpenDocument(name?: string) {
    try {
      const list = await api.documentsList();
      const docs = list.documents;
      let target = docs[0];
      if (name && name.length > 0) {
        const lower = name.toLowerCase();
        const matched = docs.find((d) => d.title.toLowerCase().includes(lower));
        if (matched) target = matched;
      }
      if (!target) {
        pushToast('info', 'No hay documentos guardados.');
        return;
      }
      const detail = await api.documentGet(target.id);
      const doc = detail.document as { id: string; title: string; blocks: DocumentBlock[] };
      setDocId(doc.id);
      setTitle(doc.title);
      setBlocks(doc.blocks);
      pushToast('success', 'Documento abierto: ' + doc.title);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'No se pudo abrir.');
    }
  }

  function onSaveSignaturePad() {
    setShowSignaturePad(true);
  }

  async function onSignDocument() {
    try {
      const sig = await api.signatureGet();
      if (!sig.exists) {
        pushToast('info', 'Aun no hay firma guardada. Abriendo el pad.');
        setShowSignaturePad(true);
        return;
      }
      const newBlocks: DocumentBlock[] = [
        ...blocks,
        { type: 'signature_image', png_b64: sig.png_b64 ?? '' },
      ];
      setBlocks(newBlocks);
      pushToast('success', 'Firma insertada.');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'No se pudo firmar.');
    }
  }

  async function onSaveSignaturePng(pngB64: string) {
    try {
      await api.signatureSet(pngB64);
      setSignatureExists(true);
      setShowSignaturePad(false);
      pushToast('success', 'Firma guardada.');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'No se pudo guardar la firma.');
    }
  }

  async function onSendEmail(prefillTo?: string) {
    await ensureDocument();
    await persistCurrent();
    setSendPrefillTo(prefillTo ?? '');
    setShowSendDialog(true);
  }

  async function performSend(payload: { to: string; subject: string; body_text: string; attach_document_id?: string }) {
    try {
      const res = await api.emailSend(payload);
      pushToast('success', 'Enviado: ' + res.accepted.join(', '));
      setShowSendDialog(false);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'No se pudo enviar.');
    }
  }

  async function onReadInbox() {
    try {
      const res = await api.inboxList(20);
      setEnvelopes(res.envelopes);
      pushToast('info', res.envelopes.length + ' correos en bandeja.');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'No se pudo leer la bandeja.');
    }
  }

  /* --- voice wiring --- */

  /* Which modal (if any) owns the voice vocabulary right now. Kept in a
   * ref so the recognition callback always reads the current value. */
  const voiceContext: VoiceContext =
    showSignaturePad ? 'signature_pad' :
    showSendDialog   ? 'send_dialog'   :
    showSettings     ? 'settings_dialog' : 'global';
  const voiceContextRef = React.useRef<VoiceContext>(voiceContext);
  voiceContextRef.current = voiceContext;

  /* Dialog field armed for dictation via "campo <nombre>". Arming is
   * voice-only on purpose: keyboard focus never arms a field, so the mic
   * cannot scribble into a field the user is typing in by hand. Any
   * context switch (modal opened / closed / swapped) disarms. */
  const armedFieldRef = React.useRef<DialogFieldSpec | undefined>(undefined);
  React.useEffect(() => {
    armedFieldRef.current = undefined;
  }, [voiceContext]);

  /* Contextual commands drive the SAME handler as the on-screen button:
   * resolve the element by its data-nac-action and click it. */
  function clickNacAction(action: string): boolean {
    const el = document.querySelector<HTMLElement>('[data-nac-action="' + action + '"]');
    if (!el) return false;
    /* A disabled control swallows click() silently -- report failure so
     * the voice route does not announce a success that never happened. */
    if (el instanceof HTMLButtonElement && el.disabled) return false;
    el.click();
    return true;
  }

  /* --- dialog field dictation (voice parity for the modal inputs) --- */

  type DictatableElement = HTMLInputElement | HTMLTextAreaElement;

  function nacField(action: string): DictatableElement | undefined {
    const el = document.querySelector('[data-nac-action="' + action + '"]');
    return (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) ? el : undefined;
  }

  function focusNacField(spec: DialogFieldSpec): boolean {
    const el = nacField(spec.nac_action);
    if (!el) return false;
    el.focus();
    return true;
  }

  /* Write into a React-controlled input/textarea: go through the native
   * value setter + an 'input' event so React's onChange sees the change. */
  function setNacFieldValue(spec: DialogFieldSpec, value: string): boolean {
    const el = nacField(spec.nac_action);
    if (!el) return false;
    const proto = el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (!setter) return false;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  function setNacCheckbox(spec: DialogFieldSpec, on: boolean): boolean {
    const el = nacField(spec.nac_action);
    if (!(el instanceof HTMLInputElement)) return false;
    if (el.checked !== on) el.click();
    return true;
  }

  function applyFieldDictation(spec: DialogFieldSpec, raw: string) {
    if (spec.kind === 'checkbox') {
      const on = spokenCheckboxValue(raw);
      if (on === undefined) {
        pushToast('info', 'Para ' + spec.label + ' deci "si" o "no".');
        return;
      }
      if (setNacCheckbox(spec, on)) pushToast('info', spec.label + (on ? ' activado.' : ' desactivado.'));
      return;
    }
    const value = spokenFieldValue(raw, spec.kind);
    if (value.length === 0) {
      pushToast('info', 'No capte un valor para ' + spec.label + '. Proba de nuevo.');
      return;
    }
    if (spec.kind === 'body') {
      /* Long dictation APPENDS paragraph by paragraph (the field stays
       * armed): replacing would destroy everything said so far. */
      const el = nacField(spec.nac_action);
      const current = el ? el.value : '';
      const next = current.trim().length > 0
        ? current.replace(/\s+$/, '') + '\n\n' + value
        : value;
      if (setNacFieldValue(spec, next)) {
        pushToast('info', 'Agregado al cuerpo: ' + (value.length > 60 ? value.slice(0, 57) + '...' : value));
      }
      return;
    }
    if (setNacFieldValue(spec, value)) {
      /* Never echo a credential -- announce only that it landed. */
      pushToast('info', spec.kind === 'password'
        ? 'Contrasena cargada (' + value.length + ' caracteres).'
        : spec.label + ': ' + value);
    }
  }

  function onVoiceCommand(cmd: VoiceCommand) {
    diagLog('act', {
      commandType: cmd.type, payload: cmd.payload, raw: cmd.raw, normalized: cmd.normalized,
      context: voiceContextRef.current, dictationOn: dictationRef.current,
      armedField: armedFieldRef.current?.key,
    });
    switch (cmd.type) {
      case 'NUEVO_DOCUMENTO':
        void onNewDocument(); break;
      case 'ABRIR_DOCUMENTO':
        void onOpenDocument(cmd.payload); break;
      case 'GUARDAR_FIRMA':
        onSaveSignaturePad(); break;
      case 'FIRMAR':
        void onSignDocument(); break;
      case 'INICIAR_DICTADO':
        /* Flip the ref imperatively too, so the very next utterance is
         * already treated as content even before React re-renders. */
        dictationRef.current = true;
        setDictation(true); pushToast('info', 'Dictado iniciado.'); break;
      case 'FIN_DICTADO':
        dictationRef.current = false;
        setDictation(false); pushToast('info', 'Dictado finalizado.'); break;
      case 'ENVIAR':
        void onSendEmail(cmd.payload); break;
      case 'LEER_BANDEJA':
        void onReadInbox(); break;
      case 'ABRIR_CONFIGURACION':
        setShowSettings(true); break;
      case 'ENCENDER_MICROFONO':
        voice.start(); pushToast('info', 'Microfono encendido.'); break;
      case 'APAGAR_MICROFONO':
      case 'DETENER_VOZ':
        voice.stop(); pushToast('info', 'Microfono apagado.'); break;
      /* Contextual (modal) commands -- routed through the button's own
       * data-nac-action so voice and click share one handler. */
      case 'CONFIRMAR_ENVIO':
        clickNacAction('send_email'); break;
      case 'CANCELAR':
        if (clickNacAction('cancel_signature') || clickNacAction('cancel_send') || clickNacAction('cancel_settings')) {
          pushToast('info', 'Ventana cerrada.');
        }
        break;
      case 'GUARDAR_FIRMA_PAD':
        clickNacAction('save_signature'); break;
      case 'BORRAR_FIRMA':
        if (clickNacAction('clear_signature')) pushToast('info', 'Lienzo de firma borrado.');
        break;
      case 'GENERAR_FIRMA':
        if (clickNacAction('bake_signature_name')) {
          pushToast('info', 'Firma cursiva generada.');
        } else {
          pushToast('info', 'Escribi primero tu nombre en el campo de texto del pad.');
        }
        break;
      case 'DETECTAR_SERVIDORES':
        clickNacAction('autodetect_servers'); break;
      case 'PROBAR_CONEXION':
        clickNacAction('test_connection'); break;
      case 'GUARDAR_CONFIG':
        clickNacAction('save_settings'); break;
      case 'ENFOCAR_CAMPO': {
        const ctx = voiceContextRef.current;
        if (ctx === 'global') break;
        const specs = FIELD_SPECS_BY_CONTEXT[ctx];
        const spec = specs.find((s) => s.key === cmd.payload);
        if (!spec) {
          pushToast('info', 'No encontre ese campo. Proba: ' + specs.map((s) => 'campo ' + (s.aliases[0] ?? s.key)).join(', ') + '.');
          break;
        }
        if (focusNacField(spec)) {
          armedFieldRef.current = spec;
          pushToast('info', spec.kind === 'checkbox'
            ? 'Campo ' + spec.label + '. Deci "si" o "no".'
            : spec.kind === 'body'
              ? 'Campo ' + spec.label + '. Dicta; cada frase se agrega como parrafo. Deci "fin campo" al terminar.'
              : 'Campo ' + spec.label + '. Dicta el valor.');
        } else {
          pushToast('info', 'El campo ' + spec.label + ' no esta visible ahora.');
        }
        break;
      }
      case 'BORRAR_CAMPO': {
        const ctx = voiceContextRef.current;
        const specs = ctx === 'global' ? [] : FIELD_SPECS_BY_CONTEXT[ctx];
        const spec = (cmd.payload
          ? specs.find((s) => s.key === cmd.payload)
          : undefined) ?? armedFieldRef.current;
        if (!spec || spec.kind === 'checkbox') {
          pushToast('info', 'Primero enfoca un campo de texto con "campo <nombre>".');
          break;
        }
        if (setNacFieldValue(spec, '')) {
          armedFieldRef.current = spec;
          pushToast('info', 'Campo ' + spec.label + ' vacio. Dicta el valor.');
        }
        break;
      }
      case 'FIN_CAMPO': {
        const spec = armedFieldRef.current;
        armedFieldRef.current = undefined;
        pushToast('info', spec
          ? 'Campo ' + spec.label + ' listo. Comandos del dialogo activos de nuevo.'
          : 'Ningun campo estaba enfocado.');
        break;
      }
      default:
        /* Not a recognised command. Two homes for free speech:
         *  - inside a modal with a field armed: it is that field's value.
         *  - in the document with dictation active: it is a new paragraph.
         * Routing the text HERE (after the command is resolved) instead of
         * at the transcript stage is what keeps the control phrases
         * ("iniciar dictado" / "fin dictado") OUT of the document -- they
         * resolve to their own command cases above and never reach here. */
        if (voiceContextRef.current !== 'global') {
          if (armedFieldRef.current) {
            diagLog('act', { outcome: 'dictado_a_campo', armedField: armedFieldRef.current.key, detail: cmd.raw, context: voiceContextRef.current });
            applyFieldDictation(armedFieldRef.current, cmd.raw);
          } else {
            diagLog('act', { outcome: 'ignorado_sin_campo_armado', context: voiceContextRef.current, detail: cmd.raw });
          }
        } else if (dictationRef.current) {
          const text = cmd.raw.trim();
          if (text.length === 0) break;
          /* Safety guard (PND-016): a dictation toggle must NEVER be written
           * as content. If the recogniser's transcript still resolved here
           * (e.g. a variant the upstream router missed), act on the toggle
           * instead of pasting "fin dictado" into the document. */
          const reparsed = parseCommand(text, 'global').type;
          if (reparsed === 'FIN_DICTADO') { dictationRef.current = false; setDictation(false); pushToast('info', 'Dictado finalizado.'); diagLog('act', { outcome: 'red_seguridad_fin_dictado', dictationOn: false, detail: text }); break; }
          if (reparsed === 'INICIAR_DICTADO') { diagLog('act', { outcome: 'red_seguridad_iniciar_ignorado', dictationOn: true, detail: text }); break; }
          diagLog('act', { outcome: 'escribio_parrafo', dictationOn: true, detail: text });
          setBlocks((prev) => [...prev, { type: 'paragraph', text }]);
        } else {
          diagLog('act', { outcome: 'ignorado_sin_dictado', context: 'global', detail: cmd.raw });
        }
        break;
    }
  }

  function onVoiceTranscript(_text: string, _isFinal: boolean) {
    /* Document dictation no longer appends here. The final transcript is
     * routed through onVoiceCommand instead (see the default case), so a
     * control phrase like "fin dictado" is acted on rather than written.
     * Kept wired for any future live-interim display. */
  }

  const voice = useVoice({
    onCommand:    onVoiceCommand,
    onTranscript: onVoiceTranscript,
    getContext:   () => voiceContextRef.current,
    getArmed:     () => armedFieldRef.current !== undefined,
    /* Camino 1: the Brain classifies each utterance first; resolveCommand
     * falls back to the fixed-phrase matcher on any miss. But the dictation
     * toggles and all content spoken while dictating are routed by the fast
     * literal matcher (no network), so dictation starts/stops instantly and
     * dictated content is never re-read by the Brain as a command. */
    resolveCommand: (raw, context, o) => {
      const dictationOn = dictationRef.current;
      const armedKey = armedFieldRef.current?.key;
      const instant = resolveLiterallyFirst(raw, context, o, dictationOn);
      if (instant) {
        diagLog('resolve', {
          lane: 'literal-first', context, dictationOn, armedField: armedKey,
          commandType: instant.type, payload: instant.payload, raw, normalized: instant.normalized,
        });
        return Promise.resolve(instant);
      }
      let lane: 'armed-field' | 'brain' | 'fallback' = 'brain';
      return resolveCommand(raw, context, o, {
        onTrace: (info) => { lane = info.lane; },
      }).then((cmd) => {
        diagLog('resolve', {
          lane, context, dictationOn, armedField: armedKey,
          commandType: cmd.type, payload: cmd.payload, raw, normalized: cmd.normalized,
        });
        return cmd;
      });
    },
  });

  function onToolbarAction(action: ToolbarAction) {
    if (action === 'new_document')    void onNewDocument();
    if (action === 'open_document')   void onOpenDocument();
    if (action === 'save_signature')  onSaveSignaturePad();
    if (action === 'sign_document')   void onSignDocument();
  }

  return (
    <>
      <header className="yuemail-topbar" data-nac-id="yuemail.topbar.root">
        <h1>Yuemail</h1>
        <div className="yuemail-topbar-actions">
          <button
            type="button"
            className="yuemail-brain-btn"
            aria-label="Asistente de voz"
            title="Asistente de voz (IA)"
            onClick={() => setShowBrain(true)}
            data-nac-id="yuemail.voice.btn-brain"
            data-nac-role="button"
            data-nac-action="open_brain"
          >
            Asistente
          </button>
          <button
            type="button"
            className="yuemail-brain-btn"
            aria-label="Voz: escuchar y hablar"
            title="Voz (Google): escuchar y hablar"
            onClick={() => setShowVoice(true)}
            data-nac-id="yuemail.voice.btn-voice"
            data-nac-role="button"
            data-nac-action="open_voice"
          >
            Voz
          </button>
          <button
            type="button"
            className="yuemail-settings-gear"
            aria-label="Configuracion del correo"
            title="Configuracion del correo"
            onClick={() => setShowSettings(true)}
            data-nac-id="yuemail.settings.btn-open"
            data-nac-role="button"
            data-nac-action="open_settings"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="yuemail-mic-toggle"
            data-state={voice.listening ? 'on' : 'off'}
            onClick={() => voice.listening ? voice.stop() : voice.start()}
            disabled={!voice.supported}
            data-nac-id="yuemail.voice.btn-mic"
            data-nac-role="button"
            data-nac-action={voice.listening ? 'mic_off' : 'mic_on'}
          >
            {voice.supported ? (voice.listening ? 'Microfono encendido' : 'Encender microfono') : 'Voz no soportada'}
          </button>
        </div>
      </header>

      <Toolbar onAction={onToolbarAction} />

      <main className="yuemail-main">
        <Editor
          title={title}
          blocks={blocks}
          onTitleChange={setTitle}
          onBlocksChange={setBlocks}
        />
        <aside className="yuemail-side">
          <section className="yuemail-card" data-nac-id="yuemail.email.card">
            <h2>Enviar correo</h2>
            <button type="button" onClick={() => void onSendEmail()} data-nac-id="yuemail.email.btn-open" data-nac-action="open_send_dialog">
              Componer envio
            </button>
          </section>
          <section className="yuemail-card" data-nac-id="yuemail.inbox.card">
            <h2>Bandeja</h2>
            <button type="button" onClick={() => void onReadInbox()} data-nac-id="yuemail.inbox.btn-refresh" data-nac-action="refresh_inbox">
              Leer bandeja
            </button>
            <ul style={{ marginTop: 12, paddingLeft: 16 }}>
              {envelopes.slice(0, 8).map((e) => (
                <li key={e.uid} style={{ marginBottom: 6 }}>
                  <strong>{e.from || '(remitente vacio)'}</strong>
                  <div>{e.subject}</div>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </main>

      {showSignaturePad && (
        <SignaturePad
          onCancel={() => setShowSignaturePad(false)}
          onSave={(png) => void onSaveSignaturePng(png)}
        />
      )}

      {showSettings && (
        <SettingsDialog
          onClose={() => setShowSettings(false)}
          onToast={pushToast}
        />
      )}

      {showBrain && (
        <BrainSettings
          onClose={() => setShowBrain(false)}
          onToast={pushToast}
        />
      )}

      {showVoice && (
        <VoiceSettings
          onClose={() => setShowVoice(false)}
          onToast={pushToast}
        />
      )}

      {showSendDialog && (
        <SendDialog
          prefillTo={sendPrefillTo}
          prefillSubject={title}
          documentId={docId}
          onCancel={() => setShowSendDialog(false)}
          onSend={performSend}
        />
      )}

      {toasts.map((t) => (
        <div key={t.id} className="yuemail-toast" data-kind={t.kind} role="status">
          {t.text}
        </div>
      ))}

      <div style={{ display: 'none' }}>
        {/* hint for screen-readers + a11y tools: existing signature status */}
        <span aria-hidden="true">{signatureExists ? 'Firma guardada disponible.' : 'Aun no hay firma guardada.'}</span>
      </div>
    </>
  );
}
