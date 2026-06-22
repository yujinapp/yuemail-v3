# Yuemail v0.6.0 -- Casos de prueba para QA manual

Leer primero: `INSTRUCTIVO_TESTERS.md` (como instalar, como anotar,
a donde enviar los resultados). La planilla de resultados esta al
final de este documento.

Convenciones:

- Las frases entre comillas ("nuevo documento") se DICEN por voz
  con el microfono encendido, salvo que el paso diga "escribi". Son
  comandos fijos (camino 2): andan con o sin asistente.
- Las frases marcadas **(pedido libre)** son ejemplos para el
  asistente de IA (camino 1): podes decir eso o algo parecido con tus
  palabras. Miden que tan bien interpreta la IA.
- Hay DOS capas de voz, no confundirlas: la **Voz** (boton "Voz") es
  el OIDO y la VOZ (Google o navegador); el **Asistente** (boton
  "Asistente") es la IA que ENTIENDE el pedido. La Voz pasa tu audio a
  texto; el Asistente decide la accion sobre ese texto.
- "La app" = el navegador en http://127.0.0.1:5180.
- "Aviso" = el cartel que aparece abajo en la pantalla (toast).
- "El asistente" = la IA / Brain que interpreta los pedidos libres.
- Salvo indicacion contraria, cada seccion arranca con la app
  abierta y sin ninguna ventana emergente abierta.

---

## Seccion VOICE -- Voz de Google: escuchar y hablar [PRIMERO]

Esta seccion va antes que todo lo demas junto con BRAIN: la Voz es el
camino 1 por defecto para oir y hablar, y el resto de las pruebas de
voz la asumen configurada. Necesitas la clave de Google de Voz, con
Speech-to-Text y Text-to-Speech habilitados y sin restriccion de sitio
web (ver INSTRUCTIVO, seccion 2).

### VOICE-01 -- Abrir el panel de Voz
- Pasos: click en el boton "Voz" (arriba a la derecha).
- Esperado: se abre la ventana "Voz (escuchar y hablar)" con el
  interruptor "Voz de Google encendida" MARCADO, un selector de
  Idioma (Espanol Argentina), un control de Velocidad y el campo
  "Clave de Google".

### VOICE-02 -- La clave nunca se muestra
- Pasos: en "Clave de Google" escribi algo; mira como se ve; cerra y
  reabri el panel.
- Esperado: el campo se muestra como puntos (tipo contrasena) y al
  reabrir aparece vacio (la clave guardada NO se vuelve a mostrar; si
  ya habia una, dice "ya configurada").

### VOICE-03 -- Probar voz: se escucha la voz de Google (TTS, camino 1)
- Precondicion: VOICE-01, parlantes/auriculares con volumen.
- Pasos: pega tu clave de Google real y apreta "Probar voz".
- Esperado: ESCUCHAS a Yuemail diciendo una frase con una voz clara y
  natural (la de Google), y aparece el aviso "Voz de Google
  reproducida". Si avisa que no pudo, revisa la clave (lo mas comun:
  falta habilitar Text-to-Speech o quitar la restriccion de sitio
  web); anota TEXTUAL el aviso.

### VOICE-04 -- Guardar la Voz
- Precondicion: VOICE-03.
- Pasos: apreta "Guardar".
- Esperado: aviso "Voz configurada" y la ventana se cierra.

### VOICE-05 -- Oido de Google: hablar natural y que entienda (STT, camino 1)
- Precondicion: VOICE-04; cuenta de correo configurada o no (da igual);
  microfono encendido; con internet.
- Pasos: deci el comando fijo "leer bandeja" hablando natural, a
  velocidad normal.
- Esperado: la app ejecuta el comando (lee la bandeja o avisa que
  falta configurar la cuenta). Con clave + internet, quien transcribio
  tu voz fue el oido de Google. Anota si entendio bien al primer
  intento.

### VOICE-06 -- Velocidad de la voz
- Precondicion: VOICE-04.
- Pasos: abri "Voz", mové la Velocidad mas alta, apreta "Probar voz".
- Esperado: la frase de prueba se escucha mas rapido. (Dejala en un
  valor comodo y Guardar.)

### VOICE-07 -- Red de seguridad: Voz de Google apagada cae al navegador
- Pasos: abri "Voz", DESmarca "Voz de Google encendida", Guardar.
  Despues, con microfono on, deci "nuevo documento".
- Esperado: el comando funciona igual (ahora el oido es el del
  navegador). La app NUNCA queda sin escuchar. (En Firefox, donde no
  hay voz de navegador, el boton de microfono queda deshabilitado: eso
  es esperado.)

### VOICE-08 -- Red de seguridad: sin internet, la voz cae al navegador
- Precondicion: volve a ENCENDER la Voz de Google (VOICE-04). Desconecta
  el wifi / cable de red.
- Pasos: deci "nuevo documento".
- Esperado: sigue funcionando (al no poder hablar con Google, Yuemail
  usa el navegador para oir y hablar). La app sigue respondiendo. Volve
  a conectar la red al terminar.

---

## Seccion BRAIN -- Asistente de voz (IA) [PRIMERO]

Esta seccion va antes que todo lo demas: el asistente es el camino 1
por defecto y el resto de las pruebas de voz lo asumen configurado.
Necesitas una clave de API (ver INSTRUCTIVO, seccion 2).

### BRAIN-01 -- Abrir el panel del asistente
- Pasos: click en el boton "Asistente" (arriba a la derecha).
- Esperado: se abre la ventana "Asistente de voz (IA)" con el
  interruptor "Asistente de voz encendido" MARCADO, Proveedor en
  "Google Gemini", un Modelo de Gemini (Flash Lite) y el campo
  "Clave de API".

### BRAIN-02 -- Lista de proveedores
- Precondicion: BRAIN-01.
- Pasos: abri el desplegable "Proveedor de IA".
- Esperado: aparecen varios (Google Gemini, Anthropic Claude, OpenAI,
  DeepSeek, xAI Grok, Mistral, Qwen, Z.ai/GLM, Ollama local).

### BRAIN-03 -- La clave nunca se muestra
- Pasos: en "Clave de API" escribi algo; mira como se ve; cerra y
  reabri el panel.
- Esperado: el campo se muestra como puntos (tipo contrasena) y al
  reabrir aparece vacio (la clave guardada NO se vuelve a mostrar; si
  ya habia una, dice "ya configurada").

### BRAIN-04 -- Guardar la clave
- Pasos: pega tu clave de API real y apreta "Guardar".
- Esperado: aviso "Asistente de voz configurado" y la ventana se
  cierra.

### BRAIN-05 -- Pedido libre simple (la IA elige la accion)
- Precondicion: BRAIN-04, microfono encendido.
- Pasos: deci **(pedido libre)** "che, fijate si me llego algun correo".
- Esperado: la app lee la bandeja (igual que "leer bandeja"). Anota
  TEXTUAL lo que dijiste y que hizo.

### BRAIN-06 -- Pedido libre con dato (correo)
- Pasos: deci **(pedido libre)** "quiero mandarle esto a juan arroba
  ejemplo punto com".
- Esperado: se abre el dialogo de envio con el destinatario
  juan@ejemplo.com cargado.

### BRAIN-07 -- Pedido libre para configurar
- Pasos: deci **(pedido libre)** "donde configuro mi correo".
- Esperado: se abre la ventana de configuracion del correo.

### BRAIN-08 -- Red de seguridad: asistente apagado
- Pasos: abri "Asistente", DESmarca "Asistente de voz encendido",
  Guardar. Despues deci "leer bandeja" (comando fijo) y luego un
  pedido libre cualquiera.
- Esperado: el comando fijo "leer bandeja" funciona igual; el pedido
  libre puede no entenderse (es esperado: sin asistente solo andan los
  comandos fijos). La app NUNCA queda inutilizable.

### BRAIN-09 -- Red de seguridad: sin internet
- Precondicion: volve a ENCENDER el asistente (BRAIN-04). Desconecta
  el wifi / cable de red.
- Pasos: deci el comando fijo "nuevo documento".
- Esperado: funciona igual (el comando fijo no necesita internet). Un
  pedido libre puede tardar y caer al comando fijo o no entenderse;
  lo importante es que la app sigue respondiendo. Volve a conectar la
  red al terminar.

### BRAIN-10 -- (Opcional) IA local con Ollama
- Solo si tenes Ollama instalado (ollama.com). Elegi proveedor
  "Ollama (local, sin clave)", Guardar, y proba un pedido libre.
- Esperado: funciona sin clave y sin que nada salga de tu maquina.
  Si no tenes Ollama, marca N/A.

### BRAIN-11 -- CRITICO: el asistente NO ejecuta lo que no pediste
- Precondicion: BRAIN-04 (asistente encendido y con clave),
  microfono on, sin ninguna ventana emergente abierta.
- Pasos: deci, uno por uno, estos pedidos que NO son comandos:
  - una negacion: "no, no lo mandes todavia";
  - charla suelta: "que lindo dia hace hoy".
- Esperado: en NINGUNO de los dos casos la app ejecuta una accion
  (no abre el envio, no apaga el microfono, no abre configuracion,
  etc.). A lo sumo avisa que no entendio. Para una persona que
  depende de la app, ejecutar el comando equivocado es peor que no
  hacer nada: si la app dispara CUALQUIER accion con estas frases,
  marca FALLA con severidad alta y anota TEXTUAL que hizo.

---

## Seccion INS -- Instalacion y CLI

### INS-01 -- Instalacion global desde npm
- Pasos: en una terminal: `npm install -g @yujinapp/yuemail`.
- Esperado: termina sin errores (warnings amarillos son aceptables).

### INS-02 -- Version
- Precondicion: INS-01.
- Pasos: `yuemail version`.
- Esperado: imprime `0.6.0` (o superior).

### INS-03 -- Ayuda
- Pasos: `yuemail help`.
- Esperado: lista los subcomandos (start, vault, version, help) en
  texto entendible.

### INS-04 -- Arranque con navegador
- Pasos: `yuemail`.
- Esperado: la terminal informa que el servidor escucha en
  127.0.0.1:5180 y el navegador se abre solo mostrando la app
  (titulo "Yuemail", barra de botones, editor).

### INS-05 -- Solo loopback (privacidad de red)
- Precondicion: INS-04 (la app corriendo).
- Pasos: desde OTRO dispositivo en la misma red wifi (por ejemplo
  el celular), intenta entrar a `http://<ip-de-tu-pc>:5180`.
- Esperado: NO carga (la app solo atiende a la propia maquina).

### INS-06 -- Apagado limpio
- Pasos: en la terminal donde corre yuemail, apreta Ctrl+C; despues
  recarga la pestana del navegador.
- Esperado: el proceso termina; la pestana ya no carga la app.

### INS-07 -- Arranque sin navegador
- Pasos: `yuemail start`; espera 5 segundos.
- Esperado: el servidor arranca pero NO se abre ningun navegador.
  Abriendo a mano 127.0.0.1:5180 la app carga. (Deja la app
  corriendo para las secciones siguientes.)

### INS-08 -- Vault por CLI: listar
- Pasos: `yuemail vault list` (en otra terminal, con la app corriendo o no).
- Esperado: lista NOMBRES de claves (puede estar vacia la primera
  vez). Nunca muestra valores/contrasenas.

---

## Seccion CFG -- Configuracion de la cuenta (engranaje)

### CFG-01 -- Abrir configuracion con el boton
- Pasos: click en el engranaje (arriba a la derecha).
- Esperado: se abre la ventana "Configuracion del correo" con la
  linea de estado (IMAP / SMTP / Identidad "sin configurar" la
  primera vez) y una nota de como dictar campos.

### CFG-02 -- Abrir configuracion por voz
- Pasos: cerra la ventana (boton Cancelar). Encende el microfono
  (boton "Encender microfono"). Deci "abrir configuracion".
- Esperado: la ventana se abre.

### CFG-03 -- Autodeteccion de servidores con solo la direccion
- Precondicion: ventana de configuracion abierta.
- Pasos: escribi tu direccion de prueba de Gmail en "Direccion de
  correo" y hace click afuera del campo (o apreta Tab).
- Esperado: en unos segundos los campos avanzados se completan
  solos (imap.gmail.com / 993 / SSL, smtp.gmail.com / 465 / SSL) y
  aparece un aviso de servidores detectados. Aparece una nota
  avisando que Gmail requiere contrasena de aplicacion.

### CFG-04 -- Probar conexion con contrasena mala
- Precondicion: CFG-03.
- Pasos: escribi una contrasena inventada (por ejemplo
  `incorrecta123`) y apreta "Probar conexion".
- Esperado: el aviso reporta fallo de IMAP y/o SMTP con un motivo
  legible. La app NO se cuelga.

### CFG-05 -- Probar conexion con la contrasena de aplicacion real
- Pasos: reemplaza por tu contrasena de aplicacion real, apreta
  "Probar conexion".
- Esperado: aviso "IMAP OK / SMTP OK".

### CFG-06 -- Guardar la configuracion
- Precondicion: CFG-05.
- Pasos: completa "Tu nombre" con tu nombre, apreta "Guardar".
- Esperado: aviso de configuracion guardada (menciona que va
  cifrada); la ventana se cierra. Reabriendo el engranaje, la linea
  de estado dice "configurado" en IMAP, SMTP e Identidad, y los
  campos aparecen vacios (esto es correcto: la app nunca te
  re-muestra lo guardado).

### CFG-07 -- La contrasena guardada se conserva al re-guardar
- Precondicion: CFG-06.
- Pasos: reabri el engranaje, escribi de nuevo tu direccion, deja
  la contrasena VACIA, deteccion automatica, "Guardar".
- Esperado: guarda sin pedir contrasena (el placeholder avisa que
  vacia = conservar la guardada).

### CFG-08 -- Dictar un campo de configuracion
- Precondicion: ventana de configuracion abierta, microfono on.
- Pasos: deci "campo nombre"; cuando el aviso diga que dictes,
  deci tu nombre completo.
- Esperado: el aviso anuncia el campo y el valor dictado aparece
  en "Tu nombre".

### CFG-09 -- Dictar la contrasena no la lee en voz alta
- Pasos: deci "campo contrasena"; deci letras y numeros.
- Esperado: el aviso reporta SOLO la cantidad de caracteres
  capturados, nunca el contenido.

### CFG-10 -- "borrar campo" y "fin campo"
- Pasos: deci "borrar campo nombre" (debe vaciar el campo y quedar
  esperando dictado); deci "fin campo".
- Esperado: tras "borrar campo nombre" el campo queda vacio; tras
  "fin campo" el aviso confirma que el campo quedo libre.

### CFG-11 -- Casillas SSL por voz
- Pasos: deci "campo ssl imap"; deci "no"; despues deci "campo ssl
  imap" y deci "si".
- Esperado: la casilla SSL de IMAP se desmarca y se vuelve a
  marcar, con aviso en cada cambio. (Dejala MARCADA al terminar.)

### CFG-12 -- Cerrar configuracion por voz
- Pasos: deci "cancelar".
- Esperado: la ventana se cierra sin guardar cambios nuevos.

---

## Seccion DOC -- Editor y documentos

### DOC-01 -- Documento nuevo por boton
- Pasos: click en `Nuevo documento`.
- Esperado: editor vacio, aviso "Documento nuevo abierto."

### DOC-02 -- Titulo y parrafo a mano
- Pasos: escribi un titulo ("Informe de prueba QA") y un parrafo
  de texto en el editor.
- Esperado: el texto queda y se puede editar libremente.

### DOC-03 -- Documento nuevo por voz guarda el anterior
- Precondicion: DOC-02, microfono on.
- Pasos: deci "nuevo documento"; despues deci "abrir documento
  informe".
- Esperado: el editor se vacia; al abrir, vuelve el documento
  "Informe de prueba QA" completo, con aviso "Documento abierto: ...".

### DOC-04 -- Abrir documento sin nombre abre el mas reciente
- Pasos: deci "abrir documento" (sin nombre).
- Esperado: abre el documento mas reciente con aviso.

### DOC-05 -- Persistencia entre reinicios
- Pasos: apaga la app (Ctrl+C en la terminal) y volvela a arrancar
  (`yuemail`); deci o clickea "abrir documento".
- Esperado: el documento de DOC-02 sigue existiendo completo.

---

## Seccion DIC -- Dictado en el documento

### DIC-01 -- Iniciar y terminar dictado
- Precondicion: microfono on, editor visible.
- Pasos: deci "iniciar dictado"; deci dos frases separadas, con
  pausa entre ellas; deci "fin dictado".
- Esperado: cada frase aparece como parrafo nuevo al final del
  documento. "fin dictado" frena la transcripcion (lo que digas
  despues ya no se agrega).

### DIC-02 -- El dictado no escribe con una ventana abierta
- Precondicion: dictado iniciado (deci "iniciar dictado").
- Pasos: deci "guardar firma" -- se abre el pad de firma. Deci una
  frase cualquiera ("esto no deberia aparecer"). Deci "cancelar".
- Esperado: la frase NO aparece en el documento al cerrar el pad.

### DIC-03 -- Tolerancia a muletillas
- Pasos: deci "por favor, nuevo documento".
- Esperado: funciona igual que "nuevo documento".

---

## Seccion FIR -- Firma

### FIR-01 -- Abrir el pad por voz
- Pasos: deci "guardar firma".
- Esperado: se abre la ventana "Guardar firma" con lienzo, campo de
  nombre, y la nota de dictado por voz.

### FIR-02 -- Dibujar y guardar
- Pasos: dibuja un garabato con el mouse en el lienzo; click
  "Guardar".
- Esperado: aviso "Firma guardada.", la ventana se cierra.

### FIR-03 -- Insertar la firma en el documento
- Precondicion: FIR-02, un documento abierto.
- Pasos: deci "firmar" (o click en `Firmar`).
- Esperado: la imagen de la firma aparece al final del documento.

### FIR-04 -- Dictar el nombre para firma cursiva (PND-003, nuevo en v0.4.0)
- Pasos: deci "guardar firma"; deci "campo nombre"; deci tu nombre
  ("Ana Garcia"); deci "fin campo"; deci "generar"; deci "guardar".
- Esperado: el nombre dictado aparece en el campo; "generar" lo
  dibuja en cursiva en el lienzo; "guardar" persiste y cierra.

### FIR-05 -- Mientras dictas el nombre, los verbos del pad no disparan (nuevo en v0.4.0)
- Pasos: deci "guardar firma"; deci "campo nombre"; deci
  "Guadalupe Borrero" (nombre que contiene un sonido parecido a
  "borrar").
- Esperado: el lienzo NO se borra; "Guadalupe Borrero" queda como
  texto del campo de nombre. Despues deci "fin campo" y "cancelar".

### FIR-06 -- "borrar" sin campo armado limpia el lienzo
- Pasos: deci "guardar firma"; dibuja algo; deci "borrar".
- Esperado: el lienzo queda en blanco (sin campo armado, "borrar"
  es el verbo normal del pad). Deci "cancelar" para salir.

### FIR-07 -- Firmar sin firma guardada abre el pad
- Pasos: (solo si podes borrar `~/.yuemail/signatures/default.png`
  o probas en una maquina limpia) deci "firmar" sin firma guardada.
- Esperado: aviso de que no hay firma y el pad se abre solo.

---

## Seccion ENV -- Envio de correo

### ENV-01 -- Abrir el dialogo de envio por voz con destinatario
- Precondicion: cuenta configurada (CFG-06), documento con titulo
  y texto abierto, microfono on.
- Pasos: deci "enviar a <tu-segunda-direccion hablada>" (por
  ejemplo "enviar a ana arroba gmail punto com").
- Esperado: se abre "Enviar correo" con el destinatario ya
  cargado (en minusculas, con @ y puntos correctos), el asunto
  igual al titulo del documento, un cuerpo cordial por defecto y
  la casilla de adjunto marcada.

### ENV-02 -- Confirmar envio por voz
- Precondicion: ENV-01.
- Pasos: deci "confirmar".
- Esperado: aviso "Enviado: <direccion>". La ventana se cierra.

### ENV-03 -- El correo llega con el adjunto Word
- Precondicion: ENV-02.
- Pasos: mira la bandeja de tu segunda direccion.
- Esperado: llega el correo con el asunto del documento y un
  adjunto .docx que se abre en Word/Google Docs mostrando titulo,
  parrafos y la imagen de la firma.

### ENV-04 -- Envio por boton
- Pasos: click "Componer envio" (panel derecho); completa
  destinatario a mano; click "Enviar".
- Esperado: igual que ENV-02/03.

### ENV-05 -- Cancelar no envia
- Pasos: abri el dialogo de envio; deci "cancelar".
- Esperado: la ventana se cierra y NO llega ningun correo.

### ENV-06 -- Envio sin adjunto
- Pasos: abri el dialogo, desmarca "Adjuntar el documento", envia.
- Esperado: el correo llega SIN adjunto.

### ENV-07 -- Destinatario invalido da error legible
- Pasos: abri el dialogo, escribi `noesuncorreo` como
  destinatario, envia.
- Esperado: aviso de error en castellano entendible; la app sigue
  funcionando.

### ENV-08 -- Globales suspendidas dentro del dialogo
- Pasos: con el dialogo de envio abierto y microfono on, deci
  "firmar".
- Esperado: NO pasa nada (ni se inserta firma atras, ni se cierra
  el dialogo). Deci "cancelar" para salir.

---

## Seccion VEN -- Dictado dentro de la ventana de envio (PND-003, nuevo en v0.4.0)

### VEN-01 -- Nota de ayuda visible
- Pasos: abri el dialogo de envio.
- Esperado: arriba de los campos hay una nota que explica "campo
  destinatario / asunto / cuerpo", "fin campo", y que el cuerpo se
  agrega por parrafos.

### VEN-02 -- Dictar el destinatario
- Pasos: deci "campo destinatario"; deci "ana arroba ejemplo punto
  com".
- Esperado: el campo queda `ana@ejemplo.com`; el aviso lo anuncia.

### VEN-03 -- Dictar VARIOS destinatarios
- Pasos: deci "borrar campo"; deci "ana arroba ejemplo punto com y
  pedro arroba test punto org".
- Esperado: el campo queda `ana@ejemplo.com, pedro@test.org`
  (separados por coma).

### VEN-04 -- Dictar el asunto (reemplaza)
- Pasos: deci "campo asunto"; deci "Informe semanal de pruebas".
- Esperado: el asunto queda exactamente esa frase, reemplazando lo
  anterior.

### VEN-05 -- Dictar el cuerpo AGREGA parrafos
- Pasos: deci "campo cuerpo"; deci "Hola Ana."; pausa; deci "Te
  mando el informe que dictamos hoy."; pausa; deci "Saludos."
- Esperado: el cuerpo termina con los tres parrafos en orden, cada
  uno en su linea, SIN haber borrado el texto que ya habia (el
  primer dictado se agrega debajo del cuerpo por defecto). Cada
  frase genera un aviso "Agregado al cuerpo: ...".

### VEN-06 -- CRITICO: "enviar" en medio del dictado NO manda el correo
- Precondicion: VEN-05 (campo cuerpo todavia armado).
- Pasos: deci "manana te vuelvo a enviar el resumen completo".
- Esperado: el correo NO se envia. La frase entera aparece como un
  parrafo mas del cuerpo. Este es el caso mas importante de toda la
  seccion: si el correo se envia, marca FALLA con maxima severidad.

### VEN-07 -- CRITICO: "cancelar" en medio del dictado NO cierra la ventana
- Precondicion: campo cuerpo armado.
- Pasos: deci "tuve que cancelar la reunion de ayer".
- Esperado: la ventana NO se cierra; la frase va al cuerpo.

### VEN-08 -- "fin campo" devuelve los comandos
- Pasos: deci "fin campo"; deci "enviar".
- Esperado: tras "fin campo" el aviso confirma que el campo quedo
  libre; "enviar" AHORA SI envia el correo (aviso "Enviado: ...").
  Verifica que el correo recibido tenga el cuerpo con todos los
  parrafos dictados, incluidas las frases de VEN-06 y VEN-07.

### VEN-09 -- Casilla de adjunto por voz
- Pasos: abri de nuevo el dialogo de envio; deci "campo adjuntar";
  deci "no"; despues deci "campo adjuntar" y deci "si".
- Esperado: la casilla se desmarca y se vuelve a marcar, con aviso.

### VEN-10 -- Cambiar de campo re-arma sin "fin campo"
- Pasos: deci "campo asunto"; deci "prueba uno"; deci "campo
  cuerpo"; deci "prueba dos".
- Esperado: "prueba uno" queda en el asunto, "prueba dos" se agrega
  al cuerpo: decir "campo <otro>" cambia el campo armado
  directamente.

### VEN-11 -- Pedir un campo que no existe ayuda en vez de fallar
- Pasos: deci "campo zapato".
- Esperado: aviso que lista los campos disponibles de ESTA ventana
  (destinatario, asunto, cuerpo, adjuntar). Nada se rompe.

### VEN-12 -- Microfono seguro aun dictando
- Pasos: deci "campo cuerpo"; deci "apagar microfono".
- Esperado: el microfono se apaga (el boton vuelve a "Encender
  microfono"). La frase NO se agrega al cuerpo. Cerra el dialogo
  con el boton Cancelar.

---

## Seccion BAN -- Bandeja de entrada

### BAN-01 -- Leer bandeja por voz
- Precondicion: cuenta configurada; microfono on.
- Pasos: deci "leer bandeja".
- Esperado: aviso "<N> correos en bandeja." y el panel derecho
  lista remitente y asunto de los ultimos correos.

### BAN-02 -- Leer bandeja por boton
- Pasos: click "Leer bandeja".
- Esperado: igual que BAN-01.

### BAN-03 -- El envio de prueba aparece
- Precondicion: te enviaste un correo a la propia cuenta de prueba
  (podes repetir ENV-01/02 enviando a la misma direccion
  configurada).
- Pasos: deci "leer bandeja".
- Esperado: el correo recien enviado figura en la lista.

### BAN-04 -- Sin configuracion, error legible
- Pasos: (solo en maquina/perfil limpio sin cuenta configurada)
  deci "leer bandeja".
- Esperado: aviso de error claro pidiendo configurar la cuenta; la
  app no se cuelga.

---

## Seccion VOZ -- Microfono y comandos globales

### VOZ-01 -- Toggle del microfono por boton
- Pasos: click "Encender microfono"; observa el boton; click de
  nuevo.
- Esperado: el boton refleja el estado (encendido/apagado) en cada
  click.

### VOZ-02 -- "detener voz"
- Pasos: con el microfono encendido, deci "detener voz".
- Esperado: el microfono se apaga con aviso.

### VOZ-03 -- "apagar microfono" funciona con cualquier ventana abierta
- Pasos: abri el engranaje; deci "apagar microfono".
- Esperado: el microfono se apaga aunque haya un modal abierto.

### VOZ-04 -- Frases con acento y entonacion natural
- Pasos: deci "nuevo documento" hablando rapido y natural, como en
  una conversacion.
- Esperado: el comando dispara igual.

### VOZ-05 -- Frase desconocida no rompe nada
- Pasos: sin ninguna ventana abierta y sin dictado iniciado, deci
  "que lindo dia hace hoy".
- Esperado: no pasa nada (ni errores ni texto agregado).

### VOZ-06 -- Navegador sin voz degrada con dignidad
- Pasos: abri http://127.0.0.1:5180 en Firefox.
- Esperado: la app carga y todo funciona con botones; el boton de
  microfono indica "Voz no soportada" y esta deshabilitado. (Si no
  tenes Firefox, marca N/A.)

---

## Seccion ACC -- Accesibilidad

### ACC-01 -- Todo alcanzable por teclado
- Pasos: sin mouse, recorre la pantalla principal con Tab/Shift+Tab
  y activa `Nuevo documento` con Enter.
- Esperado: el foco se ve (resaltado) en cada control y el boton
  dispara con Enter.

### ACC-02 -- Modales navegables por teclado
- Pasos: abri el dialogo de envio con el teclado (Tab hasta
  "Componer envio", Enter); recorre sus campos con Tab; salida con
  el boton Cancelar.
- Esperado: todos los campos y botones del modal se alcanzan en
  orden razonable.

### ACC-03 -- Lector de pantalla anuncia los avisos
- Pasos: (si tenes NVDA en Windows o VoiceOver en macOS) activa el
  lector, ejecuta DOC-01.
- Esperado: el aviso "Documento nuevo abierto." se lee en voz alta
  sin tener que navegar hasta el. (Sin lector de pantalla: N/A.)

### ACC-04 -- Los errores se anuncian con prioridad
- Pasos: con lector activo, provoca ENV-07 (destinatario invalido).
- Esperado: el error se anuncia de inmediato (interrumpe), no se
  pierde. (Sin lector: N/A.)

### ACC-05 -- Etiquetas de los botones
- Pasos: con el lector, recorre los 4 botones de la barra y el
  engranaje.
- Esperado: cada uno anuncia su nombre con sentido ("Nuevo
  documento", "Configuracion del correo", etc.). (Sin lector: N/A.)

---

## Seccion SEG -- Privacidad y seguridad

### SEG-01 -- La boveda en disco no muestra secretos
- Precondicion: cuenta configurada (CFG-06).
- Pasos: abri el archivo `~/.yuemail/vault.json` (Windows:
  `C:\Users\<vos>\.yuemail\vault.json`) con el bloc de notas y
  busca tu contrasena de aplicacion.
- Esperado: NO aparece en texto plano (el contenido es cifrado
  ilegible).

### SEG-02 -- La API nunca devuelve valores
- Pasos: `yuemail vault list` en la terminal.
- Esperado: solo NOMBRES de claves, ningun valor.

### SEG-03 -- La contrasena dictada no se muestra en pantalla
- Pasos: repeti CFG-09 mirando los avisos.
- Esperado: en ningun momento la contrasena aparece escrita en un
  aviso (solo el conteo de caracteres).

### SEG-04 -- Sin telemetria (el navegador solo habla con tu maquina)
- Pasos: usa la app 5 minutos con la pestana Red (F12 > Network)
  abierta del navegador (inclui un par de comandos por voz y un
  "Probar voz").
- Esperado: en el navegador, solo trafico hacia 127.0.0.1:5180;
  ninguna llamada directa a dominios externos. (Las llamadas a Google
  para la Voz y el Asistente las hace el SERVIDOR de Yuemail, no el
  navegador, y son funcionales -- no telemetria; por eso no aparecen
  aca. Tu clave nunca viaja al navegador.)

### SEG-05 -- El documento queda local
- Pasos: verifica que tus documentos esten en `~/.yuemail/documents/`
  como archivos .json.
- Esperado: estan ahi, legibles, en tu maquina.

---

## Seccion REG -- Regresion rapida final

### REG-01 -- El viaje completo de punta a punta, solo con la voz
- Precondicion: cuenta configurada, firma guardada, microfono on.
- Pasos: deci, en orden: "nuevo documento" / "iniciar dictado" /
  dicta dos frases / "fin dictado" / "firmar" / "enviar a <tu
  segunda direccion hablada>" / "campo cuerpo" / dicta un saludo /
  "fin campo" / "confirmar".
- Esperado: el correo llega con el documento adjunto firmado y el
  cuerpo dictado. Cero clicks usados (excepto encender el
  microfono al principio). Cronometra: el objetivo de producto es
  que el viaje completo tome menos de 4 minutos.

---

## Planilla de resultados

Datos de la corrida:

- Tester:
- Fecha:
- Sistema operativo y version:
- Navegador y version:
- Version de Node (`node --version`):
- Version de Yuemail (`yuemail version`):
- Proveedor de correo usado:
- Proveedor y modelo de IA usado (asistente):
- Voz de Google: encendida / usaste el navegador:

| Caso | Resultado | Observaciones | Captura |
|------|-----------|---------------|---------|
| VOICE-01 | | | |
| VOICE-02 | | | |
| VOICE-03 | | | |
| VOICE-04 | | | |
| VOICE-05 | | | |
| VOICE-06 | | | |
| VOICE-07 | | | |
| VOICE-08 | | | |
| BRAIN-01 | | | |
| BRAIN-02 | | | |
| BRAIN-03 | | | |
| BRAIN-04 | | | |
| BRAIN-05 | | | |
| BRAIN-06 | | | |
| BRAIN-07 | | | |
| BRAIN-08 | | | |
| BRAIN-09 | | | |
| BRAIN-10 | | | |
| BRAIN-11 | | | |
| INS-01 | | | |
| INS-02 | | | |
| INS-03 | | | |
| INS-04 | | | |
| INS-05 | | | |
| INS-06 | | | |
| INS-07 | | | |
| INS-08 | | | |
| CFG-01 | | | |
| CFG-02 | | | |
| CFG-03 | | | |
| CFG-04 | | | |
| CFG-05 | | | |
| CFG-06 | | | |
| CFG-07 | | | |
| CFG-08 | | | |
| CFG-09 | | | |
| CFG-10 | | | |
| CFG-11 | | | |
| CFG-12 | | | |
| DOC-01 | | | |
| DOC-02 | | | |
| DOC-03 | | | |
| DOC-04 | | | |
| DOC-05 | | | |
| DIC-01 | | | |
| DIC-02 | | | |
| DIC-03 | | | |
| FIR-01 | | | |
| FIR-02 | | | |
| FIR-03 | | | |
| FIR-04 | | | |
| FIR-05 | | | |
| FIR-06 | | | |
| FIR-07 | | | |
| ENV-01 | | | |
| ENV-02 | | | |
| ENV-03 | | | |
| ENV-04 | | | |
| ENV-05 | | | |
| ENV-06 | | | |
| ENV-07 | | | |
| ENV-08 | | | |
| VEN-01 | | | |
| VEN-02 | | | |
| VEN-03 | | | |
| VEN-04 | | | |
| VEN-05 | | | |
| VEN-06 | | | |
| VEN-07 | | | |
| VEN-08 | | | |
| VEN-09 | | | |
| VEN-10 | | | |
| VEN-11 | | | |
| VEN-12 | | | |
| BAN-01 | | | |
| BAN-02 | | | |
| BAN-03 | | | |
| BAN-04 | | | |
| VOZ-01 | | | |
| VOZ-02 | | | |
| VOZ-03 | | | |
| VOZ-04 | | | |
| VOZ-05 | | | |
| VOZ-06 | | | |
| ACC-01 | | | |
| ACC-02 | | | |
| ACC-03 | | | |
| ACC-04 | | | |
| ACC-05 | | | |
| SEG-01 | | | |
| SEG-02 | | | |
| SEG-03 | | | |
| SEG-04 | | | |
| SEG-05 | | | |
| REG-01 | | | |

Total: 95 casos. Enviar a contact@yujin.app con asunto
`QA Yuemail v0.6.0 -- <tu nombre>`. Gracias!
