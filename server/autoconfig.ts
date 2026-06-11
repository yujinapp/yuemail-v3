/**
 * Email server autoconfiguration (F10).
 *
 * Given just an email address, resolve IMAP + SMTP settings in three
 * tiers (first hit wins):
 *
 *   1. known    -- built-in table of major providers (Gmail, Outlook,
 *                  Yahoo, iCloud, ...). Instant, offline, includes the
 *                  app-password caveat each provider imposes.
 *   2. ispdb    -- Mozilla Thunderbird autoconfig database
 *                  (autoconfig.thunderbird.net). Covers thousands of
 *                  smaller ISPs. Network fetch with a 6s timeout.
 *   3. guess    -- convention fallback: imap.<domain>:993 (SSL) +
 *                  smtp.<domain>:587 (STARTTLS), flagged as a guess so
 *                  the UI tells the user to run the connection test.
 *
 * Providers with no public IMAP/SMTP (Proton without Bridge, Tuta) are
 * reported as unsupported with a human explanation instead of a guess
 * that can never work.
 *
 * The `secure` flag follows the vault convention: true = direct TLS
 * (993/465), false = plaintext upgrade via STARTTLS (143/587).
 *
 * ASCII-only.
 */

export interface ServerConfig {
  host:   string;
  port:   number;
  secure: boolean;
}

export interface AutoconfigResult {
  ok:        true;
  source:    'known' | 'ispdb' | 'guess';
  provider?: string;
  /** Value to use as imap.user / smtp.user (usually the full address). */
  username:  string;
  imap:      ServerConfig;
  smtp:      ServerConfig;
  note?:     string;
}

export interface AutoconfigFailure {
  ok:    false;
  error: string;
}

interface ProviderEntry {
  label:   string;
  domains: string[];
  imap:    ServerConfig;
  smtp:    ServerConfig;
  note?:   string;
}

const KNOWN_PROVIDERS: ProviderEntry[] = [
  {
    label: 'Gmail',
    domains: ['gmail.com', 'googlemail.com'],
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
    note: 'Gmail requiere una App Password: activa la verificacion en dos pasos en tu cuenta Google y genera una en myaccount.google.com/apppasswords. Tu contrasena normal no funciona.',
  },
  {
    label: 'Outlook / Hotmail',
    domains: ['outlook.com', 'outlook.es', 'hotmail.com', 'hotmail.es', 'live.com', 'msn.com'],
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp-mail.outlook.com', port: 587, secure: false },
    note: 'Microsoft puede exigir una contrasena de aplicacion segun la configuracion de seguridad de la cuenta. Ademas esta migrando las cuentas personales a autenticacion moderna (OAuth): si el login con contrasena falla aunque sea correcta, es probable que tu cuenta ya no acepte IMAP con contrasena basica.',
  },
  {
    label: 'Yahoo',
    domains: ['yahoo.com', 'yahoo.es', 'yahoo.com.ar', 'yahoo.com.mx', 'ymail.com'],
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
    note: 'Yahoo requiere una App Password generada en la seccion de seguridad de la cuenta.',
  },
  {
    label: 'iCloud',
    domains: ['icloud.com', 'me.com', 'mac.com'],
    imap: { host: 'imap.mail.me.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.me.com', port: 587, secure: false },
    note: 'iCloud requiere una contrasena especifica de app, generada en appleid.apple.com.',
  },
  {
    label: 'AOL',
    domains: ['aol.com'],
    imap: { host: 'imap.aol.com', port: 993, secure: true },
    smtp: { host: 'smtp.aol.com', port: 465, secure: true },
    note: 'AOL requiere una App Password generada en la seguridad de la cuenta.',
  },
  {
    label: 'GMX',
    domains: ['gmx.com'],
    imap: { host: 'imap.gmx.com', port: 993, secure: true },
    smtp: { host: 'mail.gmx.com', port: 587, secure: false },
    note: 'GMX trae IMAP desactivado por defecto: activalo primero en la web de GMX (Configuracion > POP3/IMAP > permitir acceso IMAP) o el login va a fallar.',
  },
  {
    label: 'GMX',
    domains: ['gmx.net', 'gmx.de'],
    imap: { host: 'imap.gmx.net', port: 993, secure: true },
    smtp: { host: 'mail.gmx.net', port: 587, secure: false },
    note: 'GMX trae IMAP desactivado por defecto: activalo primero en la web de GMX (Configuracion > POP3/IMAP > permitir acceso IMAP) o el login va a fallar.',
  },
  {
    label: 'Zoho',
    domains: ['zoho.com', 'zohomail.com'],
    imap: { host: 'imap.zoho.com', port: 993, secure: true },
    smtp: { host: 'smtp.zoho.com', port: 465, secure: true },
    note: 'Zoho requiere activar IMAP en Mail Settings y, si tenes verificacion en dos pasos, una contrasena de aplicacion generada en la seccion de seguridad de la cuenta.',
  },
  {
    label: 'Fastmail',
    domains: ['fastmail.com', 'fastmail.fm'],
    imap: { host: 'imap.fastmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.fastmail.com', port: 465, secure: true },
    note: 'Fastmail requiere una contrasena de app para clientes IMAP.',
  },
  {
    label: 'Yandex',
    domains: ['yandex.com', 'yandex.ru'],
    imap: { host: 'imap.yandex.com', port: 993, secure: true },
    smtp: { host: 'smtp.yandex.com', port: 465, secure: true },
    note: 'Yandex requiere una contrasena de aplicacion (creala en id.yandex.com, seccion de contrasenas de aplicacion) y tener IMAP habilitado en la configuracion del correo.',
  },
];

/* Providers that do not expose IMAP/SMTP at all -- a convention guess
 * would never connect, so fail with an explanation instead. */
const UNSUPPORTED_DOMAINS: Record<string, string> = {
  'proton.me':      'Proton Mail no expone IMAP/SMTP directo. Necesitas instalar Proton Mail Bridge y cargar a mano los datos locales que el Bridge te muestra.',
  'protonmail.com': 'Proton Mail no expone IMAP/SMTP directo. Necesitas instalar Proton Mail Bridge y cargar a mano los datos locales que el Bridge te muestra.',
  'tuta.com':       'Tuta (Tutanota) no ofrece IMAP/SMTP, no se puede usar con Yuemail.',
  'tutanota.com':   'Tuta (Tutanota) no ofrece IMAP/SMTP, no se puede usar con Yuemail.',
};

export function lookupKnownProvider(domain: string): ProviderEntry | undefined {
  const d = domain.toLowerCase();
  return KNOWN_PROVIDERS.find((p) => p.domains.includes(d));
}

export function guessByConvention(domain: string): { imap: ServerConfig; smtp: ServerConfig } {
  return {
    imap: { host: 'imap.' + domain, port: 993, secure: true },
    smtp: { host: 'smtp.' + domain, port: 587, secure: false },
  };
}

/* --- ISPDB (Thunderbird autoconfig) XML parsing ----------------------
 * The format is stable and flat; a tag-scoped regex extraction keeps us
 * dependency-free. We only need the first imap incomingServer and the
 * first smtp outgoingServer. */

function firstBlock(xml: string, tag: string, type: string): string | undefined {
  const re = new RegExp('<' + tag + '[^>]*type="' + type + '"[\\s\\S]*?</' + tag + '>');
  const m = xml.match(re);
  return m ? m[0] : undefined;
}

function tagValue(block: string, tag: string): string | undefined {
  const m = block.match(new RegExp('<' + tag + '>([^<]*)</' + tag + '>'));
  return m && m[1] !== undefined ? m[1].trim() : undefined;
}

function socketTypeToSecure(socketType: string | undefined): boolean {
  /* SSL = direct TLS. STARTTLS / plain = not direct TLS. */
  return (socketType ?? '').toUpperCase() === 'SSL';
}

function substituteUsername(template: string | undefined, email: string): string {
  if (!template || template.length === 0) return email;
  const at = email.lastIndexOf('@');
  const localPart = at > 0 ? email.slice(0, at) : email;
  return template
    .replace(/%EMAILADDRESS%/g, email)
    .replace(/%EMAILLOCALPART%/g, localPart);
}

export function parseIspdbXml(xml: string, email: string): AutoconfigResult | undefined {
  const inc = firstBlock(xml, 'incomingServer', 'imap');
  const out = firstBlock(xml, 'outgoingServer', 'smtp');
  if (!inc || !out) return undefined;

  const imapHost = tagValue(inc, 'hostname');
  const imapPort = Number(tagValue(inc, 'port'));
  const smtpHost = tagValue(out, 'hostname');
  const smtpPort = Number(tagValue(out, 'port'));
  if (!imapHost || !smtpHost || !Number.isFinite(imapPort) || !Number.isFinite(smtpPort)) {
    return undefined;
  }

  const result: AutoconfigResult = {
    ok:       true,
    source:   'ispdb',
    username: substituteUsername(tagValue(inc, 'username'), email),
    imap: { host: imapHost, port: imapPort, secure: socketTypeToSecure(tagValue(inc, 'socketType')) },
    smtp: { host: smtpHost, port: smtpPort, secure: socketTypeToSecure(tagValue(out, 'socketType')) },
  };
  const label = tagValue(xml, 'displayShortName');
  if (label) result.provider = label;
  return result;
}

const ISPDB_BASE = 'https://autoconfig.thunderbird.net/v1.1/';
const ISPDB_TIMEOUT_MS = 6000;

/**
 * Resolve IMAP + SMTP configuration for an email address.
 * `fetchImpl` is injectable so tests never hit the network.
 */
export async function autoconfigure(
  email: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AutoconfigResult | AutoconfigFailure> {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1 || !trimmed.slice(at + 1).includes('.')) {
    return { ok: false, error: 'Direccion de correo invalida: ' + email };
  }
  const domain = trimmed.slice(at + 1);

  const unsupported = UNSUPPORTED_DOMAINS[domain];
  if (unsupported) return { ok: false, error: unsupported };

  /* Tier 1: built-in provider table. */
  const known = lookupKnownProvider(domain);
  if (known) {
    const result: AutoconfigResult = {
      ok:       true,
      source:   'known',
      provider: known.label,
      username: trimmed,
      imap:     known.imap,
      smtp:     known.smtp,
    };
    if (known.note) result.note = known.note;
    return result;
  }

  /* Tier 2: Mozilla ISPDB. Any failure (offline, 404, malformed XML)
   * falls through to the convention guess. */
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ISPDB_TIMEOUT_MS);
    try {
      const res = await fetchImpl(ISPDB_BASE + encodeURIComponent(domain), { signal: ctrl.signal });
      if (res.ok) {
        const xml = await res.text();
        const parsed = parseIspdbXml(xml, trimmed);
        if (parsed) return parsed;
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    /* network unavailable -- fall through */
  }

  /* Tier 3: convention guess. */
  const guess = guessByConvention(domain);
  return {
    ok:       true,
    source:   'guess',
    username: trimmed,
    imap:     guess.imap,
    smtp:     guess.smtp,
    note:     'Servidores estimados por convencion (imap./smtp. + dominio). Usa Probar conexion; si falla, consulta los datos exactos con tu proveedor.',
  };
}
