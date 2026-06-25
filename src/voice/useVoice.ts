/**
 * Voice hook (F2, extended to camino 1 in v0.6.0).
 *
 * Imperative surface, unchanged for callers:
 *   const v = useVoice({ onCommand, onTranscript });
 *   v.start(); v.stop(); v.speak(text);
 *
 * HEARING. The browser's SpeechRecognition stays on as a free Voice Activity
 * Detector and as the camino-2 transcript. When camino 1 (Google) is enabled
 * and keyed, an UtteranceRecorder captures the audio in parallel; on each
 * finalised utterance we send that audio to Google and prefer its transcript
 * -- the accessibility win for atypical speech -- falling back to the browser
 * transcript on any miss.
 *
 * SPEAKING. speak() tries Google's neural voice first (clearer than the
 * robotic system voice) and falls back to the browser's speechSynthesis.
 *
 * A person who depends on this app is never left without it: every Google
 * path degrades to the browser, and a browser with no Web Speech at all still
 * leaves the buttons working.
 *
 * ASCII-only.
 */
import { useEffect, useRef, useState } from 'react';
import { parseCommand, type VoiceCommand, type VoiceContext } from './commands.js';
import { UtteranceRecorder } from './audioCapture.js';
import { voiceReady, serverTranscribe, serverSpeak, playAudioBlob } from './serverVoice.js';
import { diagLog } from './diagnostics.js';

const LANG = 'es-AR';

type Ctor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang:            string;
  interimResults:  boolean;
  continuous:      boolean;
  onresult:        ((ev: { results: { length: number; [i: number]: { 0: { transcript: string }; isFinal?: boolean } } }) => void) | null;
  onerror:         ((ev: { error?: string }) => void) | null;
  onend:           (() => void) | null;
  start:           () => void;
  stop:            () => void;
}

function pickRecognitionCtor(): Ctor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export interface UseVoiceOpts {
  onCommand?:    (cmd: VoiceCommand) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  /**
   * Reports which UI context is active (modal open?) at the moment the
   * utterance finalises, so the parser can route contextual commands.
   * Defaults to 'global'.
   */
  getContext?:   () => VoiceContext;
  /**
   * Reports whether a dialog field is armed for dictation right now,
   * so the parser can give free speech precedence over contextual
   * verbs (see ParseOpts.armed). Defaults to false.
   */
  getArmed?:     () => boolean;
  /**
   * Camino 1 (v0.5.0): async resolver that lets the server-side Brain
   * classify the utterance first, falling back to the fixed-phrase matcher
   * on any miss. When omitted, the synchronous matcher is used directly
   * (the pre-Brain behaviour). It never throws.
   */
  resolveCommand?: (raw: string, context: VoiceContext, opts: { armed: boolean }) => Promise<VoiceCommand>;
  /**
   * Local lane (v0.11.0 -- the kikoe voice trainer add-on). When the person
   * has enrolled their own command samples, each captured utterance is first
   * matched LOCALLY against those samples. A confident local hit becomes the
   * transcript directly (offline, instant) and can skip the cloud entirely;
   * otherwise the cloud path runs as usual. Entirely OPTIONAL and gated: when
   * absent or enabled() is false, hearing behaves exactly as before -- the
   * person who never trains is unaffected.
   */
  localLane?: LocalLane;
}

/** Local recognition lane contract (the host wires kikoe behind it). */
export interface LocalLaneResult {
  command:    string | null;
  accepted:   boolean;
  preferLocal: boolean;
  runCloud:   boolean;
  confident:  boolean;
}
export interface LocalLane {
  /** True only when there is something enrolled to match against. */
  enabled:   () => boolean;
  /** Recognise one captured utterance locally; null = defer to the cloud. */
  recognize: (blob: Blob) => Promise<LocalLaneResult | null>;
  /** Record a local-vs-cloud measurement (the effectiveness metric). */
  observe?:  (info: { localCommand: string | null; cloudText: string }) => void;
  /** A confident local hit was actually taken as the transcript (the host uses
   *  this for the confidence metric: accepted unless the person then cancels). */
  onUsed?:   (command: string) => void;
}

export interface VoiceHandle {
  supported: boolean;
  listening: boolean;
  start:     () => void;
  stop:      () => void;
  speak:     (text: string) => void;
}

export function useVoice(opts: UseVoiceOpts = {}): VoiceHandle {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  /* Callbacks live in a ref so the recognition instance survives
   * re-renders. Depending on opts.* would tear down + recreate (and
   * stop) the recognizer on every state change of the caller -- the mic
   * died as soon as a toast or a modal re-rendered the app. */
  const optsRef = useRef(opts);
  optsRef.current = opts;
  /* Camino-1 state: is Google voice enabled+keyed, and the parallel
   * audio recorder while listening. */
  const serverReadyRef = useRef(false);
  const recorderRef = useRef<UtteranceRecorder | null>(null);
  const Ctor   = pickRecognitionCtor();
  const supported = Ctor !== undefined;

  /* Probe camino 1 once on mount. A failure leaves serverReadyRef false, so
   * everything runs browser-only -- the safety net. */
  useEffect(() => {
    let alive = true;
    void voiceReady().then((ready) => { if (alive) serverReadyRef.current = ready; });
    return () => { alive = false; };
  }, []);

  async function finaliseUtterance(browserText: string, current: UseVoiceOpts): Promise<void> {
    let text = browserText;
    /* Diagnostic tracer (PND-019): record what each ear heard so a real test
     * run reveals the exact transcript Google returned vs. the browser's. */
    let googleText: string | undefined;
    let usedSource: 'google' | 'browser' | 'none' | 'local' = browserText ? 'browser' : 'none';
    let transcribeOk = false;

    /* Capture the utterance audio ONCE; both the local lane (kikoe) and the
     * Google lane consume the same recording window. */
    let utt: ReturnType<UtteranceRecorder['takeUtterance']> | undefined;
    const rec = recorderRef.current;
    if (rec && rec.running) { try { utt = rec.takeUtterance(); } catch { utt = undefined; } }

    /* Local lane (kikoe v0.11.0): match the person's own enrolled samples
     * first. A confident hit becomes the transcript directly. When nothing is
     * enrolled, lane.enabled() is false and this whole block is skipped, so
     * hearing is byte-for-byte the pre-trainer behaviour. */
    let local: LocalLaneResult | null = null;
    const lane = current.localLane;
    if (lane?.enabled() && utt) {
      try { local = await lane.recognize(utt.blob); } catch { local = null; }
    }
    const useLocalNow = !!(local && local.preferLocal && local.accepted && local.command);
    const runCloud = !useLocalNow || !!(local && local.runCloud);

    /* Cloud lane (Google): runs unless the local lane confidently took over,
     * or the router asked to also measure (shadow). Any failure keeps the
     * browser/local text -- the person is never left without a transcript. */
    try {
      if (serverReadyRef.current && utt && runCloud) {
        const r = await serverTranscribe(utt.blob, utt.format, LANG);
        transcribeOk = r.ok;
        if (r.ok) googleText = r.text;
        if (r.ok && r.text.trim().length > 0 && !useLocalNow) { text = r.text; usedSource = 'google'; }
      }
    } catch { /* keep browser text */ }

    if (useLocalNow && local && local.command) {
      text = local.command;
      usedSource = 'local';
      try { lane?.onUsed?.(local.command); } catch { /* best-effort */ }
    }

    /* Effectiveness measurement: when a local candidate AND a cloud transcript
     * both exist, let the lane record whether they agreed. */
    if (local && local.command && googleText !== undefined) {
      try { lane?.observe?.({ localCommand: local.command, cloudText: googleText }); } catch { /* best-effort */ }
    }

    const traceContext = current.getContext?.() ?? 'global';
    diagLog('hear', {
      interim: false,
      browserText,
      googleText,
      usedSource,
      localCommand: local?.command ?? undefined,
      localConfident: local?.confident,
      serverReady: serverReadyRef.current,
      transcribeOk,
      context: traceContext,
      armedField: current.getArmed?.() ? 'armed' : undefined,
    });

    if (text) current.onTranscript?.(text, true);
    if (!current.onCommand) return;
    const context = current.getContext?.() ?? 'global';
    const armed   = current.getArmed?.() ?? false;
    const onCommand = current.onCommand;
    if (current.resolveCommand) {
      try { onCommand(await current.resolveCommand(text, context, { armed })); }
      catch { onCommand(parseCommand(text, context, { armed })); }
    } else {
      onCommand(parseCommand(text, context, { armed }));
    }
  }

  useEffect(() => {
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang           = LANG;
    rec.interimResults = true;
    rec.continuous     = true;
    rec.onresult = (ev) => {
      const lastIdx = ev.results.length - 1;
      const result  = ev.results[lastIdx];
      if (!result) return;
      const browserText = result[0]?.transcript ?? '';
      const isFinal     = Boolean(result.isFinal);
      const current     = optsRef.current;
      if (!isFinal) {
        if (browserText) {
          current.onTranscript?.(browserText, false);
          diagLog('hear', { interim: true, browserText, context: current.getContext?.() ?? 'global' });
        }
        return;
      }
      /* Final: prefer Google's transcript of the captured audio (camino 1),
       * else the browser's (camino 2). finaliseUtterance never throws. */
      void finaliseUtterance(browserText, current);
    };
    rec.onerror = () => {
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
    };
    recRef.current = rec;
    return () => {
      try { rec.stop(); } catch { /* ignore */ }
      recRef.current = null;
      recorderRef.current?.stop();
      recorderRef.current = null;
    };
  }, [Ctor]);

  function start() {
    if (!recRef.current) return;
    try { recRef.current.start(); setListening(true); } catch { /* already started */ }
    /* Camino 1: start capturing audio for Google in parallel. Fire-and-
     * forget; if the mic/recorder is unavailable or denied we drop the
     * recorder and run browser-only. */
    if (serverReadyRef.current && !recorderRef.current) {
      const recorder = new UtteranceRecorder();
      recorderRef.current = recorder;
      void recorder.start().then((started) => {
        if (!started && recorderRef.current === recorder) recorderRef.current = null;
      });
    }
  }

  function stop() {
    if (recRef.current) { try { recRef.current.stop(); } catch { /* ignore */ } }
    setListening(false);
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
  }

  function browserSpeak(text: string) {
    if (typeof window === 'undefined') return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = LANG;
    synth.speak(utter);
  }

  function speak(text: string) {
    const clean = (text ?? '').trim();
    if (clean.length === 0) return;
    /* Camino 1: Google neural voice. On any miss, browser speechSynthesis. */
    if (serverReadyRef.current) {
      void serverSpeak(clean, { language: LANG })
        .then(async (r) => {
          if (r.ok && (await playAudioBlob(r.audio))) return;
          browserSpeak(clean);
        })
        .catch(() => browserSpeak(clean));
      return;
    }
    browserSpeak(clean);
  }

  return { supported, listening, start, stop, speak };
}
