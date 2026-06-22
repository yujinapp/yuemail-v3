# Yuemail v0.6.0 -- Instructivo para el equipo de pruebas manuales

Gracias por ayudarnos a probar Yuemail. Este documento explica como
conseguir el producto, prepararlo, ejecutar los casos de prueba y
devolvernos los resultados. No hace falta saber programar.

Documento hermano: `CASOS_DE_PRUEBA_v0.6.0.md` (en esta misma
carpeta) contiene los casos, uno por uno, con su resultado esperado.

> **Novedad de la v0.6.0: la Voz de Google (escuchar y hablar).** Antes,
> Yuemail escuchaba y hablaba SOLO con el navegador. Ahora puede usar
> Google para las dos cosas: un **oido** mas preciso (entiende mejor lo
> que decis, util sobre todo para voces no estandar) y una **voz** mas
> clara y natural. Viene **encendida por defecto**. Por eso ahora hay
> DOS configuraciones de voz a hacer al principio: el **Asistente**
> (la IA que elige la accion, ya estaba en la v0.5.0) y la **Voz**
> (escuchar/hablar con Google, nueva). Son los Pasos 1 y 2 de la
> seccion 4, antes que la cuenta de correo.

## 1. Que es Yuemail

Un cliente de correo a voz, para una sola persona, que corre en tu
computadora. Permite dictar un documento en castellano, firmarlo y
enviarlo por email como adjunto Word (.docx). Esta pensado para
personas con discapacidad motriz y/o visual: todo lo que se hace con
el mouse se puede hacer con la voz.

Hay **dos capas de inteligencia**, separadas y ambas con red de
seguridad. Conviene no confundirlas:

- **Voz (escuchar / hablar) -- camino 1: Google.** El *oido* (pasar tu
  voz a texto) y la *voz* (leerte las cosas en voz alta) los hace
  Google. Camino 2 (red de seguridad): si la apagas, falta la clave o
  se cae internet, Yuemail escucha y habla con el **navegador**, como
  antes. Asi nadie queda mudo ni sordo.
- **Asistente (entender el pedido) -- camino 1: IA / Brain.** Una vez
  que tu voz es texto, la IA interpreta el pedido en lenguaje natural
  ("mandale esto a mi hija", "fijate si me llego algo") y elige la
  accion. Camino 2: una lista de **frases fijas** ("nuevo documento",
  "leer bandeja") que funcionan siempre, incluso sin IA, sin clave o
  sin internet.

Resumen: **la Voz oye y habla; el Asistente entiende.** Cada una puede
usar Google/IA (camino 1) o caer al navegador/frases fijas (camino 2).

Es open source (licencia MIT), gratuito, repositorio publico:
https://github.com/yujinapp/yuemail-v3

## 2. Que necesitas antes de empezar

- Una computadora con Windows 10/11, macOS o Linux.
- **Node.js 18 o mas nuevo**. Para verificar: abri una terminal
  (en Windows: PowerShell) y escribi `node --version`. Si da error
  o un numero menor a 18, instalalo desde https://nodejs.org
  (boton "LTS").
- **Google Chrome o Microsoft Edge** (el respaldo de voz del navegador
  tambien anda en Safari; en Firefox NO hay voz de navegador y eso es
  esperado, no un bug).
- Un **microfono** que funcione (el de la notebook sirve). El navegador
  te va a pedir permiso para usarlo: hay que **Permitir**.
- **Una clave de API de Google** para la Voz (escuchar/hablar). Es la
  pieza nueva de la v0.6.0. Una sola clave de Google sirve para las dos
  direcciones, pero en la consola de Google hay que:
  - habilitar **Cloud Speech-to-Text** (oido) y **Cloud Text-to-Speech**
    (voz), y
  - **quitar la restriccion de "sitios web"** de la clave (la usa el
    servidor de Yuemail, no el navegador; con la restriccion de sitio
    web, Google la rechaza). Si no sabes como, en la carpeta `docs/`
    hay una guia paso a paso (`como-destrabar-tu-clave-de-google...`).
- **Una clave de API de un proveedor de IA** para el Asistente.
  Recomendamos **Google Gemini** (proveedor por defecto, con capa
  gratuita): sacala en https://aistudio.google.com/apikey. Puede ser
  una clave de Google distinta de la de Voz. Otros proveedores
  soportados: Anthropic, OpenAI, DeepSeek, xAI, Mistral, Qwen, Z.ai, y
  Ollama (este ultimo corre local y NO necesita clave).
- Una **cuenta de correo de prueba**. Recomendamos crear una cuenta
  de Gmail nueva SOLO para estas pruebas (no uses tu cuenta
  personal). En Gmail necesitas generar una "contrasena de
  aplicacion": myaccount.google.com > Seguridad > Verificacion en
  dos pasos (activala) > Contrasenas de aplicaciones. Guarda esa
  contrasena de 16 letras: es la que va en Yuemail.
- Una segunda direccion de correo a la que puedas mirar la bandeja
  de entrada, para verificar que los envios llegan (puede ser tu
  correo personal: solo va a RECIBIR mensajes de prueba).

> **Privacidad -- importante y honesto.** Con las funciones de Google
> ENCENDIDAS sale informacion de tu maquina, siempre desde el SERVIDOR
> de Yuemail (nunca desde el navegador) y solo hacia Google:
> - la **Voz** manda a Google el **audio** de lo que decis (para
>   transcribirlo) y el **texto** que la app te lee (para generar la
>   voz);
> - el **Asistente** manda a Google (o al proveedor que elijas) el
>   **texto** de tu pedido ya transcripto, para interpretarlo.
>
> Tus claves de API se guardan cifradas en tu maquina y NUNCA viajan al
> navegador ni a nosotros. Tu contrasena de correo y tus documentos NO
> se mandan ni a la Voz ni al Asistente. Si preferis que NADA salga de
> tu computadora, podes apagar la Voz de Google (usa el navegador) y
> apagar el Asistente (usa las frases fijas), o elegir el proveedor
> **Ollama** para el Asistente. Todo esto se prueba en las secciones
> VOICE y BRAIN de los casos.

## 3. Como instalar el producto

En la terminal:

```
npm install -g @yujinapp/yuemail
```

Para verificar que quedo instalado:

```
yuemail version
```

Debe responder `0.6.0` (o superior). Si la terminal dice que no
conoce el comando `yuemail`, cerrala, abri una nueva y proba de
nuevo.

Para arrancar la aplicacion:

```
yuemail
```

Se abre solo el navegador en `http://127.0.0.1:5180`. Si no se
abre, abri Chrome/Edge a mano y entra a esa direccion. Para apagar
la aplicacion: en la terminal apreta Ctrl+C.

Si ya tenias una version anterior instalada:

```
npm update -g @yujinapp/yuemail
```

## 4. Primera configuracion (en este orden)

### Paso 1 -- Configurar la Voz de Google (escuchar y hablar) PRIMERO

1. Con la app abierta, hace click en el boton **"Voz"** (arriba a la
   derecha).
2. Se abre la ventana **"Voz (escuchar y hablar)"**. Vas a ver:
   - un interruptor **"Voz de Google encendida"** (viene marcado),
   - el **Idioma** (viene en Espanol Argentina),
   - la **Velocidad** al hablar,
   - el campo **Clave de Google**.
3. Pega tu clave de Google (la de Voz, con Speech-to-Text y
   Text-to-Speech habilitados y sin restriccion de sitio web) en el
   campo Clave de Google.
4. Apreta **"Probar voz"**: deberias ESCUCHAR a Yuemail diciendo una
   frase con la voz de Google. Si la escuchas, la clave anda. Si te
   avisa que no pudo, revisa la clave (lo mas comun: falta habilitar un
   servicio o quitar la restriccion de sitio web).
5. Apreta **Guardar**. Aviso "Voz configurada".

Con esto el oido y la voz de Google (camino 1) quedan activos. Si NO
pones clave, Yuemail escucha y habla igual con el navegador (camino 2)
-- eso tambien hay que probarlo (seccion VOICE).

### Paso 2 -- Configurar el Asistente de voz (Brain)

1. Hace click en el boton **"Asistente"** (al lado del boton "Voz").
2. Se abre la ventana **"Asistente de voz (IA)"**: interruptor
   "Asistente de voz encendido" (marcado), Proveedor ("Google Gemini"),
   Modelo (Gemini Flash Lite), y el campo Clave de API.
3. Pega tu clave de API de IA y apreta **Guardar**.
4. Aviso "Asistente de voz configurado". Si avisa que "falta la clave",
   revisa que la pegaste completa y volve a guardar.

Si NO pones clave, el Asistente queda encendido pero sin interpretar;
Yuemail seguira andando con los comandos fijos (camino 2) -- eso
tambien hay que probarlo (seccion BRAIN).

### Paso 3 -- Configurar la cuenta de correo

1. Hace click en el **engranaje**.
2. Escribi tu direccion de correo de prueba; Yuemail detecta solo los
   servidores. Agrega la contrasena de aplicacion.
3. (Opcional) "Probar conexion" para verificar en vivo.
4. **Guardar**. La configuracion queda cifrada en la boveda.

## 5. Como ejecutar las pruebas

1. Abri `CASOS_DE_PRUEBA_v0.6.0.md` al lado de la app.
2. Ejecuta los casos **en orden dentro de cada seccion** (algunos
   dependen del anterior; cuando es asi, la precondicion lo dice). Las
   secciones **VOICE** y **BRAIN** van primero porque el resto de las
   pruebas de voz asumen la Voz y el Asistente ya configurados.
3. Para cada caso anota el resultado en la planilla (seccion 6):
   - **PASA**: ocurrio exactamente lo esperado.
   - **FALLA**: ocurrio otra cosa (anota QUE ocurrio, palabra por
     palabra si hay un mensaje en pantalla).
   - **BLOQUEADO**: no se pudo probar (por ejemplo, depende de un
     caso anterior que fallo). Anota por que.
   - **N/A**: no aplica a tu entorno (por ejemplo casos de voz si
     tu microfono no funciona). Anota por que.
4. Si algo falla, intentalo UNA vez mas antes de marcarlo FALLA
   (a veces el oido entiende mal una palabra; eso vale anotarlo igual
   como observacion).
5. Hay dos tipos de frases de voz en los casos:
   - Entre comillas exactas ("nuevo documento"): son comandos fijos;
     decilos tal cual.
   - Marcadas como **(pedido libre)**: son ejemplos para el asistente;
     podes decir eso o algo parecido con tus palabras. Sirven para
     medir que tan bien interpreta la IA.
   En ambos casos: microfono encendido, hablando natural, sin gritar.
6. Saca captura de pantalla de TODA falla. Nombra el archivo con
   el id del caso (por ejemplo `ENV-03.png`).

Tiempo estimado de la corrida completa: 3 a 4 horas. Se puede
cortar y retomar (la configuracion de la Voz, del Asistente y de la
cuenta quedan guardadas).

## 6. Como anotar y devolver los resultados

Al final de `CASOS_DE_PRUEBA_v0.6.0.md` hay una planilla con una
fila por caso. Podes:

- copiarla a una hoja de calculo (Excel / Google Sheets), o
- editar el .md directamente.

Por cada caso completa: resultado (PASA / FALLA / BLOQUEADO / N/A),
observaciones, y nombre del archivo de captura si lo hay.

Al terminar, completa tambien el bloque "Datos de la corrida"
(quien probo, fecha, sistema operativo, navegador y version,
proveedor de correo usado, **proveedor y modelo de IA usado** del
Asistente, y **si la Voz de Google quedo encendida o usaste el
navegador**).

**Envia todo a: contact@yujin.app** con asunto
`QA Yuemail v0.6.0 -- <tu nombre>`, adjuntando la planilla y las
capturas. Si encontras algo grave que rompe todo (no instala, no
arranca), no esperes a terminar la corrida: avisanos de inmediato
al mismo correo.

## 7. Reglas de oro

- Anota lo que VISTE, no lo que crees que deberia pasar.
- Un caso = un resultado. No mezcles observaciones de dos casos.
- Los textos exactos de los mensajes de error valen oro: copialos
  tal cual aparecen.
- Si dudas entre PASA y FALLA, marca FALLA y explica la duda en
  observaciones.
- Tu contrasena de aplicacion y tus claves de API son tuyas: no las
  incluyas en la planilla ni en las capturas (si una captura las
  muestra, tachalas antes de enviarla).
- En los pedidos libres del asistente, anota TEXTUAL lo que dijiste y
  QUE accion hizo la app: asi medimos la eficiencia real de la IA.
