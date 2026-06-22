# 1. Instalacion y configuracion de Yuemail v0.6.0

Guia paso a paso para dejar Yuemail funcionando. Segui los pasos en
orden. Tiempo estimado: 20 a 30 minutos la primera vez.

---

## Parte A -- Lo que tenes que tener antes de empezar

Conseguí estas cosas ANTES de instalar. Si te falta alguna, frena aca y
resolvela primero; despues el resto sale derecho.

1. **Una computadora** con Windows 10/11, macOS o Linux.

2. **Node.js version 18 o mas nueva.** Es el motor que hace andar
   Yuemail.
   - Para ver si ya lo tenes: abri una terminal (en Windows se llama
     **PowerShell**; buscala en el menu Inicio) y escribi:
     ```
     node --version
     ```
   - Si responde un numero como `v18.x`, `v20.x` o mayor, estas listo.
   - Si dice que no conoce el comando, o el numero es menor a 18,
     instalalo desde **https://nodejs.org** (apreta el boton grande que
     dice **LTS**). Despues cerra y volve a abrir la terminal.

3. **Google Chrome o Microsoft Edge** instalado. Son los navegadores
   donde Yuemail funciona mejor. (En Safari anda; en Firefox NO hay voz
   de navegador, y eso es esperado, no una falla.)

4. **Un microfono que funcione.** El de la notebook alcanza. La primera
   vez el navegador te va a pedir permiso para usarlo: hay que apretar
   **Permitir**.

5. **Una clave de Google para la Voz** (escuchar y hablar). Es la pieza
   nueva de esta version. Una sola clave sirve para las dos cosas, pero
   en la consola de Google hace falta:
   - habilitar dos servicios: **Cloud Speech-to-Text** (el oido) y
     **Cloud Text-to-Speech** (la voz), y
   - que la clave **no tenga restriccion de "sitios web"** (Yuemail la
     usa desde su propio servidor, no desde el navegador; con esa
     restriccion Google la rechaza).
   - Si no sabes como dejar la clave lista, en la carpeta `docs/` del
     proyecto hay una guia con capturas:
     `como-destrabar-tu-clave-de-google-paso-a-paso.html`.

6. **Una clave de un proveedor de IA para el Asistente** (la
   inteligencia que entiende lo que pedis con tus palabras).
   Recomendamos **Google Gemini**, que tiene capa gratuita: se saca en
   **https://aistudio.google.com/apikey**. Puede ser una clave distinta
   de la de Voz. (Tambien sirven Anthropic, OpenAI, DeepSeek, xAI,
   Mistral, Qwen, Z.ai y Ollama; Ollama corre local y no necesita
   clave.)

7. **Una cuenta de correo de prueba.** Recomendamos crear una cuenta de
   **Gmail nueva, solo para estas pruebas** (no uses tu correo
   personal). En Gmail vas a necesitar generar una **"contrasena de
   aplicacion"**:
   - entra a **myaccount.google.com** -> Seguridad,
   - activa la **Verificacion en dos pasos**,
   - despues entra a **Contrasenas de aplicaciones** y genera una.
   - Te va a dar una clave de 16 letras: guardala, esa es la que va en
     Yuemail (no es la contrasena con la que entras a Gmail).

8. **Una segunda direccion de correo** que puedas mirar (puede ser tu
   correo personal): solo la vas a usar para confirmar que los envios de
   prueba llegan.

> **Sobre tu privacidad, dicho de frente.** Con las funciones de Google
> encendidas, sale informacion de tu maquina hacia Google, siempre
> desde el servidor de Yuemail (nunca desde el navegador): la Voz manda
> el audio de lo que decis y el texto que la app te lee; el Asistente
> manda el texto de tu pedido ya transcripto. Tus claves se guardan
> cifradas en tu computadora y nunca viajan a internet ni a nosotros. Tu
> contrasena de correo y tus documentos no se mandan a Google. Si
> preferis que nada salga de tu maquina, podes apagar la Voz de Google
> (usa el navegador) y el Asistente (usa una lista de frases fijas).

---

## Parte B -- Instalar Yuemail

1. Abri la terminal (PowerShell en Windows).

2. Escribi este comando y apreta Enter:
   ```
   npm install -g @yujinapp/yuemail
   ```
   Puede tardar uno o dos minutos. Algunos mensajes amarillos
   (warnings) son normales; lo que importa es que termine sin errores
   en rojo.

3. Verifica que quedo instalado:
   ```
   yuemail version
   ```
   Tiene que responder **`0.6.0`** (o un numero mayor). Si la terminal
   dice que no conoce el comando `yuemail`, cerrala, abri una nueva y
   proba de nuevo.

4. Arranca la aplicacion:
   ```
   yuemail
   ```
   Se abre solo el navegador en **http://127.0.0.1:5180** mostrando
   Yuemail. Si no se abre solo, abri Chrome o Edge a mano y entra a esa
   direccion.

   - Para **apagar** Yuemail mas tarde: volve a la terminal y apreta
     **Ctrl + C**.
   - Si ya tenias una version vieja instalada, actualizala con:
     `npm update -g @yujinapp/yuemail`.

---

## Parte C -- Primera configuracion (en este orden)

Con Yuemail abierto en el navegador, arriba a la derecha vas a ver unos
botones. Vamos a configurar tres cosas, en este orden.

### Paso 1 -- La Voz de Google (escuchar y hablar) PRIMERO

1. Apreta el boton **"Voz"**.
2. Se abre la ventana **"Voz (escuchar y hablar)"**. Vas a ver un
   interruptor **"Voz de Google encendida"** (ya viene marcado), el
   **Idioma** (Espanol Argentina), la **Velocidad** y el campo
   **"Clave de Google"**.
3. Pega tu clave de Google de Voz en el campo "Clave de Google".
4. Apreta **"Probar voz"**: tenes que ESCUCHAR a Yuemail diciendo una
   frase con una voz clara y natural. Si la escuchas, la clave anda. Si
   te avisa que no pudo, lo mas comun es que falte habilitar un servicio
   o sacar la restriccion de sitio web de la clave (ver Parte A, punto
   5).
5. Apreta **Guardar**. Aparece el aviso "Voz configurada".

> Si no pones clave, Yuemail escucha y habla igual usando el navegador.
> Nunca te quedas sin voz.

### Paso 2 -- El Asistente de voz (la IA que entiende)

1. Apreta el boton **"Asistente"** (al lado de "Voz").
2. Se abre la ventana **"Asistente de voz (IA)"**: interruptor
   encendido, Proveedor en **"Google Gemini"**, un Modelo (Gemini Flash
   Lite) y el campo **"Clave de API"**.
3. Pega tu clave de IA y apreta **Guardar**.
4. Aparece el aviso "Asistente de voz configurado". Si avisa que falta
   la clave, revisa que la pegaste completa y guarda de nuevo.

> Si no pones clave, Yuemail sigue andando con una lista de frases fijas
> ("nuevo documento", "leer bandeja", etc.).

### Paso 3 -- La cuenta de correo

1. Apreta el **engranaje** (icono de configuracion).
2. Escribi tu **direccion de correo de prueba**. En unos segundos
   Yuemail detecta solo los servidores (si es Gmail, se completan
   automaticamente).
3. Pega tu **contrasena de aplicacion** (la de 16 letras, no la de
   entrar a Gmail).
4. (Opcional pero recomendado) apreta **"Probar conexion"**: tiene que
   avisar "IMAP OK / SMTP OK".
5. Escribi **tu nombre** y apreta **Guardar**. La configuracion queda
   cifrada en tu maquina.

---

## Listo

Con esos tres pasos, Yuemail esta configurado y listo para usar. Ahora
abri **`2_PRUEBAS_TIPICAS.md`** y empeza el recorrido de prueba.

Buenas noticias: la configuracion queda guardada. Si cerras y volves a
abrir Yuemail, no hay que configurar todo de nuevo.
