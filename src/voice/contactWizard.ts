/**
 * Guided "add a contact" voice wizard (PND-028).
 *
 * A person who lives on voice cannot be left at a dead end when they say
 * "enviar a Fulano" and Fulano is not in the address book. This is the
 * conversational state machine that captures a new contact one field at a
 * time -- FIRST the name, THEN the email (the "provider") -- with a spoken
 * read-back of the address before it is saved, because saving the wrong
 * address is the costliest failure for these users.
 *
 * The module is PURE (no React, no I/O): given a state and one spoken
 * utterance it returns the next state plus what to say. The App layer owns
 * the side effects (announce, persist the contact, open the send dialog).
 * Keeping it pure is what makes every branch unit-testable, like
 * commands.ts and contactMatch.ts.
 *
 * ASCII-only.
 */

import { extractSpokenEmail } from './commands.js';

export type ContactWizardStep = 'name' | 'email' | 'confirm';
/** Terminal outcomes -- the App clears the wizard when it sees one. */
export type ContactWizardOutcome = 'done' | 'cancelled';

export interface ContactWizardState {
  step: ContactWizardStep;
  /** Captured so far. Empty string until the step that fills it. */
  name: string;
  email: string;
}

export interface ContactWizardResult {
  /** Next state to hold (when still running) -- mutually exclusive with outcome. */
  state?: ContactWizardState;
  /** Set when the flow finished: 'done' carries `committed`, 'cancelled' aborts. */
  outcome?: ContactWizardOutcome;
  /** What to say to the user now (toast + aria announce). Never a credential. */
  prompt: string;
  /** Toast/announce severity hint. */
  kind: 'info' | 'success' | 'error';
  /** Present only when outcome === 'done': the contact ready to persist.
   *  The App announces the FINAL success only after the save returns ok
   *  (anti-hallucination: never claim "guardado" before it is). */
  committed?: { name: string; email: string };
}

/* Words that abort the flow at any step. Kept short + unambiguous; a real
 * recogniser returns these cleanly and none collides with a plausible name
 * or with the spoken email tokens (arroba / punto). */
const CANCEL_RE = /\b(?:cancelar|cancela|cancelo|olvidalo|olvidate|dejalo|dejemoslo|no importa|salir)\b/;
/* Confirmation at the read-back step. */
const CONFIRM_RE = /\b(?:confirmar|confirma|confirmo|guardar|guardalo|guarda|si|correcto|correcta|exacto|dale|de una|listo)\b/;
/* "the address is wrong, let me say it again" at the read-back step. */
const REDO_EMAIL_RE = /\b(?:corregir|corregi|correo|email|mail|direccion|de nuevo|otra vez|repetir|no)\b/;

/* Lowercase + drop accents for keyword matching. NFD splits an accented
 * letter into base + combining mark; every combining mark is above code
 * 127, so dropping non-ASCII bytes by char code strips the accent and keeps
 * the base ASCII letter -- and keeps THIS file ASCII-pure (SQ 3), unlike a
 * literal combining-mark regex. */
function strip(s: string): string {
  const d = s.normalize('NFD');
  let out = '';
  for (let i = 0; i < d.length; i++) {
    if (d.charCodeAt(i) <= 127) out += d.charAt(i);
  }
  return out.toLowerCase();
}

/** Tidy a spoken name into a stored value: drop a leading "se llama /
 *  el nombre es / nombre", collapse whitespace, trim stray punctuation. */
export function cleanContactName(raw: string): string {
  let s = raw.trim().replace(/\s+/g, ' ');
  s = s.replace(/^(?:se\s+llama|el\s+nombre\s+es|su\s+nombre\s+es|nombre|llamado|llamada)\b\s*/i, '');
  s = s.replace(/^[\s.,;:]+/, '').replace(/[\s.,;:]+$/, '');
  return s.trim();
}

/** Render an address for TTS so the read-back is unambiguous:
 *  "ana@gmail.com" -> "ana arroba gmail punto com". ASCII-only. */
export function spellEmailForSpeech(email: string): string {
  return email
    .replace(/@/g, ' arroba ')
    .replace(/\./g, ' punto ')
    .replace(/_/g, ' guion bajo ')
    .replace(/-/g, ' guion ')
    .replace(/\s+/g, ' ')
    .trim();
}

const EMAIL_HINT = 'por ejemplo: ana arroba gmail punto com';

/**
 * Begin the flow. With a name already known (the send flow heard it, or the
 * user said "agregar contacto Juan"), skip straight to asking for the email.
 * Otherwise ask for the name first.
 */
export function startContactWizard(opts: { name?: string } = {}): ContactWizardResult {
  const name = cleanContactName(opts.name ?? '');
  if (name.length > 0) {
    return {
      state: { step: 'email', name, email: '' },
      prompt: 'Vamos a agendar a ' + name + '. Decime su correo, ' + EMAIL_HINT + '.',
      kind: 'info',
    };
  }
  return {
    state: { step: 'name', name: '', email: '' },
    prompt: 'Decime el nombre del contacto.',
    kind: 'info',
  };
}

/**
 * Feed one spoken utterance to the running wizard. Returns the next state +
 * what to say, or a terminal outcome. The caller routes RAW speech here
 * while a wizard is active (the recogniser is short-circuited like dictation,
 * so name/email capture stays offline and instant), except the always-on
 * mic-safety commands which the App handles before this.
 */
export function advanceContactWizard(state: ContactWizardState, utterance: string): ContactWizardResult {
  const raw = utterance.trim();
  const n = strip(raw);

  if (CANCEL_RE.test(n)) {
    return { outcome: 'cancelled', prompt: 'Listo, no agende a nadie.', kind: 'info' };
  }

  switch (state.step) {
    case 'name': {
      const name = cleanContactName(raw);
      if (name.length === 0) {
        return {
          state,
          prompt: 'No te escuche el nombre. Decime el nombre del contacto, o deci "cancelar".',
          kind: 'error',
        };
      }
      return {
        state: { step: 'email', name, email: '' },
        prompt: 'Nombre: ' + name + '. Ahora decime su correo, ' + EMAIL_HINT + '.',
        kind: 'info',
      };
    }
    case 'email': {
      const email = extractSpokenEmail(raw);
      if (!email) {
        return {
          state,
          prompt: 'No entendi el correo. Deci la direccion despacio, ' + EMAIL_HINT + ', o deci "cancelar".',
          kind: 'error',
        };
      }
      return {
        state: { step: 'confirm', name: state.name, email },
        prompt: 'Voy a guardar a ' + state.name + ', correo: ' + spellEmailForSpeech(email)
          + '. Deci "confirmar" para guardar, "corregir" para repetir el correo, o "cancelar".',
        kind: 'info',
      };
    }
    case 'confirm': {
      if (CONFIRM_RE.test(n)) {
        return {
          outcome: 'done',
          committed: { name: state.name, email: state.email },
          /* In-progress phrasing on purpose: the App announces the final
           * "agende a X" only after the save actually succeeds. */
          prompt: 'Guardando a ' + state.name + '...',
          kind: 'info',
        };
      }
      if (REDO_EMAIL_RE.test(n)) {
        return {
          state: { step: 'email', name: state.name, email: '' },
          prompt: 'Decime el correo de nuevo, ' + EMAIL_HINT + '.',
          kind: 'info',
        };
      }
      return {
        state,
        prompt: 'No te entendi. Deci "confirmar" para guardar a ' + state.name
          + ', "corregir" para repetir el correo, o "cancelar".',
        kind: 'info',
      };
    }
  }
}
