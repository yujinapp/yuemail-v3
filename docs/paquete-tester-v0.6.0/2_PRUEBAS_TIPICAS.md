# 2. Veinte pruebas tipicas -- Yuemail v0.6.0

Estas 20 pruebas son el recorrido normal de un usuario, de la primera
vez que instala hasta enviar un correo solo con la voz. Hacelas EN
ORDEN: algunas dependen de la anterior.

## Como hacer cada prueba

- Cada prueba dice **Que hacer** y **Que tiene que pasar**.
- Las frases **entre comillas** ("nuevo documento") se DICEN por voz,
  con el microfono encendido, hablando natural, sin gritar.
- Las frases marcadas **(con tus palabras)** son para el Asistente:
  podes decir eso o algo parecido a tu manera.
- "Aviso" = el cartel que aparece abajo en la pantalla.
- Despues de cada prueba, anota el resultado en
  `PLANILLA_RESULTADOS.md` (PASA / FALLA / etc.).
- Si algo falla, proba UNA vez mas antes de marcarlo FALLA (a veces la
  voz entiende mal una palabra; anotalo igual como observacion).
- Sacale una foto a la pantalla (captura) a CUALQUIER falla.

---

### Prueba 1 -- Instalar y verificar la version
- **Que hacer:** en la terminal, `npm install -g @yujinapp/yuemail` y
  despues `yuemail version`.
- **Que tiene que pasar:** la instalacion termina sin errores en rojo y
  la version responde `0.6.0` (o mayor).

### Prueba 2 -- Arrancar la aplicacion
- **Que hacer:** escribi `yuemail` en la terminal.
- **Que tiene que pasar:** se abre solo el navegador en
  http://127.0.0.1:5180 con Yuemail (titulo "Yuemail", una barra de
  botones arriba y un editor en el medio).

### Prueba 3 -- Probar la voz de Google (que te hable)
- **Que hacer:** apreta el boton "Voz", pega tu clave de Google y
  apreta "Probar voz".
- **Que tiene que pasar:** ESCUCHAS a Yuemail decir una frase con una
  voz clara y natural, y aparece un aviso de voz reproducida. Apreta
  Guardar.

### Prueba 4 -- Que el oido de Google te entienda
- **Que hacer:** con el microfono encendido y con internet, deci
  "leer bandeja".
- **Que tiene que pasar:** la app reacciona al comando (lee la bandeja
  o avisa que falta configurar la cuenta, segun donde estes). Anota si
  te entendio al primer intento.

### Prueba 5 -- Configurar el Asistente (la IA)
- **Que hacer:** apreta el boton "Asistente", pega tu clave de IA y
  apreta Guardar.
- **Que tiene que pasar:** aviso "Asistente de voz configurado" y la
  ventana se cierra.

### Prueba 6 -- Configurar la cuenta de correo
- **Que hacer:** apreta el engranaje, escribi tu direccion de prueba,
  espera la autodeteccion, pega tu contrasena de aplicacion, apreta
  "Probar conexion" y despues "Guardar".
- **Que tiene que pasar:** "Probar conexion" avisa "IMAP OK / SMTP OK";
  al guardar, avisa que la configuracion quedo cifrada y la ventana se
  cierra.

### Prueba 7 -- Crear un documento nuevo por voz
- **Que hacer:** con el microfono encendido, deci "nuevo documento".
- **Que tiene que pasar:** el editor queda vacio y aparece el aviso
  "Documento nuevo abierto".

### Prueba 8 -- Dictar texto en el documento
- **Que hacer:** deci "iniciar dictado"; deci dos frases con una pausa
  entre ellas; deci "fin dictado".
- **Que tiene que pasar:** cada frase aparece como un parrafo nuevo en
  el documento. Despues de "fin dictado", lo que digas ya no se escribe.

### Prueba 9 -- Pedirle algo con tus palabras (Asistente)
- **Que hacer:** deci **(con tus palabras)** "che, fijate si me llego
  algun correo".
- **Que tiene que pasar:** la app lee la bandeja, igual que si hubieras
  dicho "leer bandeja". Anota TEXTUAL lo que dijiste y que hizo.

### Prueba 10 -- Dictar un correo con tus palabras (Asistente)
- **Que hacer:** deci **(con tus palabras)** "quiero mandarle esto a
  juan arroba ejemplo punto com".
- **Que tiene que pasar:** se abre la ventana de envio con el
  destinatario **juan@ejemplo.com** ya cargado.

### Prueba 11 -- Guardar y poner una firma
- **Que hacer:** deci "guardar firma"; dibuja un garabato con el mouse
  en el lienzo; apreta "Guardar". Despues, con un documento abierto,
  deci "firmar".
- **Que tiene que pasar:** la firma se guarda (aviso "Firma guardada") y
  al decir "firmar" la imagen aparece al final del documento.

### Prueba 12 -- Enviar el documento por voz
- **Que hacer:** con un documento con titulo y texto abierto, deci
  "enviar a" seguido de tu segunda direccion hablada (por ejemplo
  "enviar a ana arroba gmail punto com"); cuando se abra la ventana,
  deci "confirmar".
- **Que tiene que pasar:** se abre "Enviar correo" con el destinatario y
  el asunto cargados; al confirmar, aviso "Enviado: ..." y la ventana se
  cierra.

### Prueba 13 -- Que el correo llegue con el documento adjunto
- **Que hacer:** abri la bandeja de tu segunda direccion de correo.
- **Que tiene que pasar:** llega el correo con el asunto del documento y
  un adjunto **.docx** (Word) que, al abrirlo, muestra el titulo, los
  parrafos y la firma.

### Prueba 14 -- Leer la bandeja de entrada
- **Que hacer:** deci "leer bandeja".
- **Que tiene que pasar:** aviso con la cantidad de correos y, en el
  panel de la derecha, la lista con remitente y asunto de los ultimos.

### Prueba 15 -- IMPORTANTE: el Asistente NO ejecuta lo que no pediste
- **Que hacer:** con el microfono encendido y sin ninguna ventana
  abierta, deci una negacion: "no, no lo mandes todavia". Despues una
  charla suelta: "que lindo dia hace hoy".
- **Que tiene que pasar:** en NINGUNO de los dos casos la app hace algo
  (no abre el envio, no apaga el microfono, no abre configuracion). A lo
  sumo avisa que no entendio. *Para una persona que depende de la app,
  ejecutar la accion equivocada es peor que no hacer nada:* si la app
  dispara CUALQUIER accion con estas frases, marca FALLA con severidad
  alta y anota textual que hizo.

### Prueba 16 -- IMPORTANTE: "enviar" mientras dictas NO manda el correo
- **Que hacer:** abri la ventana de envio, deci "campo cuerpo" y
  despues deci una frase que contenga la palabra enviar, por ejemplo
  "manana te vuelvo a enviar el resumen completo".
- **Que tiene que pasar:** el correo NO se envia. La frase entera
  aparece como un parrafo del cuerpo del mensaje. Si el correo se manda,
  marca FALLA con la maxima severidad. (Para salir despues, deci "fin
  campo" y luego "cancelar".)

### Prueba 17 -- Red de seguridad: apagar la voz de Google
- **Que hacer:** apreta "Voz", DESmarca "Voz de Google encendida",
  Guardar. Despues, con el microfono encendido, deci "nuevo documento".
- **Que tiene que pasar:** el comando funciona igual (ahora escucha el
  navegador). La app nunca se queda sin oir. Volve a ENCENDER la Voz de
  Google al terminar.

### Prueba 18 -- Privacidad: las claves y la contrasena no se ven
- **Que hacer:** abri "Voz" (o "Asistente") y mira el campo de la clave
  mientras escribis; despues abri el engranaje, deci "campo contrasena"
  y deci unas letras y numeros.
- **Que tiene que pasar:** el campo de la clave se muestra como puntos y
  al reabrir aparece vacio; al dictar la contrasena, el aviso solo dice
  CUANTOS caracteres capturo, nunca el contenido.

### Prueba 19 -- Un destinatario mal escrito avisa con claridad
- **Que hacer:** abri la ventana de envio, escribi `noesuncorreo` como
  destinatario y envia.
- **Que tiene que pasar:** aparece un aviso de error claro, en
  castellano entendible, y la app sigue funcionando (no se cuelga).

### Prueba 20 -- El viaje completo, solo con la voz
- **Que hacer:** con la cuenta y la firma ya configuradas y el
  microfono encendido, deci en orden: "nuevo documento" /
  "iniciar dictado" / dos frases / "fin dictado" / "firmar" /
  "enviar a" + tu segunda direccion / "campo cuerpo" / un saludo /
  "fin campo" / "confirmar".
- **Que tiene que pasar:** el correo llega con el documento adjunto,
  firmado, y el cuerpo dictado, SIN haber usado el mouse (salvo
  encender el microfono al principio). El objetivo es que todo el viaje
  tome menos de 4 minutos. Cronometralo y anotalo.

---

Cuando termines, pasa a `PLANILLA_RESULTADOS.md` para volcar los
resultados y enviarlos. Gracias!
