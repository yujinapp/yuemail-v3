/**
 * Web Speech API hook (F2).
 *
 * Provides a tiny imperative surface:
 *   const v = useVoice({ onCommand, onTranscript });
 *   v.start();
 *   v.stop();
 *   v.speak(text);
 *
 * Recognises Spanish utterances. Other browsers (no Web Speech) degrade
 * silently -- buttons still work, mic does not.
 *
 * ASCII-only.
 */
import { useEffect, useRef, useState } from 'react';
import { parseCommand, type VoiceCommand, type VoiceContext } from './commands.js';

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
  const Ctor   = pickRecognitionCtor();
  const supported = Ctor !== undefined;

  useEffect(() => {
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang           = 'es-AR';
    rec.interimResults = true;
    rec.continuous     = true;
    rec.onresult = (ev) => {
      const lastIdx = ev.results.length - 1;
      const result  = ev.results[lastIdx];
      if (!result) return;
      const transcript = result[0]?.transcript ?? '';
      const isFinal    = Boolean(result.isFinal);
      const current    = optsRef.current;
      if (transcript) current.onTranscript?.(transcript, isFinal);
      if (isFinal && current.onCommand) {
        const cmd = parseCommand(transcript, current.getContext?.() ?? 'global', { armed: current.getArmed?.() ?? false });
        current.onCommand(cmd);
      }
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
    };
  }, [Ctor]);

  function start() {
    if (!recRef.current) return;
    try { recRef.current.start(); setListening(true); } catch { /* already started */ }
  }

  function stop() {
    if (!recRef.current) return;
    try { recRef.current.stop(); } catch { /* ignore */ }
    setListening(false);
  }

  function speak(text: string) {
    if (typeof window === 'undefined') return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'es-AR';
    synth.speak(utter);
  }

  return { supported, listening, start, stop, speak };
}
