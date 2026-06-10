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
import { useVoice } from './voice/useVoice.js';
import type { VoiceCommand, VoiceContext } from './voice/commands.js';
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
  const [sendPrefillTo, setSendPrefillTo]     = React.useState('');
  const [envelopes, setEnvelopes] = React.useState<InboxEnvelope[]>([]);
  const [toasts, setToasts]       = React.useState<Toast[]>([]);
  const [dictation, setDictation] = React.useState(false);

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

  /* Contextual commands drive the SAME handler as the on-screen button:
   * resolve the element by its data-nac-action and click it. */
  function clickNacAction(action: string): boolean {
    const el = document.querySelector<HTMLElement>('[data-nac-action="' + action + '"]');
    if (!el) return false;
    el.click();
    return true;
  }

  function onVoiceCommand(cmd: VoiceCommand) {
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
        setDictation(true); pushToast('info', 'Dictado iniciado.'); break;
      case 'FIN_DICTADO':
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
        if (clickNacAction('bake_signature_name')) pushToast('info', 'Firma cursiva generada.');
        break;
      case 'DETECTAR_SERVIDORES':
        clickNacAction('autodetect_servers'); break;
      case 'PROBAR_CONEXION':
        clickNacAction('test_connection'); break;
      case 'GUARDAR_CONFIG':
        clickNacAction('save_settings'); break;
      default:
        /* UNKNOWN -- ignore silently. */
        break;
    }
  }

  function onVoiceTranscript(text: string, isFinal: boolean) {
    if (!isFinal || !dictation) return;
    /* A modal owns the voice channel: do not dictate into the document
     * sitting behind it. */
    if (voiceContextRef.current !== 'global') return;
    /* Append the transcript as a new paragraph block. */
    setBlocks((prev) => [...prev, { type: 'paragraph', text }]);
  }

  const voice = useVoice({
    onCommand:    onVoiceCommand,
    onTranscript: onVoiceTranscript,
    getContext:   () => voiceContextRef.current,
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
