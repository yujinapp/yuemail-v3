/**
 * Settings dialog (F10) -- the gear.
 *
 * Configure the email account with just the address: the autoconfig
 * endpoint resolves IMAP/SMTP (known providers / Mozilla ISPDB /
 * convention guess), the user adds the password, optionally runs a
 * live connection test, and saves everything into the encrypted vault.
 *
 * The vault never returns stored values, so fields always start empty;
 * the status line shows which categories are already configured.
 * Leaving the password empty on save keeps the stored one.
 *
 * Voice (settings_dialog context): detectar / probar / guardar /
 * cancelar drive the same buttons via their data-nac-action. The
 * inputs are dictatable: "campo <nombre>" arms a field, the next
 * utterance becomes its value, "borrar campo" empties it (see
 * SETTINGS_FIELD_SPECS in src/voice/commands.ts).
 *
 * ASCII-only.
 */
import * as React from 'react';
import { api } from '../lib/api.js';

export interface SettingsDialogProps {
  onClose: () => void;
  onToast: (kind: 'info' | 'success' | 'error', text: string) => void;
}

interface CategoryFlags {
  imap:     { configured: boolean };
  smtp:     { configured: boolean };
  identity: { configured: boolean };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function SettingsDialog(props: SettingsDialogProps): React.ReactElement {
  const [name, setName]         = React.useState('');
  const [email, setEmail]       = React.useState('');
  const [password, setPassword] = React.useState('');
  /* Login user resolved by autoconfig (usually the full address). */
  const [username, setUsername] = React.useState('');
  const [imapHost, setImapHost]     = React.useState('');
  const [imapPort, setImapPort]     = React.useState('993');
  const [imapSecure, setImapSecure] = React.useState(true);
  const [smtpHost, setSmtpHost]     = React.useState('');
  const [smtpPort, setSmtpPort]     = React.useState('465');
  const [smtpSecure, setSmtpSecure] = React.useState(true);
  const [note, setNote]   = React.useState('');
  const [busy, setBusy]   = React.useState<'detect' | 'test' | 'save' | undefined>(undefined);
  const [status, setStatus] = React.useState<CategoryFlags | undefined>(undefined);
  const [keySource, setKeySource] = React.useState<'env' | 'derived' | undefined>(undefined);

  React.useEffect(() => {
    api.vaultStatus().then((s) => { setStatus(s.status); setKeySource(s.key_source); }).catch(() => { /* ignore */ });
  }, []);

  async function detect() {
    if (!EMAIL_RE.test(email.trim())) {
      props.onToast('info', 'Escribi primero la direccion de correo completa.');
      return;
    }
    setBusy('detect');
    try {
      const res = await api.emailAutoconfig(email.trim());
      setImapHost(res.imap.host);
      setImapPort(String(res.imap.port));
      setImapSecure(res.imap.secure);
      setSmtpHost(res.smtp.host);
      setSmtpPort(String(res.smtp.port));
      setSmtpSecure(res.smtp.secure);
      setUsername(res.username);
      setNote(res.note ?? '');
      const origin = res.provider ?? (res.source === 'guess' ? 'estimacion por convencion' : res.source);
      props.onToast('success', 'Servidores detectados: ' + origin + '.');
    } catch (err) {
      props.onToast('error', err instanceof Error ? err.message : 'No se pudo autodetectar.');
    } finally {
      setBusy(undefined);
    }
  }

  /* Auto-detect as soon as the user finishes typing the address, so
   * "just the account" is genuinely enough. */
  function onEmailBlur() {
    if (imapHost === '' && smtpHost === '' && EMAIL_RE.test(email.trim())) {
      void detect();
    }
  }

  function overrides() {
    const user = username || email.trim();
    const payload: Parameters<typeof api.emailVerify>[0] = {};
    if (imapHost) {
      payload.imap = { host: imapHost, port: Number(imapPort), user, secure: imapSecure };
      if (password) payload.imap.pass = password;
    }
    if (smtpHost) {
      payload.smtp = { host: smtpHost, port: Number(smtpPort), user, secure: smtpSecure };
      if (password) payload.smtp.pass = password;
    }
    return payload;
  }

  async function test() {
    setBusy('test');
    try {
      const res = await api.emailVerify(overrides());
      const part = (label: string, r: { ok: boolean; error?: string }) =>
        label + ' ' + (r.ok ? 'OK' : 'fallo: ' + (r.error ?? 'error desconocido'));
      props.onToast(res.ok ? 'success' : 'error', part('IMAP', res.imap) + ' / ' + part('SMTP', res.smtp));
    } catch (err) {
      props.onToast('error', err instanceof Error ? err.message : 'No se pudo probar la conexion.');
    } finally {
      setBusy(undefined);
    }
  }

  async function save() {
    const addr = email.trim();
    if (!EMAIL_RE.test(addr)) {
      props.onToast('info', 'La direccion de correo no es valida.');
      return;
    }
    if (!imapHost || !smtpHost) {
      props.onToast('info', 'Faltan los servidores. Usa Detectar servidores o completalos a mano.');
      return;
    }
    const alreadyConfigured = Boolean(status?.imap.configured && status?.smtp.configured);
    if (!password && !alreadyConfigured) {
      props.onToast('info', 'Falta la contrasena (o App Password) de la cuenta.');
      return;
    }
    setBusy('save');
    try {
      const user = username || addr;
      const entries: Array<[string, string]> = [
        ['identity.from', addr],
        ['imap.host', imapHost],
        ['imap.port', imapPort],
        ['imap.user', user],
        ['imap.secure', String(imapSecure)],
        ['smtp.host', smtpHost],
        ['smtp.port', smtpPort],
        ['smtp.user', user],
        ['smtp.secure', String(smtpSecure)],
      ];
      if (name.trim()) entries.push(['identity.name', name.trim()]);
      if (password) {
        entries.push(['imap.pass', password], ['smtp.pass', password]);
      }
      for (const [key, value] of entries) {
        await api.vaultSet(key, value);
      }
      props.onToast('success', keySource === 'derived'
        ? 'Configuracion guardada en la boveda (cifrada con la clave por defecto de esta maquina).'
        : 'Configuracion guardada cifrada en la boveda.');
      props.onClose();
    } catch (err) {
      props.onToast('error', err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setBusy(undefined);
    }
  }

  function onDetect() { void detect(); }
  function onTest()   { void test(); }
  function onSave()   { void save(); }

  const flag = (configured: boolean | undefined) => configured ? 'configurado' : 'sin configurar';
  const fieldStyle: React.CSSProperties = { width: '100%' };
  const rowStyle:   React.CSSProperties = { display: 'flex', gap: 8, marginBottom: 12 };

  return (
    <div className="yuemail-modal" role="dialog" aria-label="Configuracion del correo" data-nac-id="yuemail.settings.dialog" data-nac-role="dialog">
      <div className="yuemail-modal-card" style={{ minWidth: 480 }}>
        <h2 style={{ marginTop: 0 }}>Configuracion del correo</h2>

        {status && (
          <p style={{ marginTop: 0, fontSize: 14, opacity: 0.75 }}>
            IMAP {flag(status.imap.configured)} - SMTP {flag(status.smtp.configured)} - Identidad {flag(status.identity.configured)}
          </p>
        )}

        {keySource === 'derived' && (
          <p style={{ fontSize: 13, opacity: 0.8 }} role="note" data-nac-id="yuemail.settings.vault-key-note">
            La boveda se cifra con una clave derivada de esta maquina (protege el archivo
            si se filtra solo, pero no contra alguien con acceso a esta computadora).
            Para una clave propia, defini la variable de entorno YUEMAIL_VAULT_PASS antes
            de iniciar Yuemail.
          </p>
        )}

        <p style={{ fontSize: 13, opacity: 0.7 }} role="note" data-nac-id="yuemail.settings.voice-hint">
          Por voz: deci "campo correo" (o nombre, contrasena, servidor imap, puerto smtp...),
          dicta el valor y "borrar campo" para corregir. Para SSL deci "campo ssl imap"
          y despues "si" o "no".
        </p>

        <label style={{ display: 'block', marginBottom: 12 }}>
          Tu nombre (remitente)
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={fieldStyle}
            data-nac-id="yuemail.settings.name"
            data-nac-role="textbox"
            data-nac-action="set_identity_name"
          />
        </label>

        <label style={{ display: 'block', marginBottom: 12 }}>
          Direccion de correo
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={onEmailBlur}
            placeholder="vos@ejemplo.com"
            style={fieldStyle}
            data-nac-id="yuemail.settings.email"
            data-nac-role="textbox"
            data-nac-action="set_account_email"
          />
        </label>

        <label style={{ display: 'block', marginBottom: 12 }}>
          Contrasena (o App Password)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={status?.smtp.configured ? 'dejala vacia para conservar la guardada' : ''}
            style={fieldStyle}
            data-nac-id="yuemail.settings.password"
            data-nac-role="textbox"
            data-nac-action="set_account_password"
          />
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button type="button" data-nac-id="yuemail.settings.btn-detect" data-nac-role="button" data-nac-action="autodetect_servers" onClick={onDetect} disabled={busy !== undefined}>
            {busy === 'detect' ? 'Detectando...' : 'Detectar servidores'}
          </button>
          <span style={{ fontSize: 13, opacity: 0.7 }}>Con solo la direccion, en la mayoria de los proveedores.</span>
        </div>

        {note && (
          <p style={{ fontSize: 13, fontStyle: 'italic', opacity: 0.85 }} role="note">{note}</p>
        )}

        <fieldset style={{ border: '1px solid rgba(0,0,0,0.15)', borderRadius: 6, marginBottom: 12 }}>
          <legend style={{ fontSize: 13 }}>Servidores (avanzado)</legend>
          <div style={rowStyle}>
            <label style={{ flex: 3 }}>
              Servidor IMAP (recibir)
              <input type="text" value={imapHost} onChange={(e) => setImapHost(e.target.value)} style={fieldStyle} data-nac-id="yuemail.settings.imap-host" data-nac-role="textbox" data-nac-action="set_imap_host" />
            </label>
            <label style={{ flex: 1 }}>
              Puerto
              <input type="text" value={imapPort} onChange={(e) => setImapPort(e.target.value)} style={fieldStyle} data-nac-id="yuemail.settings.imap-port" data-nac-role="textbox" data-nac-action="set_imap_port" />
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
              <input type="checkbox" checked={imapSecure} onChange={(e) => setImapSecure(e.target.checked)} data-nac-id="yuemail.settings.imap-ssl" data-nac-role="checkbox" data-nac-action="toggle_imap_ssl" />
              SSL
            </label>
          </div>
          <div style={rowStyle}>
            <label style={{ flex: 3 }}>
              Servidor SMTP (enviar)
              <input type="text" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} style={fieldStyle} data-nac-id="yuemail.settings.smtp-host" data-nac-role="textbox" data-nac-action="set_smtp_host" />
            </label>
            <label style={{ flex: 1 }}>
              Puerto
              <input type="text" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} style={fieldStyle} data-nac-id="yuemail.settings.smtp-port" data-nac-role="textbox" data-nac-action="set_smtp_port" />
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
              <input type="checkbox" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} data-nac-id="yuemail.settings.smtp-ssl" data-nac-role="checkbox" data-nac-action="toggle_smtp_ssl" />
              SSL
            </label>
          </div>
        </fieldset>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" data-nac-id="yuemail.settings.btn-test" data-nac-role="button" data-nac-action="test_connection" onClick={onTest} disabled={busy !== undefined}>
            {busy === 'test' ? 'Probando...' : 'Probar conexion'}
          </button>
          <button type="button" data-nac-id="yuemail.settings.btn-cancel" data-nac-role="button" data-nac-action="cancel_settings" onClick={props.onClose} disabled={busy === 'save'}>
            Cancelar
          </button>
          <button type="button" data-nac-id="yuemail.settings.btn-save" data-nac-role="button" data-nac-action="save_settings" onClick={onSave} disabled={busy !== undefined}>
            {busy === 'save' ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
