/**
 * Contact matching + recipient parsing (client) -- PND-022.
 *
 * Covers: the address-book fuzzy match, the stronger dictated-email
 * extraction (PND-020 regression), and the new voice commands
 * (ENVIAR-by-name, RESPONDER, PONER_TITULO, ABRIR_CONTACTOS).
 *
 * ASCII-only.
 */
import { describe, it, expect } from 'vitest';
import { matchContacts, type Contact } from '../src/lib/contactMatch.js';
import { parseCommand, extractSpokenEmail, looksLikeEmail } from '../src/voice/commands.js';
import { resolveCommand } from '../src/voice/resolveCommand.js';
import type { BrainResolveResponse } from '../src/lib/api.js';

function c(name: string, email: string, aliases: string[] = []): Contact {
  return { id: name + '|' + email, name, email, aliases, source: 'manual' };
}

const BOOK: Contact[] = [
  c('Maximiliano Linares', 'maxi@gmail.com', ['maxi']),
  c('Ana Gomez', 'ana@ejemplo.com'),
  c('Ana Lopez', 'analopez@test.org'),
  c('Tamara', 'tamara@test.org'),
];

describe('matchContacts', () => {
  it('matches a full first name confidently (single hit)', () => {
    const r = matchContacts('maximiliano', BOOK);
    expect(r.best?.email).toBe('maxi@gmail.com');
    expect(r.ambiguous).toBe(false);
  });

  it('matches via alias', () => {
    const r = matchContacts('maxi', BOOK);
    expect(r.best?.email).toBe('maxi@gmail.com');
  });

  it('flags ambiguity when two contacts share a first name', () => {
    const r = matchContacts('ana', BOOK);
    expect(r.ambiguous).toBe(true);
    expect(r.candidates.map((x) => x.email).sort()).toEqual(['ana@ejemplo.com', 'analopez@test.org']);
  });

  it('a full name disambiguates the shared first name', () => {
    const r = matchContacts('ana gomez', BOOK);
    expect(r.best?.email).toBe('ana@ejemplo.com');
    expect(r.ambiguous).toBe(false);
  });

  it('accent-insensitive', () => {
    const r = matchContacts('TAMARA', BOOK);
    expect(r.best?.email).toBe('tamara@test.org');
  });

  it('returns nothing when no contact is close', () => {
    const r = matchContacts('roberto perez', BOOK);
    expect(r.best).toBeUndefined();
    expect(r.candidates).toEqual([]);
  });
});

describe('extractSpokenEmail (PND-020 -- robust dictated address)', () => {
  it('handles spoken "arroba"/"punto"', () => {
    expect(extractSpokenEmail('ana arroba ejemplo punto com')).toBe('ana@ejemplo.com');
  });

  it('compacts a name spoken with a pause before the @ (the 23@gmail.com bug)', () => {
    const got = extractSpokenEmail('maximiliano punto linares 23 arroba gmail punto com');
    expect(got).toBe('maximiliano.linares23@gmail.com');
    expect(got).not.toBe('23@gmail.com');
  });

  it('passes a literal address through', () => {
    expect(extractSpokenEmail('juan@dominio.com')).toBe('juan@dominio.com');
  });

  it('returns undefined for a bare name (routes to the address book)', () => {
    expect(extractSpokenEmail('maximiliano linares')).toBeUndefined();
  });

  it('looksLikeEmail only flags utterances with an address signal', () => {
    expect(looksLikeEmail('ana arroba ejemplo punto com')).toBe(true);
    expect(looksLikeEmail('maximiliano')).toBe(false);
  });
});

describe('parseCommand -- recipient + new global commands (PND-022)', () => {
  it('ENVIAR by name carries the name as payload', () => {
    const cmd = parseCommand('enviar a maximiliano');
    expect(cmd.type).toBe('ENVIAR');
    expect(cmd.payload).toBe('maximiliano');
  });

  it('ENVIAR by name with two words', () => {
    const cmd = parseCommand('enviar a ana gomez');
    expect(cmd.type).toBe('ENVIAR');
    expect(cmd.payload).toBe('ana gomez');
  });

  it('ENVIAR with a dictated address still extracts the address (no regression)', () => {
    const cmd = parseCommand('enviar a ana arroba ejemplo punto com');
    expect(cmd.type).toBe('ENVIAR');
    expect(cmd.payload).toBe('ana@ejemplo.com');
  });

  it('ENVIAR does NOT mis-extract a spaced local part (PND-020)', () => {
    const cmd = parseCommand('enviar a maximiliano punto linares 23 arroba gmail punto com');
    expect(cmd.type).toBe('ENVIAR');
    expect(cmd.payload).toBe('maximiliano.linares23@gmail.com');
  });

  it('RESPONDER bare carries no payload (reply to last read)', () => {
    const cmd = parseCommand('responder');
    expect(cmd.type).toBe('RESPONDER');
    expect(cmd.payload).toBeUndefined();
  });

  it('RESPONDER by name carries the name', () => {
    const cmd = parseCommand('responder a ana');
    expect(cmd.type).toBe('RESPONDER');
    expect(cmd.payload).toBe('ana');
  });

  it('"contestar" is RESPONDER too', () => {
    expect(parseCommand('contestar').type).toBe('RESPONDER');
  });

  it('PONER_TITULO captures the dictated title with its casing', () => {
    const cmd = parseCommand('poner titulo Carta al Banco');
    expect(cmd.type).toBe('PONER_TITULO');
    expect(cmd.payload).toBe('Carta al Banco');
  });

  it('"titulo X" also sets the title', () => {
    const cmd = parseCommand('titulo Informe anual');
    expect(cmd.type).toBe('PONER_TITULO');
    expect(cmd.payload).toBe('Informe anual');
  });

  it('ABRIR_CONTACTOS via "contactos" / "agenda"', () => {
    expect(parseCommand('abrir contactos').type).toBe('ABRIR_CONTACTOS');
    expect(parseCommand('mis contactos').type).toBe('ABRIR_CONTACTOS');
    expect(parseCommand('la agenda').type).toBe('ABRIR_CONTACTOS');
  });
});

describe('resolveCommand -- Brain passes contact names through (PND-022)', () => {
  const brain = (resp: BrainResolveResponse) => () => Promise.resolve(resp);

  it('ENVIAR with a contact-name payload keeps the name for the App to resolve', async () => {
    const cmd = await resolveCommand('mandaselo a Maximiliano', 'global', {}, {
      brainResolve: brain({ ok: true, type: 'ENVIAR', payload: 'Maximiliano', confidence: 0.9, source: 'brain', model: 'm' }),
    });
    expect(cmd.type).toBe('ENVIAR');
    expect(cmd.payload).toBe('Maximiliano');
  });

  it('RESPONDER with a name', async () => {
    const cmd = await resolveCommand('respondele a Ana', 'global', {}, {
      brainResolve: brain({ ok: true, type: 'RESPONDER', payload: 'Ana', confidence: 0.9, source: 'brain', model: 'm' }),
    });
    expect(cmd.type).toBe('RESPONDER');
    expect(cmd.payload).toBe('Ana');
  });

  it('PONER_TITULO carries the title', async () => {
    const cmd = await resolveCommand('el titulo es Reclamo formal', 'global', {}, {
      brainResolve: brain({ ok: true, type: 'PONER_TITULO', payload: 'Reclamo formal', confidence: 0.9, source: 'brain', model: 'm' }),
    });
    expect(cmd.type).toBe('PONER_TITULO');
    expect(cmd.payload).toBe('Reclamo formal');
  });
});
