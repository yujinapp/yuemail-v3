/**
 * Microphone capture for camino-1 hearing (v0.6.0).
 *
 * The browser's SpeechRecognition stays on as a free Voice Activity Detector
 * and as the camino-2 transcript. In parallel, this recorder keeps the raw
 * audio so that when an utterance finalises we can send THAT audio to Google
 * (camino 1) for a better transcript -- the real accessibility win for
 * atypical speech. On any failure here, the caller simply uses the browser
 * transcript: the mic is never the single point of failure.
 *
 * UtteranceRecorder buffers MediaRecorder chunks; takeUtterance() returns the
 * audio captured since the previous take and clears the buffer, so each
 * finalised utterance maps to its own recording window.
 *
 * ASCII-only.
 */

/** webm/Opus is what Chrome + Edge produce; the server maps it to Google's
 *  WEBM_OPUS encoding. We pick the first supported type at construction. */
const PREFERRED_MIME = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];

export interface CapturedUtterance {
  blob: Blob;
  /** Container the server should declare to Google. */
  format: 'webm' | 'ogg';
}

export function recorderSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window.MediaRecorder === 'function'
  );
}

function pickMime(): string | undefined {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') return undefined;
  const can = (window.MediaRecorder as unknown as { isTypeSupported?: (t: string) => boolean }).isTypeSupported;
  if (typeof can !== 'function') return undefined;
  for (const m of PREFERRED_MIME) if (can(m)) return m;
  return undefined;
}

export class UtteranceRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mime: string | undefined;

  /** Start capturing. Resolves false if the mic/recorder is unavailable or
   *  the user denies permission -- the caller then runs browser-only. */
  async start(): Promise<boolean> {
    if (!recorderSupported()) return false;
    if (this.recorder) return true; /* already running */
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mime = pickMime();
      this.recorder = this.mime
        ? new MediaRecorder(this.stream, { mimeType: this.mime })
        : new MediaRecorder(this.stream);
      this.chunks = [];
      this.recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) this.chunks.push(ev.data);
      };
      /* A small timeslice flushes chunks continuously so takeUtterance() has
       * data without waiting for stop(). */
      this.recorder.start(250);
      return true;
    } catch {
      this.cleanup();
      return false;
    }
  }

  /** Pull the audio captured since the previous take and clear the buffer.
   *  Returns undefined when nothing was captured (silence / not running). */
  takeUtterance(): CapturedUtterance | undefined {
    if (this.chunks.length === 0) return undefined;
    const taken = this.chunks;
    this.chunks = [];
    const type = this.mime ?? taken[0]?.type ?? 'audio/webm';
    const blob = new Blob(taken, { type });
    if (blob.size === 0) return undefined;
    const format: 'webm' | 'ogg' = type.includes('ogg') ? 'ogg' : 'webm';
    return { blob, format };
  }

  stop(): void {
    this.cleanup();
  }

  get running(): boolean {
    return this.recorder !== null;
  }

  private cleanup(): void {
    try { this.recorder?.stop(); } catch { /* ignore */ }
    try { this.stream?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    this.recorder = null;
    this.stream = null;
    this.chunks = [];
  }
}
