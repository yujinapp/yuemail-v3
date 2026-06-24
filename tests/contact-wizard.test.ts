/**
 * Guided add-a-contact voice wizard (PND-028).
 *
 * Covers the pure state machine (name -> email -> confirm -> save), the
 * spoken-email read-back, the cancel/redo branches, and the AGREGAR_CONTACTO
 * command parsing (incl. that it does not steal "abrir contactos").
 *
 * ASCII-only.
 */
import { describe, it, expect } from 'vitest';
import {
  startContactWizard,
  advanceContactWizard,
  cleanContactName,
  spellEmailForSpeech,
  type ContactWizardState,
} from '../src/voice/contactWizard.js';
import { parseCommand } from '../src/voice/commands.js';

describe('cleanContactName', () => {
  it('collapses whitespace and trims punctuation', () => {
    expect(cleanContactName('  Juan   Perez . ')).toBe('Juan Perez');
  });
  it('drops a leading "se llama / el nombre es"', () => {
    expect(cleanContactName('se llama Ana Gomez')).toBe('Ana Gomez');
    expect(cleanContactName('el nombre es Pedro')).toBe('Pedro');
  });
  it('keeps casing (names are not lowercased)', () => {
    expect(cleanContactName('Maria Jose')).toBe('Maria Jose');
  });
});

describe('spellEmailForSpeech', () => {
  it('renders an address in spoken form for a clear read-back', () => {
    expect(spellEmailForSpeech('ana@gmail.com')).toBe('ana arroba gmail punto com');
    expect(spellEmailForSpeech('juan_perez@mi-empresa.com.ar'))
      .toBe('juan guion bajo perez arroba mi guion empresa punto com punto ar');
  });
});

describe('startContactWizard', () => {
  it('asks for the name first when none is known', () => {
    const r = startContactWizard();
    expect(r.state?.step).toBe('name');
    expect(r.prompt.toLowerCase()).toContain('nombre');
  });
  it('jumps to the email step when the name is already heard', () => {
    const r = startContactWizard({ name: 'Juan' });
    expect(r.state?.step).toBe('email');
    expect(r.state?.name).toBe('Juan');
    expect(r.prompt).toContain('Juan');
  });
});

describe('advanceContactWizard', () => {
  const nameStep: ContactWizardState = { step: 'name', name: '', email: '' };

  it('captures the name and moves to the email step', () => {
    const r = advanceContactWizard(nameStep, 'Juan Perez');
    expect(r.state).toEqual({ step: 'email', name: 'Juan Perez', email: '' });
    expect(r.prompt).toContain('Juan Perez');
  });

  it('re-asks when the name is empty', () => {
    const r = advanceContactWizard(nameStep, '   ');
    expect(r.state?.step).toBe('name');
    expect(r.kind).toBe('error');
  });

  it('parses a spoken email and moves to the read-back/confirm step', () => {
    const emailStep: ContactWizardState = { step: 'email', name: 'Ana', email: '' };
    const r = advanceContactWizard(emailStep, 'ana arroba gmail punto com');
    expect(r.state?.step).toBe('confirm');
    expect(r.state?.email).toBe('ana@gmail.com');
    /* The read-back spells the address so the user can catch a mistake. */
    expect(r.prompt).toContain('ana arroba gmail punto com');
  });

  it('re-asks when the email is not understood', () => {
    const emailStep: ContactWizardState = { step: 'email', name: 'Ana', email: '' };
    const r = advanceContactWizard(emailStep, 'no se cual es');
    expect(r.state?.step).toBe('email');
    expect(r.kind).toBe('error');
  });

  it('commits on "confirmar" and never claims saved before the App persists', () => {
    const confirmStep: ContactWizardState = { step: 'confirm', name: 'Ana', email: 'ana@gmail.com' };
    const r = advanceContactWizard(confirmStep, 'confirmar');
    expect(r.outcome).toBe('done');
    expect(r.committed).toEqual({ name: 'Ana', email: 'ana@gmail.com' });
    /* In-progress phrasing -- the App announces the success after the save. */
    expect(r.prompt.toLowerCase()).toContain('guardando');
  });

  it('goes back to the email step on "corregir"', () => {
    const confirmStep: ContactWizardState = { step: 'confirm', name: 'Ana', email: 'ana@gmail.com' };
    const r = advanceContactWizard(confirmStep, 'corregir');
    expect(r.state).toEqual({ step: 'email', name: 'Ana', email: '' });
  });

  it('holds the confirm step on an unrecognised reply (no silent save)', () => {
    const confirmStep: ContactWizardState = { step: 'confirm', name: 'Ana', email: 'ana@gmail.com' };
    const r = advanceContactWizard(confirmStep, 'mmm que se yo');
    expect(r.state?.step).toBe('confirm');
    expect(r.outcome).toBeUndefined();
  });

  it('cancels at any step', () => {
    for (const step of ['name', 'email', 'confirm'] as const) {
      const st: ContactWizardState = { step, name: 'Ana', email: 'ana@gmail.com' };
      const r = advanceContactWizard(st, 'cancelar');
      expect(r.outcome, step).toBe('cancelled');
      expect(r.committed, step).toBeUndefined();
    }
  });

  it('end to end: name -> email -> confirm -> committed', () => {
    let s = startContactWizard().state as ContactWizardState;
    const r1 = advanceContactWizard(s, 'Tamara Linares');
    s = r1.state as ContactWizardState;
    const r2 = advanceContactWizard(s, 'tamara linares arroba gmail punto com');
    s = r2.state as ContactWizardState;
    const r3 = advanceContactWizard(s, 'si');
    expect(r3.committed).toEqual({ name: 'Tamara Linares', email: 'tamaralinares@gmail.com' });
  });
});

describe('AGREGAR_CONTACTO command parsing', () => {
  it('triggers on "agregar contacto" and the natural variants', () => {
    expect(parseCommand('agregar contacto').type).toBe('AGREGAR_CONTACTO');
    expect(parseCommand('quiero anotar un contacto nuevo').type).toBe('AGREGAR_CONTACTO');
    expect(parseCommand('guarda este contacto').type).toBe('AGREGAR_CONTACTO');
    expect(parseCommand('dar de alta a alguien').type).toBe('AGREGAR_CONTACTO');
  });

  it('carries the name when said in one go', () => {
    expect(parseCommand('agregar contacto Juan Perez').payload).toBe('Juan Perez');
    expect(parseCommand('agendar a Maria').payload).toBe('Maria');
    expect(parseCommand('dar de alta a Pedro').payload).toBe('Pedro');
  });

  it('leaves the name empty for the bare phrase (the app asks for it)', () => {
    expect(parseCommand('agregar contacto').payload).toBeUndefined();
  });

  it('does NOT hijack opening the address book', () => {
    expect(parseCommand('abrir contactos').type).toBe('ABRIR_CONTACTOS');
    expect(parseCommand('mis contactos').type).toBe('ABRIR_CONTACTOS');
    expect(parseCommand('mostrame la agenda').type).toBe('ABRIR_CONTACTOS');
  });
});
