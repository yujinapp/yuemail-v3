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
import { parseCommand, type VoiceCommand } from './commands.js';

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
      if (transcript) opts.onTranscript?.(transcript, isFinal);
      if (isFinal && opts.onCommand) {
        const cmd = parseCommand(transcript);
        opts.onCommand(cmd);
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
  }, [Ctor, opts.onCommand, opts.onTranscript]);

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
