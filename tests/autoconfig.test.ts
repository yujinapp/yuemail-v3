/**
 * Autoconfig resolution (F10).
 *
 * No network: the ISPDB tier is exercised through an injected fake
 * fetch. Covers the three tiers (known / ispdb / guess), unsupported
 * providers, and invalid addresses.
 */
import { describe, it, expect } from 'vitest';
import {
  autoconfigure,
  lookupKnownProvider,
  guessByConvention,
  parseIspdbXml,
} from '../server/autoconfig.js';

const ISPDB_SAMPLE_XML = `<?xml version="1.0"?>
<clientConfig version="1.1">
 <emailProvider id="ejemplo.com">
  <domain>ejemplo.com</domain>
  <displayShortName>Ejemplo</displayShortName>
  <incomingServer type="pop3">
   <hostname>pop.ejemplo.com</hostname>
   <port>995</port>
   <socketType>SSL</socketType>
   <username>%EMAILADDRESS%</username>
  </incomingServer>
  <incomingServer type="imap">
   <hostname>mail.ejemplo.com</hostname>
   <port>993</port>
   <socketType>SSL</socketType>
   <username>%EMAILADDRESS%</username>
  </incomingServer>
  <outgoingServer type="smtp">
   <hostname>smtp.ejemplo.com</hostname>
   <port>587</port>
   <socketType>STARTTLS</socketType>
   <username>%EMAILLOCALPART%</username>
  </outgoingServer>
 </emailProvider>
</clientConfig>`;

function fakeFetch(status: number, body = ''): typeof fetch {
  return (async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  })) as unknown as typeof fetch;
}

function failingFetch(): typeof fetch {
  return (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
}

describe('tier 1 -- known provider table', () => {
  it('gmail.com resolves without network', async () => {
    const res = await autoconfigure('ana@gmail.com', failingFetch());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.source).toBe('known');
    expect(res.imap.host).toBe('imap.gmail.com');
    expect(res.imap.port).toBe(993);
    expect(res.imap.secure).toBe(true);
    expect(res.smtp.host).toBe('smtp.gmail.com');
    expect(res.smtp.port).toBe(465);
    expect(res.username).toBe('ana@gmail.com');
    expect(res.note).toMatch(/App Password/);
  });

  it('googlemail.com is a Gmail alias', () => {
    expect(lookupKnownProvider('googlemail.com')?.label).toBe('Gmail');
  });

  it('outlook uses STARTTLS on 587 for SMTP', async () => {
    const res = await autoconfigure('p@outlook.com', failingFetch());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.smtp.port).toBe(587);
    expect(res.smtp.secure).toBe(false);
  });

  it('domain match is case-insensitive', async () => {
    const res = await autoconfigure('Ana@GMAIL.COM', failingFetch());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.source).toBe('known');
  });
});

/* Full provider-table coverage (verification-honesty: every row, not a
 * sample). Expected values are written here independently from the
 * implementation, taken from each provider's published IMAP/SMTP docs.
 * A future typo in any row of KNOWN_PROVIDERS goes red here. */
describe('tier 1 -- every known provider row', () => {
  interface ExpectedRow {
    domain:       string;            /* representative domain for the row */
    aliases:      string[];          /* every other domain that must hit the same row */
    label:        string;
    imap:         { host: string; port: number; secure: boolean };
    smtp:         { host: string; port: number; secure: boolean };
    noteContains: string | undefined; /* app-password / setup caveat the UI must show */
  }

  const EXPECTED: ExpectedRow[] = [
    {
      domain: 'gmail.com', aliases: ['googlemail.com'], label: 'Gmail',
      imap: { host: 'imap.gmail.com', port: 993, secure: true },
      smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
      noteContains: 'App Password',
    },
    {
      domain: 'outlook.com', aliases: ['outlook.es', 'hotmail.com', 'hotmail.es', 'live.com', 'msn.com'], label: 'Outlook / Hotmail',
      imap: { host: 'outlook.office365.com', port: 993, secure: true },
      smtp: { host: 'smtp-mail.outlook.com', port: 587, secure: false },
      noteContains: 'OAuth',
    },
    {
      domain: 'yahoo.com', aliases: ['yahoo.es', 'yahoo.com.ar', 'yahoo.com.mx', 'ymail.com'], label: 'Yahoo',
      imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
      smtp: { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
      noteContains: 'App Password',
    },
    {
      domain: 'icloud.com', aliases: ['me.com', 'mac.com'], label: 'iCloud',
      imap: { host: 'imap.mail.me.com', port: 993, secure: true },
      smtp: { host: 'smtp.mail.me.com', port: 587, secure: false },
      noteContains: 'appleid.apple.com',
    },
    {
      domain: 'aol.com', aliases: [], label: 'AOL',
      imap: { host: 'imap.aol.com', port: 993, secure: true },
      smtp: { host: 'smtp.aol.com', port: 465, secure: true },
      noteContains: 'App Password',
    },
    {
      domain: 'gmx.com', aliases: [], label: 'GMX',
      imap: { host: 'imap.gmx.com', port: 993, secure: true },
      smtp: { host: 'mail.gmx.com', port: 587, secure: false },
      noteContains: 'IMAP desactivado por defecto',
    },
    {
      domain: 'gmx.net', aliases: ['gmx.de'], label: 'GMX',
      imap: { host: 'imap.gmx.net', port: 993, secure: true },
      smtp: { host: 'mail.gmx.net', port: 587, secure: false },
      noteContains: 'IMAP desactivado por defecto',
    },
    {
      domain: 'zoho.com', aliases: ['zohomail.com'], label: 'Zoho',
      imap: { host: 'imap.zoho.com', port: 993, secure: true },
      smtp: { host: 'smtp.zoho.com', port: 465, secure: true },
      noteContains: 'contrasena de aplicacion',
    },
    {
      domain: 'fastmail.com', aliases: ['fastmail.fm'], label: 'Fastmail',
      imap: { host: 'imap.fastmail.com', port: 993, secure: true },
      smtp: { host: 'smtp.fastmail.com', port: 465, secure: true },
      noteContains: 'contrasena de app',
    },
    {
      domain: 'yandex.com', aliases: ['yandex.ru'], label: 'Yandex',
      imap: { host: 'imap.yandex.com', port: 993, secure: true },
      smtp: { host: 'smtp.yandex.com', port: 465, secure: true },
      noteContains: 'contrasena de aplicacion',
    },
  ];

  for (const row of EXPECTED) {
    it(row.label + ' (' + row.domain + '): host/port/TLS exact + caveat note', async () => {
      const res = await autoconfigure('user@' + row.domain, failingFetch());
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.source).toBe('known');
      expect(res.provider).toBe(row.label);
      expect(res.imap).toEqual(row.imap);
      expect(res.smtp).toEqual(row.smtp);
      expect(res.username).toBe('user@' + row.domain);
      if (row.noteContains !== undefined) {
        expect(res.note ?? '', row.domain + ' note').toContain(row.noteContains);
      }
    });

    for (const alias of row.aliases) {
      it(row.label + ' alias ' + alias + ' resolves to the same servers', async () => {
        const res = await autoconfigure('user@' + alias, failingFetch());
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        expect(res.provider).toBe(row.label);
        expect(res.imap).toEqual(row.imap);
        expect(res.smtp).toEqual(row.smtp);
      });
    }
  }
});

describe('tier 2 -- Mozilla ISPDB', () => {
  it('parses hostname / port / socketType / username templates', async () => {
    const res = await autoconfigure('juan@ejemplo.com', fakeFetch(200, ISPDB_SAMPLE_XML));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.source).toBe('ispdb');
    expect(res.provider).toBe('Ejemplo');
    expect(res.imap.host).toBe('mail.ejemplo.com');
    expect(res.imap.secure).toBe(true);
    expect(res.smtp.host).toBe('smtp.ejemplo.com');
    expect(res.smtp.port).toBe(587);
    expect(res.smtp.secure).toBe(false);
    /* %EMAILADDRESS% on the imap side wins the username slot. */
    expect(res.username).toBe('juan@ejemplo.com');
  });

  it('skips the pop3 block and picks the imap incomingServer', () => {
    const parsed = parseIspdbXml(ISPDB_SAMPLE_XML, 'x@ejemplo.com');
    expect(parsed?.imap.host).toBe('mail.ejemplo.com');
    expect(parsed?.imap.port).toBe(993);
  });

  it('malformed XML returns undefined (caller falls through to guess)', () => {
    expect(parseIspdbXml('<clientConfig></clientConfig>', 'x@y.com')).toBeUndefined();
  });
});

describe('tier 3 -- convention guess', () => {
  it('unknown domain + 404 from ISPDB falls back to imap./smtp. convention', async () => {
    const res = await autoconfigure('x@miempresa-rara.com', fakeFetch(404));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.source).toBe('guess');
    expect(res.imap.host).toBe('imap.miempresa-rara.com');
    expect(res.smtp.host).toBe('smtp.miempresa-rara.com');
    expect(res.note).toMatch(/convencion/);
  });

  it('unknown domain + network down also falls back to guess', async () => {
    const res = await autoconfigure('x@miempresa-rara.com', failingFetch());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.source).toBe('guess');
  });

  it('guessByConvention uses 993 SSL + 587 STARTTLS', () => {
    const g = guessByConvention('dominio.com');
    expect(g.imap).toEqual({ host: 'imap.dominio.com', port: 993, secure: true });
    expect(g.smtp).toEqual({ host: 'smtp.dominio.com', port: 587, secure: false });
  });
});

describe('unsupported + invalid input', () => {
  it('proton.me fails with a Bridge explanation instead of a dead guess', async () => {
    const res = await autoconfigure('p@proton.me', failingFetch());
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/Bridge/);
  });

  it('invalid address fails fast', async () => {
    expect((await autoconfigure('no-es-un-correo', failingFetch())).ok).toBe(false);
    expect((await autoconfigure('a@', failingFetch())).ok).toBe(false);
    expect((await autoconfigure('@b.com', failingFetch())).ok).toBe(false);
    expect((await autoconfigure('a@sinpunto', failingFetch())).ok).toBe(false);
  });
});
