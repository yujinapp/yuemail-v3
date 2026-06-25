/**
 * Voice Trainer (v0.11.0) -- the front for the kikoe add-on (@yujinapp/nac3-kikoe).
 *
 * The person enrolls a few recordings of each command IN THEIR OWN VOICE; the
 * app extracts a numeric fingerprint per recording (the audio is dropped on the
 * spot, only numbers are stored) and from then on recognises that command by
 * comparing the live voice against the person's own samples -- the accessibility
 * win for atypical speech.
 *
 * This view shows, per command:
 *   - confidence (how often the person let the local recognition stand),
 *   - effectiveness (how often local agreed with the cloud second opinion),
 *   - the number of enrolled recordings,
 * and lets the person train ONE command or ALL of them, test a command, or
 * forget it. The "perilla" up top picks WHEN the costly cloud runs.
 *
 * Reachable by voice ("abrir entrenador"); the training itself needs the mic,
 * so each step is spoken and guided. ASCII-only.
 */
import * as React from 'react';
import {
  KikoeClient,
  TRAINABLE_COMMANDS,
  type TrainableCommand,
} from '../voice/kikoe.js';
import type { CommandMetric, RouterMode } from '@yujinapp/nac3-kikoe';

export interface VoiceTrainerProps {
  kikoe: KikoeClient;
  onClose: () => void;
  onToast: (kind: 'info' | 'success' | 'error', text: string) => void;
  /** Yuemail's voice, so prompts are spoken for a person who cannot see. */
  speak: (text: string) => void;
}

const SAMPLES_PER_COMMAND = 3;
const SAMPLE_MS = 1600;

const MODE_LABELS: ReadonlyArray<{ mode: RouterMode; title: string; help: string }> = [
  { mode: 'on_doubt', title: 'Solo cuando dudo', help: 'Rapido y privado: usa la nube solo si la voz local no esta segura.' },
  { mode: 'learning', title: 'Modo aprendizaje (recomendado)', help: 'Escucha en paralelo a la nube un tiempo para afinar mas rapido, y despues afloja solo.' },
  { mode: 'always',   title: 'Siempre comparar', help: 'Mide siempre contra la nube. Maxima precision de las metricas, menos privado.' },
];

function pct(x: number): string {
  return Math.round(x * 100) + '%';
}

function pickMime(): string | undefined {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  const can = (window.MediaRecorder as unknown as { isTypeSupported?: (t: string) => boolean })?.isTypeSupported;
  if (typeof can !== 'function') return undefined;
  for (const t of types) if (can(t)) return t;
  return undefined;
}

function recorderSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window.MediaRecorder === 'function'
  );
}

export function VoiceTrainer(props: VoiceTrainerProps): React.ReactElement {
  const { kikoe } = props;
  const [mode, setMode] = React.useState<RouterMode>(kikoe.getMode());
  const [metrics, setMetrics] = React.useState<CommandMetric[]>([]);
  const [busy, setBusy] = React.useState(true);
  /* Live capture status shown to the person + spoken. */
  const [activePhrase, setActivePhrase] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string>('');
  const streamRef = React.useRef<MediaStream | null>(null);
  const cancelRef = React.useRef(false);

  const metricByCmd = React.useMemo(() => {
    const m = new Map<string, CommandMetric>();
    for (const row of metrics) m.set(row.command, row);
    return m;
  }, [metrics]);

  const refresh = React.useCallback(async () => {
    await kikoe.refresh();
    setMode(kikoe.getMode());
    setMetrics(kikoe.getMetrics());
  }, [kikoe]);

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      await refresh();
      if (alive) setBusy(false);
    })();
    return () => {
      alive = false;
      cancelRef.current = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopStream() {
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    streamRef.current = null;
  }

  async function ensureStream(): Promise<MediaStream | null> {
    if (streamRef.current) return streamRef.current;
    if (!recorderSupported()) {
      props.onToast('error', 'Este navegador no permite grabar audio para entrenar.');
      return null;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = s;
      return s;
    } catch {
      props.onToast('error', 'No pude acceder al microfono. Revisa el permiso.');
      return null;
    }
  }

  function captureOneSample(stream: MediaStream): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const mime = pickMime();
      let rec: MediaRecorder;
      try {
        rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('no recorder'));
        return;
      }
      const chunks: Blob[] = [];
      rec.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
      rec.onerror = () => reject(new Error('recorder error'));
      rec.start();
      setTimeout(() => { try { rec.stop(); } catch { /* ignore */ } }, SAMPLE_MS);
    });
  }

  /* Pause between the spoken prompt and the actual capture, so the prompt is
   * not recorded as part of the sample. */
  function wait(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function trainOne(cmd: TrainableCommand): Promise<boolean> {
    const stream = await ensureStream();
    if (!stream) return false;
    setActivePhrase(cmd.phrase);
    const blobs: Blob[] = [];
    for (let i = 1; i <= SAMPLES_PER_COMMAND; i++) {
      if (cancelRef.current) return false;
      setStatus('Preparate... di "' + cmd.phrase + '" (' + i + ' de ' + SAMPLES_PER_COMMAND + ')');
      props.speak('Deci: ' + cmd.phrase);
      await wait(1100);
      if (cancelRef.current) return false;
      setStatus('Grabando "' + cmd.phrase + '" (' + i + ' de ' + SAMPLES_PER_COMMAND + ')...');
      try {
        const blob = await captureOneSample(stream);
        if (blob.size > 0) blobs.push(blob);
      } catch {
        props.onToast('error', 'Fallo la grabacion. Proba de nuevo.');
        return false;
      }
      await wait(300);
    }
    if (blobs.length === 0) {
      props.onToast('error', 'No capte audio para "' + cmd.label + '".');
      return false;
    }
    setStatus('Guardando "' + cmd.label + '"...');
    try {
      await kikoe.enroll(cmd.phrase, blobs);
      return true;
    } catch (err) {
      props.onToast('error', err instanceof Error ? err.message : 'No se pudo guardar el entrenamiento.');
      return false;
    }
  }

  async function onTrainOne(cmd: TrainableCommand) {
    if (busy) return;
    cancelRef.current = false;
    setBusy(true);
    const ok = await trainOne(cmd);
    setActivePhrase(null);
    setStatus('');
    stopStream();
    if (ok) {
      await refresh();
      props.onToast('success', 'Entrene "' + cmd.label + '".');
      props.speak('Listo, entrene ' + cmd.label + '.');
    }
    setBusy(false);
  }

  async function onTrainAll() {
    if (busy) return;
    cancelRef.current = false;
    setBusy(true);
    props.speak('Vamos a entrenar todos los comandos. Repeti cada frase cuando te la pida.');
    let done = 0;
    for (const cmd of TRAINABLE_COMMANDS) {
      if (cancelRef.current) break;
      const ok = await trainOne(cmd);
      if (ok) done++;
    }
    setActivePhrase(null);
    setStatus('');
    stopStream();
    await refresh();
    props.onToast(done > 0 ? 'success' : 'info', 'Entrenamiento completo: ' + done + ' de ' + TRAINABLE_COMMANDS.length + ' comandos.');
    props.speak('Termine. Entrene ' + done + ' comandos.');
    setBusy(false);
  }

  /* Test recognition for one command: record once, recognise locally, and ask
   * the person to confirm. The confirmation is the honest CONFIDENCE signal
   * (the person says whether the local recognition was right). */
  async function onTest(cmd: TrainableCommand) {
    if (busy) return;
    const stream = await ensureStream();
    if (!stream) return;
    setBusy(true);
    setActivePhrase(cmd.phrase);
    setStatus('Probando... di "' + cmd.phrase + '"');
    props.speak('Deci: ' + cmd.phrase);
    await wait(1100);
    let blob: Blob | undefined;
    try { blob = await captureOneSample(stream); } catch { /* handled below */ }
    setActivePhrase(null);
    setStatus('');
    stopStream();
    if (!blob || blob.size === 0) {
      props.onToast('error', 'No capte audio.');
      setBusy(false);
      return;
    }
    const result = await kikoe.recognize(blob);
    setBusy(false);
    if (!result || !result.command) {
      props.onToast('info', 'No reconoci ningun comando. Quizas falta entrenar mas "' + cmd.label + '".');
      props.speak('No lo reconoci. Proba entrenarlo un poco mas.');
      await kikoe.observeOutcome(cmd.phrase, false);
      await refresh();
      return;
    }
    const matchedLabel = TRAINABLE_COMMANDS.find((c) => c.phrase === result.command)?.label ?? result.command;
    const right = result.command === cmd.phrase;
    /* Person-sourced confidence: was the local recognition correct? */
    await kikoe.observeOutcome(result.command, right);
    await refresh();
    if (right) {
      props.onToast('success', 'Bien: reconoci "' + cmd.label + '".');
      props.speak('Lo reconoci bien.');
    } else {
      props.onToast('info', 'Escuche "' + matchedLabel + '" en lugar de "' + cmd.label + '". Conviene entrenar mas.');
      props.speak('Escuche otro comando. Conviene entrenar mas.');
    }
  }

  async function onForget(cmd: TrainableCommand) {
    if (busy) return;
    setBusy(true);
    try {
      await kikoe.forget(cmd.phrase);
      await refresh();
      props.onToast('info', 'Borre el entrenamiento de "' + cmd.label + '".');
    } catch (err) {
      props.onToast('error', err instanceof Error ? err.message : 'No se pudo borrar.');
    }
    setBusy(false);
  }

  async function onChangeMode(next: RouterMode) {
    setMode(next);
    try {
      await kikoe.setMode(next);
      props.onToast('info', 'Modo de la perilla: ' + (MODE_LABELS.find((m) => m.mode === next)?.title ?? next) + '.');
    } catch {
      props.onToast('error', 'No se pudo cambiar el modo.');
    }
  }

  function onCancelCapture() {
    cancelRef.current = true;
    setStatus('Cancelando...');
  }

  const totalTrained = metrics.filter((m) => m.samples > 0).length;

  return (
    <div className="yuemail-modal" role="dialog" aria-label="Entrenador de voz" data-nac-id="yuemail.voice.trainer-dialog" data-nac-role="dialog">
      <div className="yuemail-modal-card yuemail-trainer-card">
        <h2 style={{ marginTop: 0 }}>Entrenador de voz</h2>
        <p style={{ marginTop: 0, fontSize: 14, opacity: 0.8 }}>
          Entrena los comandos con tu propia voz. La app aprende como suenan EN
          TU VOZ y los reconoce comparandolos con tus grabaciones -- ideal cuando
          el reconocedor comun no te entiende. Se guardan solo numeros, nunca el
          audio. Tenes {totalTrained} de {TRAINABLE_COMMANDS.length} comandos entrenados.
        </p>

        <fieldset className="yuemail-trainer-perilla" data-nac-id="yuemail.voice.trainer-mode">
          <legend style={{ fontWeight: 600, padding: '0 6px' }}>Cuando usar la nube</legend>
          {MODE_LABELS.map((m) => (
            <label key={m.mode} style={{ display: 'block', marginBottom: 6 }}>
              <input
                type="radio"
                name="kikoe-mode"
                checked={mode === m.mode}
                onChange={() => void onChangeMode(m.mode)}
                disabled={busy}
                data-nac-id={'yuemail.voice.trainer-mode-' + m.mode.replace('_', '-')}
                data-nac-role="radio"
                data-nac-action={'set_trainer_mode_' + m.mode}
                aria-label={m.title}
              />{' '}
              <strong>{m.title}</strong>
              <div style={{ fontSize: 12, opacity: 0.7, marginLeft: 22 }}>{m.help}</div>
            </label>
          ))}
        </fieldset>

        {activePhrase && (
          <div className="yuemail-trainer-capture" role="status" aria-live="assertive" data-nac-id="yuemail.voice.trainer-capture">
            <span className="yuemail-trainer-rec-dot" aria-hidden="true" />
            <span>{status || ('Escuchando "' + activePhrase + '"...')}</span>
            <button
              type="button"
              onClick={onCancelCapture}
              data-nac-id="yuemail.voice.trainer-cancel-capture"
              data-nac-role="button"
              data-nac-action="cancel_trainer_capture"
            >
              Cancelar
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
          <button
            type="button"
            onClick={() => void onTrainAll()}
            disabled={busy}
            data-nac-id="yuemail.voice.trainer-train-all"
            data-nac-role="button"
            data-nac-action="train_all_commands"
          >
            Entrenar todo
          </button>
        </div>

        <div className="yuemail-trainer-table" role="table" aria-label="Comandos y sus metricas">
          <div className="yuemail-trainer-row yuemail-trainer-head" role="row">
            <span role="columnheader">Comando</span>
            <span role="columnheader">Grabaciones</span>
            <span role="columnheader">Confianza</span>
            <span role="columnheader">Efectividad</span>
            <span role="columnheader">Acciones</span>
          </div>
          {TRAINABLE_COMMANDS.map((cmd) => {
            const m = metricByCmd.get(cmd.phrase);
            const samples = m?.samples ?? 0;
            return (
              <div className="yuemail-trainer-row" role="row" key={cmd.phrase}>
                <span role="cell"><strong>{cmd.label}</strong><div style={{ fontSize: 11, opacity: 0.6 }}>"{cmd.phrase}"</div></span>
                <span role="cell">{samples}</span>
                <span role="cell">{m && m.feedbackCount > 0 ? pct(m.confidence) : '--'}<div style={{ fontSize: 10, opacity: 0.5 }}>{m && m.feedbackCount > 0 ? m.feedbackCount + ' usos' : 'sin datos'}</div></span>
                <span role="cell">{m && m.measurementCount > 0 ? pct(m.effectiveness) : '--'}<div style={{ fontSize: 10, opacity: 0.5 }}>{m && m.measurementCount > 0 ? m.measurementCount + ' vs nube' : 'sin datos'}</div></span>
                <span role="cell" className="yuemail-trainer-actions">
                  <button type="button" onClick={() => void onTrainOne(cmd)} disabled={busy} data-nac-role="button" data-nac-action="train_one_command">
                    Entrenar
                  </button>
                  <button type="button" onClick={() => void onTest(cmd)} disabled={busy || samples === 0} data-nac-role="button" data-nac-action="test_one_command">
                    Probar
                  </button>
                  <button type="button" onClick={() => void onForget(cmd)} disabled={busy || samples === 0} data-nac-role="button" data-nac-action="forget_one_command">
                    Borrar
                  </button>
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            type="button"
            onClick={() => { cancelRef.current = true; stopStream(); props.onClose(); }}
            data-nac-id="yuemail.voice.trainer-close"
            data-nac-role="button"
            data-nac-action="close_trainer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
