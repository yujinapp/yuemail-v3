# Adenda v0.5.0 -- Asistente de voz (Brain)

Tipo: adenda evolutiva sobre los documentos aprobados (RFP/SPEC,
Architecture, Design). Aprobada por el owner (Pablo) el 2026-06-22 con
la instruccion explicita "que la brain sea camino 1 por defecto;
arranca". Registrada como PND-010.

Cruza y modifica:
- docs/SPEC.md (RFP)
- docs/ARCHITECTURE.md
- docs/DESIGN.md
- docs/qa/INSTRUCTIVO_TESTERS.md, docs/qa/CASOS_DE_PRUEBA_v0.5.0.md

## 1. Que cambia respecto del RFP aprobado

El RFP original decidio explicitamente "sin IA": el reconocimiento de
voz lo hace el navegador (Web Speech) y Yuemail comparaba el texto
contra una lista fija de frases. Esta adenda REVIERTE esa decision e
introduce un Asistente de voz (Brain) que interpreta el pedido en
lenguaje natural y elige la accion.

Motivo del owner: los usuarios objetivo (discapacidad motriz/visual)
necesitan poder pedir con sus propias palabras, no memorizar frases.
La eficiencia de interpretacion es prioritaria sobre la pureza
"100% local".

## 2. Decisiones de diseno (extienden docs/DESIGN.md)

- **D-BRAIN-1 -- Dos caminos, IA primero.** Camino 1 (default): el
  Brain clasifica cada pedido. Camino 2 (red de seguridad): el matcher
  de frases fijas, usado cuando el Brain esta apagado, sin clave, sin
  red, o responde por debajo de `min_confidence`. Una persona que
  depende del producto nunca queda sin app.
- **D-BRAIN-2 -- Server-side, sin SDK.** El router corre en el server
  (Express, loopback) con `fetch` puro (sin SDK, para no inflar el
  paquete). La clave de API se lee de la boveda en el proceso del
  server y NUNCA viaja al navegador, igual que la contrasena de correo.
- **D-BRAIN-3 -- Config unica, todos los proveedores.** Replica el
  patron de Yujin-Forge: una sola config (`~/.yuemail/brain.json`) con
  proveedor + modelo + enabled + umbral + timeout. Proveedores:
  google_ai (default), anthropic, openai, deepseek, xai, mistral, qwen,
  zai, ollama (local, sin clave). Modelo default: Gemini Flash Lite.
- **D-BRAIN-4 -- Boveda compartida.** Las claves se guardan en la misma
  boveda AES-256-GCM, en slots `brain.<provider>` (allowlist extendida
  de 12 a 21). Ningun endpoint devuelve el valor; solo booleanos.
- **D-BRAIN-5 -- El Brain clasifica; el cliente normaliza.** El router
  devuelve `{type, payload, confidence}`. La normalizacion del payload
  (email, clave de campo) vive en el cliente, donde estan las field
  specs, para no duplicar el vocabulario de UI en el server.
- **D-BRAIN-6 -- El dictado es contenido, no comando.** Mientras el
  dictado esta activo (contexto global), las frases NO se mandan al
  Brain: son contenido del documento; el matcher literal sigue captando
  "fin dictado" para cortar.
- **D-BRAIN-7 -- Privacidad explicita.** Con el Brain encendido, el
  TEXTO del pedido viaja al proveedor (la clave no). Documentado en el
  instructivo de QA y configurable (apagar el Brain u Ollama local).

## 3. Componentes (extienden docs/ARCHITECTURE.md)

Server (`server/brain/`):
- `config.ts` -- lectura/escritura/patch de la config del Brain.
- `catalog.ts` -- catalogo de comandos (las "NAC3 tools") por contexto;
  subconjunto de VoiceCommandType (simetria SQ 14).
- `providers.ts` -- clientes fetch: Gemini, Anthropic, OpenAI-compatible.
- `provider_models.ts` -- listado de modelos (live con clave / estatico).
- `router.ts` -- desambiguacion + validacion + umbral de confianza.
- `routes/brain.ts` -- GET/PUT /api/brain/config, GET /api/brain/models,
  POST /api/brain/resolve.

Cliente:
- `src/voice/resolveCommand.ts` -- resolvedor camino 1 (IA) con fallback
  al matcher.
- `src/voice/useVoice.ts` -- soporte de resolucion asincrona.
- `src/components/BrainSettings.tsx` -- panel de configuracion del
  asistente (boton "Asistente" en la topbar).
- `src/lib/api.ts` -- endpoints del Brain.

## 4. Pruebas

- `tests/brain/catalog-symmetry.test.ts` -- el Brain no puede elegir un
  comando que el cliente no sepa ejecutar (SQ 14).
- `tests/brain/router.test.ts` -- parseo, validacion, umbral, fail-closed.
- `tests/brain/resolve-command.test.ts` -- camino 1 + fallback.
- `tests/brain/safety-net.test.ts` -- todas las frases canonicas andan
  sin Brain (offline / sin clave).
- `tests/brain/live-bench.test.ts` -- bench de eficiencia REAL contra el
  modelo configurado (gated `BRAIN_LIVE=1`). Es el instrumento para
  empujar la eficiencia hacia el 100% una vez que hay clave.

Estado: 239/239 tests verdes + typecheck limpio en el momento de la
adenda. La eficiencia de interpretacion en vivo se mide con el bench y
depende de la clave del owner (ver seccion 5).

## 5. Pendiente honesto

El "100% de eficiencia" sobre lenguaje natural NO es una constante que
se pueda afirmar sin medir contra el modelo real. El bench
(`live-bench.test.ts`) corre el banco de frases contra el proveedor
configurado y reporta el porcentaje; sin una clave de API no hay nada
honesto que medir. Una vez cargada la clave, se itera el prompt del
catalogo (`server/brain/catalog.ts`) y el banco hasta el umbral.
