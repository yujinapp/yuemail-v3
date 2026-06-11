/**
 * Send dialog (F6).
 *
 * Recipients (comma-separated), subject (auto-prefilled), body, attach
 * checkbox. Toast on success / failure.
 *
 * ASCII-only.
 */
import * as React from 'react';

export interface SendDialogProps {
  prefillTo?:      string;
  prefillSubject?: string;
  documentId?:     string;
  onCancel: () => void;
  onSend:   (payload: {
    to: string;
    subject: string;
    body_text: string;
    attach_document_id?: string;
  }) => Promise<void> | void;
}

export function SendDialog(props: SendDialogProps): React.ReactElement {
  const [to, setTo]               = React.useState(props.prefillTo ?? '');
  const [subject, setSubject]     = React.useState(props.prefillSubject ?? '');
  const [bodyText, setBodyText]   = React.useState('Adjunto el documento. Saludos.');
  const [attach, setAttach]       = React.useState(true);

  function submit() {
    const payload: { to: string; subject: string; body_text: string; attach_document_id?: string } = {
      to, subject, body_text: bodyText,
    };
    if (attach && props.documentId) payload.attach_document_id = props.documentId;
    void props.onSend(payload);
  }

  return (
    <div className="yuemail-modal" role="dialog" aria-label="Enviar correo" data-nac-id="yuemail.email.dialog" data-nac-role="dialog">
      <div className="yuemail-modal-card">
        <h2 style={{ marginTop: 0 }}>Enviar correo</h2>
        <p style={{ fontSize: 13, opacity: 0.7 }} role="note" data-nac-id="yuemail.email.voice-hint">
          Por voz: deci "campo destinatario", "campo asunto" o "campo cuerpo" y dicta
          el valor. En el cuerpo cada frase se agrega como parrafo nuevo. Deci
          "fin campo" al terminar y despues "enviar" o "cancelar".
        </p>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Destinatarios (separados por coma)
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            data-nac-id="yuemail.email.to"
            data-nac-role="textbox"
            data-nac-action="set_recipients"
          />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Asunto
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            data-nac-id="yuemail.email.subject"
            data-nac-role="textbox"
            data-nac-action="set_subject"
          />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Cuerpo
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            rows={4}
            data-nac-id="yuemail.email.body"
            data-nac-role="textbox"
            data-nac-action="set_body"
          />
        </label>
        {props.documentId && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={attach}
              onChange={(e) => setAttach(e.target.checked)}
              data-nac-id="yuemail.email.attach"
              data-nac-role="checkbox"
              data-nac-action="toggle_attach"
            />
            Adjuntar el documento (.docx)
          </label>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={props.onCancel} data-nac-id="yuemail.email.btn-cancel" data-nac-action="cancel_send">Cancelar</button>
          <button type="button" onClick={submit} data-nac-id="yuemail.email.btn-send" data-nac-action="send_email">Enviar</button>
        </div>
      </div>
    </div>
  );
}
