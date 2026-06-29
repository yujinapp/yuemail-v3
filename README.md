# Yuemail

> Voice-first single-user email client. Dictate, sign, send.
> AI voice assistant (Brain) + Google STT/TTS hearing & speaking,
> BYOK encrypted vault, local-first. No telemetry.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node >= 18](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![npm](https://img.shields.io/badge/npm-%40yujinapp%2Fyuemail%400.11.0-blue)](https://www.npmjs.com/package/@yujinapp/yuemail)

Current version: **0.11.0**.

Yuemail is for people who need to dictate a written document, sign
it, and send it by email from their own personal machine without
relying on a sighted helper or sustained-precision mouse interaction.

The north-star journey: *"Pablo dicta un informe, dice 'firmar', dice
'enviar a ana arroba ejemplo punto com', y termina. El sistema desaparece."*

## Install

```bash
npm install -g @yujinapp/yuemail
```

### Requirements

- **Node**: Yuemail itself requires Node `>=18.0.0`.
- **Node for the voice trainer**: the bundled, optional add-on
  [`@yujinapp/nac3-kikoe`](https://www.npmjs.com/package/@yujinapp/nac3-kikoe)
  declares Node `>=22`. The core app runs fine on Node 18; if you intend
  to use the voice trainer (`abrir entrenador`), **run Node `>=22`** to
  stay inside the add-on's supported range. We document this rather than
  forcing 22 on everyone, since the trainer is optional.
- **Browser**: the browser side uses the Web Speech API, supported by
  Chrome, Edge, and Safari. Other browsers degrade to button-only mode.
  (When the Google Voice path is on, hearing/speaking go through the
  server to Google instead -- see "Hearing and speaking" below.)

## Usage

```bash
yuemail                          # start the server + open the browser
yuemail start                    # start the server only (no browser)
yuemail vault setup              # interactive mail-credential wizard (12 fields; or use the in-app gear)
yuemail vault list               # list configured key names
yuemail vault set <name> <val>   # encrypt and store a value
yuemail vault delete <name>      # remove a value
yuemail version
yuemail help
```

The server binds `127.0.0.1:5180` only. Loopback. Never LAN.

## AI voice assistant (Brain)

Yuemail ships an optional AI **Brain** that interprets what you *mean*,
not just fixed phrases. When enabled (it is **on by default**), each
utterance is routed to the chosen model, which maps it to one of
Yuemail's commands. This lets you speak naturally ("mandale esto a Ana")
instead of memorising exact wording.

- **Nine providers** (BYOK -- you bring your own API key, stored in the
  encrypted vault): `google_ai` (Gemini -- **the default**),
  `anthropic`, `openai`, `deepseek`, `xai`, `mistral`, `qwen`, `zai`,
  and `ollama` (local, keyless). The default model is Gemini Flash Lite.
- **Server-side only.** The router reads your key from the vault inside
  the server process; the key never reaches the browser and is never
  logged.
- **Fails closed to a phrase matcher.** If the Brain is disabled, has no
  key, times out, or returns something below the confidence threshold,
  Yuemail falls back to the built-in fixed-phrase recognizer. You are
  never stuck: the deterministic command set is the floor.

Configure the Brain (provider, model, enable/disable) from the
"Asistente" panel in the topbar. To run **fully local**, either disable
the Brain (fixed phrases only) or point it at `ollama`.

## Hearing and speaking (Google STT/TTS)

Separately from the Brain, Yuemail can use **Google Cloud** for hearing
(Speech-to-Text) and speaking (Text-to-Speech). This is the **default
("camino 1")** path, chosen for accessibility: a more accurate ear
(enhanced model + auto-punctuation, better for slower or atypical
speech) and clearer neural voices.

- **One Google Cloud key** (vault slot `speech.google`) powers both STT
  and TTS. Server-side only -- the key never reaches the browser.
- **Web Speech fallback.** When the Google Voice path is off, has no
  key, or a request fails, the client falls back to the browser's Web
  Speech API for hearing and `speechSynthesis` for speaking. Nobody is
  left deaf or mute.

Configure it from the "Voz" panel in the topbar ("Probar voz" tests it
live). With Google Voice **off**, hearing/speaking are fully local in
the browser.

## Voice commands

The Spanish utterances Yuemail recognises (accent-insensitive,
filler-word-tolerant):

| You say                                  | What happens                                  |
|------------------------------------------|-----------------------------------------------|
| `nuevo documento` / `documento nuevo`    | Clear the editor, start fresh                 |
| `abrir documento [nombre]`               | Load the latest or by partial name            |
| `poner titulo <texto>`                   | Set or change the document title              |
| `guardar firma`                          | Open the signature pad                        |
| `firmar`                                 | Insert the saved signature                    |
| `iniciar dictado` / `dictado`            | Begin transcription                           |
| `fin dictado` / `dictado`                | Stop transcription                            |
| `enviar a <email>` / `enviar a <nombre>` | Open the send dialog (address or contact name)|
| `responder` / `responder a <nombre>`     | Reply to the last read message (or a contact) |
| `reenviar`                               | Forward the last read message                 |
| `leer bandeja`                           | List the latest envelopes (also fetches body) |
| `abrir contactos` / `agenda`             | Open the address book                         |
| `agregar contacto [nombre]`              | Guided add-contact flow (asks name, then mail)|
| `abrir configuracion` / `ajustes`        | Open the account settings                     |
| `abrir entrenador` / `entrenar voz`      | Open the voice trainer                        |
| `detener voz`                            | Mute the microphone                           |

Plus the always-on mic toggle: `encender microfono` / `apagar microfono`.

Reply (`responder` / RESPONDER), forward (`reenviar` / REENVIAR), and
full-message body fetch are implemented end to end (`GET
/api/inbox/fetch/:uid` on the server). `responder` with no name replies
to whoever sent the last read message; `responder a <nombre>` and
`enviar a <nombre>` resolve a person from the contacts book (see
"Contacts" below).

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

## Voice trainer (atypical speech)

For speech the standard recognizer struggles with, Yuemail bundles the
decoupled add-on [`@yujinapp/nac3-kikoe`](https://www.npmjs.com/package/@yujinapp/nac3-kikoe)
(note: this add-on declares Node `>=22`; see Requirements above):
a **local, speaker-dependent** command recognizer. Open it with `abrir
entrenador`. There you record a few samples of each command in your own
voice; the app turns each recording into a numeric fingerprint and stores
**only those numbers -- never the audio**. From then on it recognizes a
command by comparing your live voice against your own samples (offline,
instant), so it does not need anyone else to understand you.

Each command shows two figures that mature with use:

- **confidence** -- how often you let the local recognition stand (vs.
  correcting/cancelling it). Source of truth: you.
- **effectiveness** -- how often the local result agreed with the cloud
  (Google) second opinion. A low number for severe atypical speech means
  the cloud is the unreliable one, which *validates* the local lane.

A three-way "perilla" picks when the costly cloud runs: **Solo cuando
dudo**, **Modo aprendizaje** (the default -- shadow-measures against the
cloud for a while, then tapers), or **Siempre comparar**. The setting is
per device. Train one command or all of them; `Probar` tests a command and
`Borrar` forgets it. If you never train, voice behaves exactly as without
the trainer -- the cloud path is the shared floor; the trainer is an
optional stage in front of it, only for who trains.

## Contacts (address book)

Yuemail keeps a local address book so you can send and reply by **name**
instead of spelling out an address by voice:

- `abrir contactos` / `agenda` opens the book.
- `enviar a <nombre>` and `responder a <nombre>` resolve a person from
  the book and pre-fill the send dialog.
- `agregar contacto [nombre]` runs a guided, voice-driven add flow: it
  asks for the name first, then the email, and reads the address back
  ("ana arroba gmail punto com") for confirmation before saving -- the
  spoken read-back guards the costliest error, a wrong address.
- **Auto-registration:** when you `leer bandeja`, senders and CC
  recipients of the listed messages are added to the book automatically
  (best-effort; it never breaks the inbox read), so you can reply by
  name later without typing.

Contacts live as JSON under `~/.yuemail/`, like everything else -- no
database, no cloud.

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

## Privacy (read this -- it is honest, not zero-outbound)

Yuemail is **local-first**, but it is **not zero-outbound when the AI
and Google voice features are on** -- and both are **on by default**. Be
clear-eyed about what leaves your machine:

- **Single user.** No login, no user table, no database -- JSON on the
  filesystem under `~/.yuemail/`. No telemetry, ever.
- **Mail** flows only to the IMAP/SMTP servers **you** configure.
- **AI Brain (default on):** when enabled, the text of your request is
  sent from the server to the AI provider you chose (Gemini by default;
  or Anthropic / OpenAI / DeepSeek / xAI / Mistral / Qwen / Z.ai). That
  provider sees your request text. Pick `ollama` or disable the Brain to
  avoid this.
- **Google voice (default on):** when the Google STT/TTS path is
  enabled, your **dictated audio** is sent from the server to Google
  Cloud Speech-to-Text, and the **text to be spoken** is sent to Google
  Text-to-Speech. Google sees that audio and text. Turn the Voice off to
  avoid this.
- **Your API keys never leave your machine.** They stay in the encrypted
  vault and are read only inside the server process; they never reach
  the browser and are never logged. What leaves the machine when these
  features are on is the *content* (request text, dictated audio), not
  the keys.

### Running fully local (zero outbound beyond your mail servers)

- **Hearing/speaking:** turn the Google Voice off ("Voz" panel) -- the
  browser's Web Speech API + `speechSynthesis` take over, in-browser.
- **Understanding:** disable the Brain ("Asistente" panel) to use the
  built-in fixed-phrase matcher, or point the Brain at `ollama` (local,
  keyless). Either way no request text leaves the machine.
- With both off, the only outbound traffic is to the IMAP/SMTP servers
  you configured.

### Vault at-rest caveat (important)

The vault is encrypted at rest (AES-256-GCM, scrypt-derived key from a
per-machine salt; the raw `vault.json` never contains a plaintext
secret). **But the default passphrase is predictable:** it is derived
from `hostname` + `username`. That protects against a leaked/synced copy
of the vault files alone, but a local attacker who can read the files
can also read hostname + username and re-derive the key. For real
at-rest secrecy against local readers, set a strong passphrase via the
`YUEMAIL_VAULT_PASS` environment variable. The UI surfaces which source
is in use (`env` vs. `derived`) in `/api/vault/status`.

## Vault keys (22 slots)

The vault holds **22** key slots: 12 for mail + identity, 9 for the
Brain providers, and 1 for Google voice.

**Mail + identity (12)** -- the in-app gear fills these from just your
address; the CLI wizard (`yuemail vault setup`) prompts for the same 12
fields (skip any with Enter, fill later with `yuemail vault set`):

- `imap.host`, `imap.port`, `imap.user`, `imap.pass`, `imap.secure`
- `smtp.host`, `smtp.port`, `smtp.user`, `smtp.pass`, `smtp.secure`
- `identity.from`, `identity.name`

**Brain provider keys (9)** -- one BYOK slot per provider; set from the
"Asistente" panel or `yuemail vault set`:

- `brain.google_ai`, `brain.anthropic`, `brain.openai`, `brain.deepseek`,
  `brain.xai`, `brain.mistral`, `brain.qwen`, `brain.zai`, `brain.ollama`
  (Ollama is local + keyless; the slot exists for symmetry)

**Google voice key (1)** -- one key powers both STT and TTS:

- `speech.google`

## Repository layout

```
bin/yuemail.mjs      # CLI entry
server/              # Express + IMAP/SMTP + .docx + vault
server/brain/        # AI Brain: 9-provider router + config (camino 1)
server/voice/        # Google STT/TTS router + config (camino 1)
server/routes/inbox.ts  # envelope list + GET /api/inbox/fetch/:uid (body, reply, forward)
server/contacts.ts   # address book (name-based send/reply, auto-registration)
src/                 # React frontend (Vite)
src/voice/           # Spanish command parser + Web Speech hook + kikoe client
src/components/VoiceTrainer.tsx  # Voice trainer UI (add-on @yujinapp/nac3-kikoe)
src/styles/tokens.css  # Yujin Design System tokens
tests/               # Vitest suites (407 passing; 3 live benchmarks gated off)
docs/SPEC.md         # The specification this build implements
```

## License

MIT
