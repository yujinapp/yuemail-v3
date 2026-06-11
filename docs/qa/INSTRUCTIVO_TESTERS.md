# Yuemail v0.4.0 -- Instructivo para el equipo de pruebas manuales

Gracias por ayudarnos a probar Yuemail. Este documento explica como
conseguir el producto, prepararlo, ejecutar los casos de prueba y
devolvernos los resultados. No hace falta saber programar.

Documento hermano: `CASOS_DE_PRUEBA_v0.4.0.md` (en esta misma
carpeta) contiene los casos, uno por uno, con su resultado esperado.

## 1. Que es Yuemail

Un cliente de correo a voz, para una sola persona, que corre 100%
en tu computadora. Permite dictar un documento en castellano,
firmarlo y enviarlo por email como adjunto Word (.docx). Esta
pensado para personas con discapacidad motriz y/o visual: todo lo
que se hace con el mouse se puede hacer con la voz.

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
- Una **cuenta de correo de prueba**. Recomendamos crear una cuenta
  de Gmail nueva SOLO para estas pruebas (no uses tu cuenta
  personal). En Gmail necesitas generar una "contrasena de
  aplicacion": myaccount.google.com > Seguridad > Verificacion en
  dos pasos (activala) > Contrasenas de aplicaciones. Guarda esa
  contrasena de 16 letras: es la que va en Yuemail.
- Una segunda direccion de correo a la que puedas mirar la bandeja
  de entrada, para verificar que los envios llegan (puede ser tu
  correo personal: solo va a RECIBIR mensajes de prueba).

## 3. Como instalar el producto

En la terminal:

```
npm install -g @yujinapp/yuemail
```

Para verificar que quedo instalado:

```
yuemail version
```

Debe responder `0.4.0` (o superior). Si la terminal dice que no
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

## 4. Como ejecutar las pruebas

1. Abri `CASOS_DE_PRUEBA_v0.4.0.md` al lado de la app.
2. Ejecuta los casos **en orden dentro de cada seccion** (algunos
   dependen del anterior; cuando es asi, la precondicion lo dice).
3. Para cada caso anota el resultado en la planilla (seccion 5):
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
5. Las frases de voz estan escritas entre comillas, por ejemplo
   "nuevo documento": deci exactamente eso, con el microfono
   encendido, hablando natural. No hace falta gritar ni hablar
   robotico.
6. Saca captura de pantalla de TODA falla. Nombra el archivo con
   el id del caso (por ejemplo `ENV-03.png`).

Tiempo estimado de la corrida completa: 3 a 4 horas. Se puede
cortar y retomar (la configuracion de la cuenta queda guardada).

## 5. Como anotar y devolver los resultados

Al final de `CASOS_DE_PRUEBA_v0.4.0.md` hay una planilla con una
fila por caso. Podes:

- copiarla a una hoja de calculo (Excel / Google Sheets), o
- editar el .md directamente.

Por cada caso completa: resultado (PASA / FALLA / BLOQUEADO / N/A),
observaciones, y nombre del archivo de captura si lo hay.

Al terminar, completa tambien el bloque "Datos de la corrida"
(quien probo, fecha, sistema operativo, navegador y version,
proveedor de correo usado).

**Envia todo a: contact@yujin.app** con asunto
`QA Yuemail v0.4.0 -- <tu nombre>`, adjuntando la planilla y las
capturas. Si encontras algo grave que rompe todo (no instala, no
arranca), no esperes a terminar la corrida: avisanos de inmediato
al mismo correo.

## 6. Reglas de oro

- Anota lo que VISTE, no lo que crees que deberia pasar.
- Un caso = un resultado. No mezcles observaciones de dos casos.
- Los textos exactos de los mensajes de error valen oro: copialos
  tal cual aparecen.
- Si dudas entre PASA y FALLA, marca FALLA y explica la duda en
  observaciones.
- Tu contrasena de aplicacion es tuya: no la incluyas en la
  planilla ni en las capturas (si una captura la muestra, tachala
  antes de enviarla).
