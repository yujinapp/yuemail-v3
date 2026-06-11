# Manual de usuario -- Yuemail

Version del producto: v0.3.0. Manual actualizado: 2026-06-11.

## Que hace esta app

Yuemail te deja escribir un documento dictando con tu voz, firmarlo
y enviarlo por correo, todo desde tu propia computadora. Esta
pensada para personas que no pueden (o no quieren) depender del
mouse ni de un ayudante: cada boton tiene su frase de voz
equivalente y cada aviso se anuncia al lector de pantalla.

Todo queda en tu maquina: no hay cuenta de Yuemail, no hay nube,
no se envia telemetria. Lo unico que sale de tu computadora son
los correos que vos decidis mandar.

## Instalacion

1. Necesitas Node 18 o mas nuevo instalado.
2. En una terminal: `npm install -g @yujinapp/yuemail`
3. Para arrancar: escribi `yuemail`. Se abre el navegador solo
   (usa Chrome, Edge o Safari para que funcione la voz; en otros
   navegadores todo sigue andando con botones).

## Configurar tu cuenta de correo (una sola vez)

1. Abri la configuracion: boton del engranaje arriba a la derecha,
   o deci "abrir configuracion".
2. Escribi (o dicta) tu direccion de correo. Yuemail detecta solo
   los servidores de Gmail, Outlook, Yahoo, iCloud y muchos mas.
   Si tu proveedor pide una "contrasena de aplicacion" (Gmail y
   Outlook lo piden), el dialogo te lo avisa.
3. Proba la conexion con el boton "Probar conexion" (o deci
   "probar"). Si da verde, guarda con "guardar".
4. Todo se guarda cifrado en tu maquina.

Podes completar cualquier campo con la voz: deci "campo" y el
nombre del campo (por ejemplo "campo contrasena", "campo puerto
imap") y lo proximo que digas se vuelve el valor del campo. Para
vaciarlo: "borrar campo" y el nombre. Para las casillas de SSL
alcanza con decir "si" o "no". Las contrasenas nunca se repiten
en voz alta: solo se anuncia cuantos caracteres se capturaron.

## Escribir, firmar y enviar

1. Deci "nuevo documento" (o usa el boton `Nuevo documento`).
2. Deci "iniciar dictado" y habla: lo que digas se va agregando
   al documento. Para frenar: "fin dictado".
3. Para firmar primero guarda tu firma una vez: deci "guardar
   firma", dibuja en el recuadro (o escribi tu nombre y deci
   "generar" para una firma cursiva) y deci "guardar".
4. Despues, en cualquier documento, deci "firmar" y tu firma se
   inserta al final.
5. Deci "enviar a" seguido del correo del destinatario, hablado
   naturalmente: "enviar a ana arroba ejemplo punto com". Se abre
   la ventana de envio con todo precargado; deci "confirmar" para
   mandarlo. El documento viaja adjunto como Word (.docx).

## Leer la bandeja de entrada

Deci "leer bandeja": Yuemail lista los ultimos correos recibidos
(quien lo manda, asunto y fecha) y los anuncia en voz alta. En esta
version no se abre el contenido de los correos.

## Comandos de voz

El microfono se prende y apaga cuando vos quieras: "encender
microfono" / "apagar microfono" (tambien hay boton). Nunca queda
escuchando si no lo pediste.

Frases globales:

| Decis | Pasa |
|-------|------|
| nuevo documento | empieza un documento en blanco |
| abrir documento [nombre] | abre el ultimo o por nombre |
| guardar firma | abre el recuadro para firmar |
| firmar | inserta tu firma guardada |
| iniciar dictado / fin dictado | empieza / termina la transcripcion |
| enviar a <correo> | abre la ventana de envio |
| leer bandeja | lista los ultimos correos |
| abrir configuracion / ajustes | abre la cuenta |
| detener voz | silencia el microfono |

Con una ventana abierta, mandan las frases de esa ventana (las
globales se suspenden para que no pase nada por atras):

| Ventana | Decis | Pasa |
|---------|-------|------|
| Envio | confirmar / enviar / mandar | manda el correo |
| Envio | cancelar / cerrar / salir | cierra sin enviar |
| Firma | guardar / listo | guarda la firma |
| Firma | borrar / limpiar | limpia el recuadro |
| Firma | generar / cursiva | genera firma desde tu nombre escrito |
| Configuracion | detectar / automatica | detecta los servidores |
| Configuracion | probar / verificar | prueba la conexion |
| Configuracion | guardar / listo | guarda la cuenta |
| Cualquiera | cancelar / cerrar / salir | cierra la ventana |

"Apagar microfono" y "detener voz" funcionan siempre, haya o no
una ventana abierta.

## Privacidad

- Sin cuenta, sin nube, sin telemetria.
- Tus documentos y tu firma viven en una carpeta de tu usuario.
- Tus contrasenas de correo se guardan cifradas; ni siquiera la
  propia app puede mostrartelas despues, solo reemplazarlas.

## Si algo falla

- Cada error aparece como un aviso en pantalla y se anuncia en voz
  alta, con el motivo en castellano.
- "No se pudo enviar": revisa la configuracion (engranaje) y usa
  "Probar conexion". Gmail y Outlook suelen pedir una contrasena
  de aplicacion, no la contrasena comun.
- La voz no responde: confirma que el navegador sea Chrome, Edge o
  Safari y que el microfono este encendido (boton del microfono).
- Cualquier otra cosa: cerra la terminal donde corre yuemail y
  volve a escribir `yuemail`.
