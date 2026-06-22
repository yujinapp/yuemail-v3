# Yuemail v0.5.0 -- Instructivo para el equipo de pruebas manuales

Gracias por ayudarnos a probar Yuemail. Este documento explica como
conseguir el producto, prepararlo, ejecutar los casos de prueba y
devolvernos los resultados. No hace falta saber programar.

Documento hermano: `CASOS_DE_PRUEBA_v0.5.0.md` (en esta misma
carpeta) contiene los casos, uno por uno, con su resultado esperado.

> **Novedad de la v0.5.0: el Asistente de voz (Brain).** Ahora Yuemail
> tiene una IA que entiende lo que pedis con tus palabras y elige la
> accion sola (no hace falta memorizar frases exactas). Viene
> **encendido por defecto**. Por eso lo PRIMERO que vas a configurar es
> el asistente (Paso 1 de la seccion 4), antes que la cuenta de correo.

## 1. Que es Yuemail

Un cliente de correo a voz, para una sola persona, que corre en tu
computadora. Permite dictar un documento en castellano, firmarlo y
enviarlo por email como adjunto Word (.docx). Esta pensado para
personas con discapacidad motriz y/o visual: todo lo que se hace con
el mouse se puede hacer con la voz.

Desde la v0.5.0 hay **dos caminos** para entender lo que decis:

- **Camino 1 -- Asistente de voz (IA / Brain):** la IA interpreta tu
  pedido en lenguaje natural ("mandale esto a mi hija", "fijate si me
  llego algo") y ejecuta la accion. Es el camino por defecto.
- **Camino 2 -- Comandos fijos (red de seguridad):** una lista de
  frases exactas ("nuevo documento", "leer bandeja"). Funcionan
  siempre, incluso con el asistente apagado, sin clave o sin internet.
  Asi nadie queda sin app.

Es open source (licencia MIT), gratuito, repositorio publico:
https://github.com/yujinapp/yuemail-v3

## 2. Que necesitas antes de empezar

- Una computadora con Windows 10/11, macOS o Linux.
- **Node.js 18 o mas nuevo**. Para verificar: abri una terminal
  (en Windows: PowerShell) y escribi `node --version`. Si da error
  o un numero menor a 18, instalalo desde https://nodejs.org
  (boton "LTS").
- **Google Chrome o Microsoft Edge** (la voz tambien anda en
  Safari; en Firefox NO hay voz y eso es esperado, no un bug).
- Un **microfono** que funcione (el de la notebook sirve).
- **Una clave de API de un proveedor de IA** (para el asistente).
  Recomendamos **Google Gemini**, que es el proveedor por defecto y
  tiene una capa gratuita: sacala en https://aistudio.google.com/apikey
  (inicia sesion con una cuenta de Google y crea una "API key";
  copiala, la vas a pegar en Yuemail). Otros proveedores soportados:
  Anthropic, OpenAI, DeepSeek, xAI, Mistral, Qwen, Z.ai, y Ollama
  (este ultimo corre local y NO necesita clave).
- Una **cuenta de correo de prueba**. Recomendamos crear una cuenta
  de Gmail nueva SOLO para estas pruebas (no uses tu cuenta
  personal). En Gmail necesitas generar una "contrasena de
  aplicacion": myaccount.google.com > Seguridad > Verificacion en
  dos pasos (activala) > Contrasenas de aplicaciones. Guarda esa
  contrasena de 16 letras: es la que va en Yuemail.
- Una segunda direccion de correo a la que puedas mirar la bandeja
  de entrada, para verificar que los envios llegan (puede ser tu
  correo personal: solo va a RECIBIR mensajes de prueba).

> **Privacidad -- importante y honesto.** Con el asistente ENCENDIDO, el
> TEXTO de lo que decis viaja al proveedor de IA elegido para que lo
> interprete (tu clave de API se guarda cifrada en tu maquina y NUNCA
> viaja al navegador ni a nosotros). Tu contrasena de correo y tus
> documentos NO se mandan a la IA. Si preferis que nada salga de tu
> computadora, podes apagar el asistente y usar los comandos fijos, o
> elegir el proveedor **Ollama** (IA local, sin internet). Esto lo
> probas en la seccion BRAIN de los casos.

## 3. Como instalar el producto

En la terminal:

```
npm install -g @yujinapp/yuemail
```

Para verificar que quedo instalado:

```
yuemail version
```

Debe responder `0.5.0` (o superior). Si la terminal dice que no
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

### Paso 1 -- Configurar el Asistente de voz (Brain) PRIMERO

1. Con la app abierta, hace click en el boton **"Asistente"** (arriba
   a la derecha, al lado del engranaje).
2. Se abre la ventana **"Asistente de voz (IA)"**. Vas a ver:
   - un interruptor **"Asistente de voz encendido"** (viene marcado),
   - el **Proveedor** (viene en "Google Gemini"),
   - el **Modelo** (viene en Gemini Flash Lite),
   - el campo **Clave de API**.
3. Pega tu clave de API en el campo Clave de API y apreta **Guardar**.
4. Deberia avisarte "Asistente de voz configurado". Si te avisa que
   "falta la clave", revisa que la pegaste completa y volve a guardar.

Con esto el camino 1 (IA) queda activo. Si NO pones clave, el
asistente queda encendido pero sin poder interpretar; Yuemail seguira
andando con los comandos fijos (camino 2) -- eso tambien hay que
probarlo (seccion BRAIN).

### Paso 2 -- Configurar la cuenta de correo

1. Hace click en el **engranaje**.
2. Escribi tu direccion de correo de prueba; Yuemail detecta solo los
   servidores. Agrega la contrasena de aplicacion.
3. (Opcional) "Probar conexion" para verificar en vivo.
4. **Guardar**. La configuracion queda cifrada en la boveda.

## 5. Como ejecutar las pruebas

1. Abri `CASOS_DE_PRUEBA_v0.5.0.md` al lado de la app.
2. Ejecuta los casos **en orden dentro de cada seccion** (algunos
   dependen del anterior; cuando es asi, la precondicion lo dice). La
   seccion **BRAIN** va primero porque el resto de las pruebas de voz
   asumen el asistente ya configurado.
3. Para cada caso anota el resultado en la planilla (seccion 6):
   - **PASA**: ocurrio exactamente lo esperado.
   - **FALLA**: ocurrio otra cosa (anota QUE ocurrio, palabra por
     palabra si hay un mensaje en pantalla).
   - **BLOQUEADO**: no se pudo probar (por ejemplo, depende de un
     caso anterior que fallo). Anota por que.
   - **N/A**: no aplica a tu entorno (por ejemplo casos de voz si
     tu microfono no funciona). Anota por que.
4. Si algo falla, intentalo UNA vez mas antes de marcarlo FALLA
   (a veces el reconocedor de voz entiende mal una palabra; eso
   vale anotarlo igual como observacion).
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
cortar y retomar (la configuracion del asistente y de la cuenta
quedan guardadas).

## 6. Como anotar y devolver los resultados

Al final de `CASOS_DE_PRUEBA_v0.5.0.md` hay una planilla con una
fila por caso. Podes:

- copiarla a una hoja de calculo (Excel / Google Sheets), o
- editar el .md directamente.

Por cada caso completa: resultado (PASA / FALLA / BLOQUEADO / N/A),
observaciones, y nombre del archivo de captura si lo hay.

Al terminar, completa tambien el bloque "Datos de la corrida"
(quien probo, fecha, sistema operativo, navegador y version,
proveedor de correo usado, **proveedor y modelo de IA usado**).

**Envia todo a: contact@yujin.app** con asunto
`QA Yuemail v0.5.0 -- <tu nombre>`, adjuntando la planilla y las
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
- Tu contrasena de aplicacion y tu clave de API son tuyas: no las
  incluyas en la planilla ni en las capturas (si una captura las
  muestra, tachalas antes de enviarla).
- En los pedidos libres del asistente, anota TEXTUAL lo que dijiste y
  QUE accion hizo la app: asi medimos la eficiencia real de la IA.
