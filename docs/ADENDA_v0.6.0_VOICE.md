# Adenda v0.6.0 -- Voz de Google (escuchar y hablar)

Tipo: adenda evolutiva sobre los documentos aprobados (RFP/SPEC,
Architecture, Design). Aprobada por el owner (Pablo) el 2026-06-22 con
las instrucciones explicitas "Camino 1" (Google STT/TTS como camino 1)
y "dale" tras destrabar la clave. Registrada como PND-011.

Cruza y modifica:
- docs/SPEC.md (RFP)
- docs/ARCHITECTURE.md
- docs/DESIGN.md
- docs/qa/INSTRUCTIVO_TESTERS.md, docs/qa/CASOS_DE_PRUEBA_v0.6.0.md

Continua la linea de la Adenda v0.5.0 (Brain): aquella puso la IA que
ENTIENDE el pedido; esta pone el OIDO y la VOZ que oyen y hablan.

## 1. Que cambia respecto del RFP aprobado

Hasta la v0.5.0, Yuemail escuchaba (voz -> texto) y hablaba (texto ->
voz) SOLO con el navegador (Web Speech API). Esta adenda agrega Google
Cloud como **camino 1** para las dos direcciones:

- **Speech-to-Text (oido):** mas preciso, con modelo "enhanced" y
  puntuacion automatica; mejor para acento y habla mas lenta.
- **Text-to-Speech (voz):** voces neuronales (Neural2), mas claras y
  naturales que la voz robotica del sistema.

Motivo del owner: los usuarios objetivo dependen de la ayuda; un oido y
una voz mejores son accesibilidad real, no lujo.

## 2. Decisiones de diseno (extienden docs/DESIGN.md)

- **D-VOICE-1 -- Dos caminos, Google primero.** Camino 1 (default):
  Google oye y habla. Camino 2 (red de seguridad): el navegador, usado
  cuando la Voz esta apagada, sin clave, o falla el viaje a Google. El
  cliente resuelve la caida: una transcripcion fallida usa el texto del
  navegador; una sintesis fallida usa `speechSynthesis`. Nadie queda
  mudo ni sordo.
- **D-VOICE-2 -- Server-side, sin SDK.** El router de voz corre en el
  server con `fetch` puro (lección Forge: los SDK inflan el paquete). La
  clave de Google se lee de la boveda en el proceso del server y NUNCA
  viaja al navegador, igual que la contrasena de correo y las claves del
  Brain.
- **D-VOICE-3 -- Una clave, dos servicios.** Una sola clave de Google
  (slot `speech.google`) habilita STT y TTS. La boveda paso de 21 a 22
  slots.
- **D-VOICE-4 -- El navegador segmenta; Google transcribe.** El
  reconocedor del navegador sigue encendido como detector de actividad
  de voz y como camino 2; en paralelo, un `UtteranceRecorder`
  (MediaRecorder) captura el audio de cada enunciado y, al finalizar, se
  manda ESE audio a Google. Se prefiere la transcripcion de Google; ante
  cualquier miss, la del navegador.
- **D-VOICE-5 -- Locale espanol normalizado.** Los regionales (es-AR,
  es-MX) se mapean a un locale certificado "enhanced" (es-US) para que
  el request caiga siempre en un modelo mejor; la voz embebe su propio
  languageCode (gana la voz).
- **D-VOICE-6 -- El audio viaja solo si la Voz esta encendida.** Con la
  Voz de Google ON, el SERVIDOR manda a Google el audio (para oir) y el
  texto a leer (para hablar). El navegador nunca llama a Google: por eso
  la pestana Network del navegador sigue mostrando solo 127.0.0.1.
  Apagando la Voz, nada de audio sale de la maquina.

## 3. Componentes (extienden docs/ARCHITECTURE.md)

Server (`server/voice/`):
- `types.ts` -- contratos STT/TTS.
- `google.ts` -- proveedor Google STT + TTS (fetch puro, clave en
  header `x-goog-api-key`, nunca logueada).
- `config.ts` -- lectura/escritura/patch de `~/.yuemail/voice.json`.
- `router.ts` -- superficie unica: lee config, decide camino 1, devuelve
  un miss tipado para que el cliente caiga al navegador.
- `routes/voice.ts` -- GET/PUT /api/voice/config, POST /api/voice/stt
  (audio crudo), POST /api/voice/tts (texto -> audio binario | miss).

Cliente:
- `src/voice/serverVoice.ts` -- transporte: serverSpeak, serverTranscribe,
  getVoiceConfig/setVoiceConfig, voiceReady, playAudioBlob.
- `src/voice/audioCapture.ts` -- `UtteranceRecorder` (MediaRecorder).
- `src/voice/useVoice.ts` -- oye con Google (camino 1) y cae al navegador;
  habla con Google y cae a `speechSynthesis`.
- `src/components/VoiceSettings.tsx` -- panel "Voz" (boton en la topbar),
  con "Probar voz" en vivo.

## 4. Pruebas

- `tests/voice/voice-router.test.ts` -- router server con fetch inyectado:
  no_key, happy path, non-2xx -> miss (sin red).
- `tests/voice/server-voice.test.ts` -- transporte cliente con fetch
  mockeado: audio -> ok, JSON -> miss tipado, todo error -> miss (nunca
  throw), voiceReady solo true si enabled+keyed.
- `tests/voice/live-voice-bench.test.ts` + `tests/voice/phrase_bank.ts` --
  bench end-to-end REAL: texto -> Google TTS -> audio -> Google STT ->
  Brain -> comando. Gated `VOICE_LIVE=1`. Mide ACIERTO DE COMANDO.
- `tests/vault.test.ts` -- actualizado al slot de voz (12 mail + 9 brain
  + 1 voz = 22).

Estado: 259/259 tests verdes + typecheck limpio + build OK **en el
momento de la adenda (v0.6.0)**. Bench end-to-end en vivo: **35/35 =
100% de acierto de comando** (clean / freeform / email / asr_noise /
negativos), corrido contra Google real con la clave del owner.

> **Nota 2026-06-28 (auditoria de docs):** la cifra "259/259" es una foto
> de la v0.6.0. La version vigente es **0.11.0** y la suite pasa **407
> tests** (24 suites activas; 3 benchmarks contra API en vivo quedan
> apagados por defecto -> 410 totales). La fuente unica de version es
> `package.json`.

## 5. Honestidad sobre el "100%"

El 100% del bench se mide con **voz sintetica** (Google TTS): un hablante
limpio y bien articulado, NO una persona con disartria o habla atipica,
que es el publico objetivo. El numero prueba que la caneria completa
(oido + Brain) rutea bien en buenas condiciones de audio; el numero real
con voz atipica sera menor. El bench imprime esa salvedad junto al
resultado para que nadie lo lea como cifra de poblacion.

## 6. Pendiente honesto

> **Actualizacion 2026-06-28 (auditoria de docs): el entrenador de voz
> YA SE CONSTRUYO.** Lo que esta seccion daba por "POSPUESTO" se
> implemento despues: el entrenador local, dependiente del hablante, vive
> en `src/components/VoiceTrainer.tsx` + `server/routes/kikoe.ts`, con el
> add-on `@yujinapp/nac3-kikoe` (ver la seccion "Voice trainer" del
> README). Se abre con `abrir entrenador`; graba muestras de cada
> comando en la voz de la persona, guarda SOLO huellas numericas (nunca
> el audio) y reconoce comparando contra esas muestras (offline). El
> texto debajo queda como registro historico de la decision original.

- **Entrenador de voz / adaptacion a voz atipica: ~~POSPUESTO~~ (ver el
  recuadro de arriba -- se construyo).** En su momento el owner dijo "Por
  ahora no entrenemos". Google, con una clave, NO reentrena su oido sobre
  la voz de una persona; eso es un programa aparte (Euphonia, con
  inscripcion). Lo que se penso construir, registrado en PND-011: un
  entrenador que (a) manda a Google la lista de palabras esperadas
  (speech adaptation) para sesgar el reconocimiento hacia el vocabulario
  de la persona, y (b) una capa local que aprende y corrige sus
  confusiones tipicas ("band eja" -> "bandeja"). El entrenador que se
  envio implementa el camino (b) -- una capa local dependiente del
  hablante.
- La medicion con voz REAL atipica queda pendiente de una corrida con
  usuarios (no se puede sustituir con TTS).
