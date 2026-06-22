/**
 * Brain settings (v0.5.0) -- configure the voice assistant.
 *
 * Camino 1: the Brain reads what the person says and picks the action. This
 * panel chooses the provider + model and stores the provider API key in the
 * encrypted vault (slot brain.<provider>); the key is sent to the server and
 * never returned, exactly like the mail password. With the Brain off, or no
 * key, Yuemail still works via the fixed-phrase commands (camino 2).
 *
 * Accessible by keyboard + screen reader. The daily email actions keep full
 * voice parity; this one-time setup screen is reached from the topbar.
 *
 * ASCII-only.
 */
import * as React from 'react';
import { api, type BrainConfigPublic } from '../lib/api.js';

export interface BrainSettingsProps {
  onClose: () => void;
  onToast: (kind: 'info' | 'success' | 'error', text: string) => void;
}

interface ProviderModel { id: string; display_name: string }

/* Friendly labels; ids stay as the protocol value. */
const PROVIDER_LABELS: Record<string, string> = {
  google_ai: 'Google Gemini',
  anthropic: 'Anthropic Claude',
  openai:    'OpenAI',
  deepseek:  'DeepSeek',
  xai:       'xAI Grok',
  mistral:   'Mistral',
  qwen:      'Qwen (Alibaba)',
  zai:       'Z.ai / GLM',
  ollama:    'Ollama (local, sin clave)',
};

const KEY_HELP: Record<string, string> = {
  google_ai: 'Sacala en aistudio.google.com/apikey',
  anthropic: 'Sacala en console.anthropic.com/settings/keys',
  openai:    'Sacala en platform.openai.com/api-keys',
  deepseek:  'Sacala en platform.deepseek.com',
  xai:       'Sacala en console.x.ai',
  mistral:   'Sacala en console.mistral.ai',
  qwen:      'Sacala en el panel de DashScope',
  zai:       'Sacala en open.bigmodel.cn',
  ollama:    'No necesita clave: corre local (ollama serve).',
};

export function BrainSettings(props: BrainSettingsProps): React.ReactElement {
  const [enabled, setEnabled]   = React.useState(true);
  const [provider, setProvider] = React.useState('google_ai');
  const [model, setModel]       = React.useState('');
  const [providers, setProviders] = React.useState<string[]>([]);
  const [models, setModels]     = React.useState<ProviderModel[]>([]);
  const [modelSource, setModelSource] = React.useState<'live' | 'static'>('static');
  const [hasKey, setHasKey]     = React.useState(false);
  const [keyInput, setKeyInput] = React.useState('');
  const [busy, setBusy]         = React.useState<'load' | 'models' | 'save' | undefined>('load');

  const loadModels = React.useCallback(async (prov: string, current?: string) => {
    setBusy('models');
    try {
      const res = await api.brainModels(prov);
      setModels(res.models);
      setModelSource(res.source);
      /* Keep the configured model if it is still offered; else first. */
      const keep = current && res.models.some((m) => m.id === current) ? current : (res.models[0]?.id ?? '');
      setModel(keep);
    } catch {
      setModels([]);
    } finally {
      setBusy(undefined);
    }
  }, []);

  React.useEffect(() => {
    let alive = true;
    api.brainConfig().then(async (res) => {
      if (!alive) return;
      const cfg: BrainConfigPublic = res.config;
      setEnabled(cfg.enabled);
      setProvider(cfg.provider);
      setProviders(cfg.all_providers);
      setHasKey(res.has_key);
      await loadModels(cfg.provider, cfg.model);
    }).catch(() => {
      props.onToast('error', 'No se pudo leer la configuracion del asistente.');
      setBusy(undefined);
    });
    return () => { alive = false; };
  }, [loadModels, props]);

  function onProviderChange(next: string) {
    setProvider(next);
    setHasKey(false); /* unknown until the server reports for the new provider */
    setKeyInput('');
    void loadModels(next);
    /* Refresh has_key for the new provider without persisting yet. */
    api.brainConfig().catch(() => undefined);
  }

  async function save() {
    setBusy('save');
    try {
      if (keyInput.trim().length > 0) {
        await api.vaultSet('brain.' + provider, keyInput.trim());
      }
      const res = await api.brainConfigSet({ enabled, provider, model });
      setHasKey(res.has_key);
      setKeyInput('');
      const needsKey = provider !== 'ollama';
      if (enabled && needsKey && !res.has_key) {
        props.onToast('info', 'Asistente guardado, pero falta la clave de ' + (PROVIDER_LABELS[provider] ?? provider) + '. Sin clave usa los comandos fijos.');
      } else {
        props.onToast('success', 'Asistente de voz configurado.');
      }
      props.onClose();
    } catch (err) {
      props.onToast('error', err instanceof Error ? err.message : 'No se pudo guardar el asistente.');
    } finally {
      setBusy(undefined);
    }
  }

  const needsKey = provider !== 'ollama';
  const fieldStyle: React.CSSProperties = { width: '100%' };

  return (
    <div className="yuemail-modal" role="dialog" aria-label="Asistente de voz" data-nac-id="yuemail.voice.brain-dialog" data-nac-role="dialog">
      <div className="yuemail-modal-card" style={{ minWidth: 480 }}>
        <h2 style={{ marginTop: 0 }}>Asistente de voz (IA)</h2>

        <p style={{ marginTop: 0, fontSize: 14, opacity: 0.8 }}>
          Con el asistente encendido, podes pedir las cosas con tus palabras y la IA
          elige la accion. Si lo apagas (o falta la clave), Yuemail sigue funcionando
          con las frases fijas de siempre.
        </p>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            data-nac-id="yuemail.voice.brain-enabled"
            data-nac-role="checkbox"
            aria-label="Asistente de voz encendido"
          />
          Asistente de voz encendido (recomendado)
        </label>

        <label style={{ display: 'block', marginBottom: 12 }}>
          Proveedor de IA
          <select
            value={provider}
            onChange={(e) => onProviderChange(e.target.value)}
            style={fieldStyle}
            data-nac-id="yuemail.voice.brain-provider"
            data-nac-role="combobox"
            aria-label="Proveedor de IA"
          >
            {providers.map((p) => (
              <option key={p} value={p}>{PROVIDER_LABELS[p] ?? p}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: 12 }}>
          Modelo {modelSource === 'live' ? '(en vivo)' : '(lista local)'}
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={fieldStyle}
            disabled={busy === 'models' || models.length === 0}
            data-nac-id="yuemail.voice.brain-model"
            data-nac-role="combobox"
            aria-label="Modelo de IA"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>
        </label>

        {needsKey && (
          <label style={{ display: 'block', marginBottom: 8 }}>
            Clave de API {hasKey ? '(ya configurada -- dejala vacia para conservarla)' : ''}
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={hasKey ? 'clave guardada' : 'pega aca la clave'}
              style={fieldStyle}
              data-nac-id="yuemail.voice.brain-key"
              data-nac-role="textbox"
              aria-label="Clave de API del proveedor"
              autoComplete="off"
            />
          </label>
        )}
        <p style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }} role="note">
          {KEY_HELP[provider] ?? ''} La clave se guarda cifrada en tu maquina y nunca se muestra.
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            type="button"
            onClick={props.onClose}
            disabled={busy === 'save'}
            data-nac-id="yuemail.voice.brain-cancel"
            data-nac-role="button"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy === 'save' || busy === 'load'}
            data-nac-id="yuemail.voice.brain-save"
            data-nac-role="button"
          >
            {busy === 'save' ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
