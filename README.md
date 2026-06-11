# Yuemail

> Voice-first single-user email client. Dictate, sign, send.
> Local-only. BYOK encrypted vault. No telemetry.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node >= 18](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

Yuemail is for people who need to dictate a written document, sign
it, and send it by email from their own personal machine without
relying on a sighted helper or sustained-precision mouse interaction.

The north-star journey: *"Pablo dicta un informe, dice 'firmar', dice
'enviar a ana arroba ejemplo punto com', y termina. El sistema desaparece."*

## Install

```bash
npm install -g @yujinapp/yuemail
```

Requires Node `>=18.0.0`. The browser side uses the Web Speech API,
which is supported by Chrome, Edge, and Safari. Other browsers
degrade to button-only mode.

## Usage

```bash
yuemail                          # start the server + open the browser
yuemail start                    # start the server only (no browser)
yuemail vault setup              # interactive 12-field wizard (or use the in-app gear)
yuemail vault list               # list configured key names
yuemail vault set <name> <val>   # encrypt and store a value
yuemail vault delete <name>      # remove a value
yuemail version
yuemail help
```

The server binds `127.0.0.1:5180` only. Loopback. Never LAN.

## Voice commands

The Spanish utterances Yuemail recognises (accent-insensitive,
filler-word-tolerant):

| You say                                | What happens                       |
|----------------------------------------|------------------------------------|
| `nuevo documento` / `documento nuevo`  | Clear the editor, start fresh      |
| `abrir documento [nombre]`             | Load the latest or by partial name |
| `guardar firma`                        | Open the signature pad             |
| `firmar`                               | Insert the saved signature         |
| `iniciar dictado`                      | Begin transcription                |
| `fin dictado`                          | Stop transcription                 |
| `enviar a <email>`                     | Open the send dialog               |
| `leer bandeja`                         | List the latest envelopes          |
| `abrir configuracion` / `ajustes`      | Open the account settings          |
| `detener voz`                          | Mute the microphone                |

Plus the always-on mic toggle: `encender microfono` / `apagar microfono`.

Spoken `arroba` is treated as `@`, spoken `punto` as `.`, and the
extracted email is lowercased.

### Inside a dialog

While a modal is open it owns the voice channel: the global phrases
above are suspended (so `firmar` cannot touch the document behind the
dialog) and these contextual phrases take over:

| Dialog open      | You say                            | What happens               |
|------------------|------------------------------------|----------------------------|
| Send dialog      | `confirmar` / `enviar` / `mandar`  | Confirm and send the email |
| Send dialog      | `cancelar` / `cerrar` / `salir`    | Close without sending      |
| Signature pad    | `guardar` / `listo`                | Save the drawn signature   |
| Signature pad    | `borrar` / `limpiar`               | Clear the canvas           |
| Signature pad    | `generar` / `cursiva`              | Bake the typed name        |
| Signature pad    | `cancelar` / `cerrar` / `salir`    | Close without saving       |
| Settings         | `detectar` / `automatica`          | Autodetect the servers     |
| Settings         | `probar` / `verificar`             | Live IMAP+SMTP test        |
| Settings         | `guardar` / `listo`                | Save to the vault          |
| Settings         | `cancelar` / `cerrar` / `salir`    | Close without saving       |

`apagar microfono` and `detener voz` always work, dialog or not.

### Dictating into dialog fields

Every modal input is dictatable: say `campo <nombre>` to arm a field
(send dialog: `destinatario`, `asunto`, `cuerpo`, `adjuntar`;
signature pad: `nombre`; settings: `correo`, `contrasena`, `servidor
imap`, ...), then speak the value. `borrar campo` empties the armed
field; `fin campo` releases it and restores the dialog verbs.

The message body APPENDS: each utterance lands as a new paragraph,
so long messages can be dictated sentence by sentence. While a field
is armed in the send dialog or the signature pad, free speech IS the
field value -- saying `enviar` mid-sentence does NOT send the email;
say `fin campo` first, then `enviar`. Recipients accept several
addresses ("ana arroba ejemplo punto com y pedro arroba test punto
org", or spoken `coma`). Passwords are never echoed back, only their
captured length.

## Account setup (the gear)

Click the gear in the topbar (or say `abrir configuracion`), type
your email address, and Yuemail resolves the IMAP/SMTP servers for
you: major providers from a built-in table (Gmail, Outlook, Yahoo,
iCloud, AOL, GMX, Zoho, Fastmail, Yandex -- including each
provider's app-password caveat), everything else via the Mozilla
autoconfig database, with a convention guess as last resort. Run
`Probar conexion` to test the real IMAP+SMTP login before saving;
saving encrypts everything into the vault. Proton (without Bridge)
and Tuta do not expose IMAP/SMTP and are reported as such.

## Privacy

- Single user. No login. No user table.
- No database. JSON-on-filesystem under `~/.yuemail/`.
- No outbound network beyond the IMAP/SMTP servers **you** configure.
- The vault is encrypted at rest (AES-256-GCM, scrypt-derived key from
  a per-machine salt). The raw `vault.json` never contains the
  plaintext value of any stored secret.

## Vault keys

The in-app gear fills these for you from just your address. The
wizard prompts for the same 12 fields; skip any with Enter and fill
them later with `yuemail vault set`.

- `imap.host`, `imap.port`, `imap.user`, `imap.pass`, `imap.secure`
- `smtp.host`, `smtp.port`, `smtp.user`, `smtp.pass`, `smtp.secure`
- `identity.from`, `identity.name`

## Repository layout

```
bin/yuemail.mjs      # CLI entry
server/              # Express + IMAP/SMTP + .docx
src/                 # React frontend (Vite)
src/voice/           # Spanish command parser + Web Speech hook
src/styles/tokens.css  # Yujin Design System tokens
tests/               # Vitest suites
docs/SPEC.md         # The specification this build implements
```

## License

MIT
