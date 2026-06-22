# Planilla de resultados -- Yuemail v0.6.0 (20 pruebas tipicas)

Anota aca como te fue en cada prueba de `2_PRUEBAS_TIPICAS.md`.
Podes editar este archivo directamente o copiar la tabla a Excel /
Google Sheets.

En la columna **Resultado** escribi una de estas:

- **PASA** -- paso exactamente lo esperado.
- **FALLA** -- paso otra cosa (anota QUE paso, palabra por palabra si
  hay un mensaje en pantalla).
- **BLOQUEADO** -- no se pudo probar (por ejemplo, depende de una prueba
  anterior que fallo). Anota por que.
- **N/A** -- no aplica a tu equipo (por ejemplo, no tenes microfono).
  Anota por que.

---

## Datos de la corrida

- Tester (tu nombre):
- Fecha:
- Sistema operativo y version:
- Navegador y version:
- Version de Node (`node --version`):
- Version de Yuemail (`yuemail version`):
- Proveedor de correo usado:
- Proveedor y modelo de IA del Asistente (Gemini Flash Lite por defecto):
- Voz de Google: la dejaste encendida / usaste el navegador:

---

## Resultados

| # | Prueba | Resultado | Observaciones | Captura |
|---|--------|-----------|---------------|---------|
| 1 | Instalar y verificar la version | | | |
| 2 | Arrancar la aplicacion | | | |
| 3 | Probar la voz de Google (que te hable) | | | |
| 4 | Que el oido de Google te entienda | | | |
| 5 | Configurar el Asistente (la IA) | | | |
| 6 | Configurar la cuenta de correo | | | |
| 7 | Crear un documento nuevo por voz | | | |
| 8 | Dictar texto en el documento | | | |
| 9 | Pedirle algo con tus palabras | | | |
| 10 | Dictar un correo con tus palabras | | | |
| 11 | Guardar y poner una firma | | | |
| 12 | Enviar el documento por voz | | | |
| 13 | Que el correo llegue con el adjunto | | | |
| 14 | Leer la bandeja de entrada | | | |
| 15 | El Asistente NO ejecuta lo que no pediste | | | |
| 16 | "enviar" mientras dictas NO manda el correo | | | |
| 17 | Red de seguridad: apagar la voz de Google | | | |
| 18 | Privacidad: las claves no se ven | | | |
| 19 | Destinatario mal escrito avisa con claridad | | | |
| 20 | El viaje completo, solo con la voz | | | |

Tiempo del viaje completo (prueba 20), en minutos:

---

## Como enviar los resultados

Envia esta planilla y las capturas a **contact@yujin.app** con el
asunto:

`QA Yuemail v0.6.0 -- <tu nombre>`

Reglas de oro al anotar:

- Anota lo que VISTE, no lo que crees que deberia pasar.
- Los textos exactos de los mensajes de error valen oro: copialos tal
  cual aparecen.
- Si dudas entre PASA y FALLA, marca FALLA y explica la duda.
- Tu contrasena y tus claves son tuyas: no las pongas en la planilla ni
  en las capturas (si una captura las muestra, tachalas antes de
  enviar).
- En las pruebas 9 y 10 (Asistente), anota TEXTUAL lo que dijiste y que
  hizo la app: asi medimos que tan bien interpreta la IA.
