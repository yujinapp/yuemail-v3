/**
 * Voice settings (v0.6.0) -- configure how Yuemail HEARS and SPEAKS.
 *
 * Camino 1: Google Cloud powers both the ear (Speech-to-Text) and the voice
 * (Text-to-Speech) -- a more accurate ear for atypical speech and a clearer
 * neural voice. The single Google key is stored in the encrypted vault (slot
 * speech.google); it is sent to the server and never returned, exactly like
 * the mail password. With voice off, or no key, Yuemail falls back to the
 * browser's own listening + speaking (camino 2), so the app always works.
 *
 * Accessible by keyboard + screen reader. Reached from the topbar; the daily
 * email actions keep full voice parity.
 *
 * ASCII-only.
 */
import * as React from 'react';
import {
  getVoiceConfig, setVoiceConfig, serverSpeak, playAudioBlob,
  type VoiceConfigPublic,
} from '../voice/serverVoice.js';
import { api } from '../lib/api.js';

const SPEECH_VAULT_SLOT = 'speech.google';

export interface VoiceSettingsProps {
  onClose: () => void;
  onToast: (kind: 'info' | 'success' | 'error', text: string) => void;
}

/* Friendly labels; the BCP-47 code stays the protocol value. */
const LANGUAGE_LABELS: Array<{ code: string; label: string }> = [
  { code: 'es-AR', label: 'Espanol (Argentina)' },
  { code: 'es-US', label: 'Espanol (EE. UU. / neutro)' },
  { code: 'es-ES', label: 'Espanol (Espana)' },
  { code: 'es-MX', label: 'Espanol (Mexico)' },
  { code: 'en-US', label: 'Ingles (EE. UU.)' },
  { code: 'pt-BR', label: 'Portugues (Brasil)' },
];

export function VoiceSettings(props: VoiceSettingsProps): React.ReactElement {
  const [enabled, setEnabled]   = React.useState(true);
  const [language, setLanguage] = React.useState('es-AR');
  const [voice, setVoice]       = React.useState('');
  const [speed, setSpeed]       = React.useState(1.0);
  const [hasKey, setHasKey]     = React.useState(false);
  const [keyInput, setKeyInput] = React.useState('');
  const [busy, setBusy]         = React.useState<'load' | 'save' | 'test' | undefined>('load');

  React.useEffect(() => {
    let alive = true;
    getVoiceConfig().then((res) => {
      if (!alive) return;
      const cfg: VoiceConfigPublic = res.config;
      setEnabled(cfg.enabled);
      setLanguage(cfg.language);
      setVoice(cfg.voice);
      setSpeed(cfg.speed);
      setHasKey(res.has_key);
      setBusy(undefined);
    }).catch(() => {
      props.onToast('error', 'No se pudo leer la configuracion de voz.');
      setBusy(undefined);
    });
    return () => { alive = false; };
  }, [props]);

  async function save() {
    setBusy('save');
    try {
      if (keyInput.trim().length > 0) {
        await api.vaultSet(SPEECH_VAULT_SLOT, keyInput.trim());
      }
      const res = await setVoiceConfig({ enabled, language, voice: voice.trim(), speed });
      setHasKey(res.has_key);
      setKeyInput('');
      if (enabled && !res.has_key) {
        props.onToast('info', 'Voz guardada, pero falta la clave de Google. Sin clave, Yuemail escucha y habla con el navegador.');
      } else {
        props.onToast('success', 'Voz configurada.');
      }
      props.onClose();
    } catch (err) {
      props.onToast('error', err instanceof Error ? err.message : 'No se pudo guardar la voz.');
    } finally {
      setBusy(undefined);
    }
  }

  async function testVoice() {
    setBusy('test');
    try {
      /* Persist the key first so the server can use it for the test. */
      if (keyInput.trim().length > 0) {
        await api.vaultSet(SPEECH_VAULT_SLOT, keyInput.trim());
        setHasKey(true);
        setKeyInput('');
      }
      const r = await serverSpeak('Hola, soy Yuemail. Asi suena mi voz.', { language, voice: voice.trim() || undefined, speed });
      if (r.ok && (await playAudioBlob(r.audio))) {
        props.onToast('success', 'Voz de Google reproducida.');
      } else {
        props.onToast('info', 'No se pudo usar la voz de Google ahora; revisa la clave. Yuemail seguira con la voz del navegador.');
      }
    } catch (err) {
      props.onToast('error', err instanceof Error ? err.message : 'No se pudo probar la voz.');
    } finally {
      setBusy(undefined);
    }
  }

  const fieldStyle: React.CSSProperties = { width: '100%' };

  return (
    <div className="yuemail-modal" role="dialog" aria-label="Voz de Yuemail" data-nac-id="yuemail.voice.voice-dialog" data-nac-role="dialog">
      <div className="yuemail-modal-card" style={{ minWidth: 480 }}>
        <h2 style={{ marginTop: 0 }}>Voz (escuchar y hablar)</h2>

        <p style={{ marginTop: 0, fontSize: 14, opacity: 0.8 }}>
          Con la voz de Google encendida, Yuemail entiende mejor lo que decis y te
          responde con una voz mas clara. Si la apagas (o falta la clave), Yuemail
          escucha y habla con el navegador, como siempre. La clave se guarda cifrada
          en tu maquina y nunca se muestra.
        </p>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            data-nac-id="yuemail.voice.voice-enabled"
            data-nac-role="checkbox"
            aria-label="Voz de Google encendida"
          />
          Voz de Google encendida (recomendado)
        </label>

        <label style={{ display: 'block', marginBottom: 12 }}>
          Idioma
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={fieldStyle}
            data-nac-id="yuemail.voice.voice-language"
            data-nac-role="combobox"
            aria-label="Idioma de la voz"
          >
            {LANGUAGE_LABELS.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: 12 }}>
          Velocidad al hablar ({speed.toFixed(2)}x)
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            style={fieldStyle}
            data-nac-id="yuemail.voice.voice-speed"
            data-nac-role="slider"
            aria-label="Velocidad de la voz"
          />
        </label>

        <label style={{ display: 'block', marginBottom: 8 }}>
          Clave de Google {hasKey ? '(ya configurada -- dejala vacia para conservarla)' : ''}
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={hasKey ? 'clave guardada' : 'pega aca la clave'}
            style={fieldStyle}
            data-nac-id="yuemail.voice.voice-key"
            data-nac-role="textbox"
            aria-label="Clave de Google para voz"
            autoComplete="off"
          />
        </label>
        <p style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }} role="note">
          Una sola clave de Google sirve para escuchar y hablar. Habilita Speech-to-Text
          y Text-to-Speech, y quita las restricciones de sitio web (la usa el servidor).
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 16 }}>
          <button
            type="button"
            onClick={() => void testVoice()}
            disabled={busy === 'save' || busy === 'load' || busy === 'test'}
            data-nac-id="yuemail.voice.voice-test"
            data-nac-role="button"
            data-nac-action="test_voice"
          >
            {busy === 'test' ? 'Probando...' : 'Probar voz'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={props.onClose}
              disabled={busy === 'save'}
              data-nac-id="yuemail.voice.voice-cancel"
              data-nac-role="button"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy === 'save' || busy === 'load'}
              data-nac-id="yuemail.voice.voice-save"
              data-nac-role="button"
            >
              {busy === 'save' ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
