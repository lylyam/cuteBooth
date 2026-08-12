# Spec · CameraPage `/camera`

> Nodo **U1** · `ui-composer`. Hook en **C3**, CSS en **D3**.

## Objetivo

El usuario consigue sus 4 fotos con la cámara del dispositivo, sin salir de la página.

## Entra / Sale

- **Entra con** `selectedLayout !== null`. Si no, el guard (S3) redirige a `/`.
  **Corregido el 2026-08-11:** esta línea decía además `source === 'camera'`, y eso nunca
  fue verdad. El guard real (`useRouteGuard('layout')`) y
  [../docs/contracts/state.md](../docs/contracts/state.md) §guards **solo piden el layout**,
  igual que `/upload`. Lo levantó `ui-composer` al construir U1, y **gana el código**: el
  spec era el que mentía. Consecuencia aceptada: con un layout elegido se puede llegar a
  `/camera` escribiendo la URL aunque en el modal se eligiera «subir fotos». No rompe nada
  —`/review` decide su `Retake` por `state.source`— y lo simétrico ya pasaba con `/upload`.
- **Sale a** `/review` en cuanto `photos.length === 4`. Automático: la cuarta captura es
  el final de la sesión, no hay botón de confirmar.

## Copy — literal de Figma `91:954`

| Elemento    | Texto                   |
| ----------- | ----------------------- |
| Botón único | `Start taking photos!!` |

No hay más texto en la pantalla **cuando todo va bien**. El icono de objetivo + destello de
la cabecera es decorativo (`alt=""`), y sale de `src/assets/camera.svg`.

### El copy de los errores — vive en la página, y es para que lo cambies aquí

**Ocho mensajes, uno por `kind` de `CameraErrorKind`.** Están en `CameraPage.tsx` porque el
copy es de la página, no del hook (decisión de A6). Se listan aquí para que se lean y se
cambien sin abrir un `.tsx`.

**Los ocho están APROBADOS por la propietaria el 2026-08-11.** Siete los había escrito
`ui-composer` al construir U1 y estaban pendientes de revisión; se le enseñaron en esta
tabla y los aceptó tal cual. **Ya no son supuestos: son el copy del producto.** Cambiarlos
es una decisión suya, no una corrección.

| `kind`        | Texto                                                                                              | Origen   |
| ------------- | -------------------------------------------------------------------------------------------------- | -------- |
| `denied`      | `We can't reach your camera. Check the browser permission, or upload photos instead.`              | aprobado |
| `not-found`   | `We couldn't find a camera on this device. Upload your photos instead.`                            | aprobado |
| `in-use`      | `Your camera is being used by another app. Close it and try again, or upload your photos instead.` | aprobado |
| `insecure`    | `Camera access needs a secure connection. Upload your photos instead.`                             | aprobado |
| `unsupported` | `This browser can't open your camera. Upload your photos instead.`                                 | aprobado |
| `ended`       | `Your camera turned off unexpectedly. Upload your photos instead.`                                 | aprobado |
| `capture`     | `That shot didn't come through — press Start taking photos!! to try again.`                        | aprobado |
| `unknown`     | `Something went wrong with your camera. Upload your photos instead.`                               | aprobado |

**`capture` es el único no fatal**: el stream sigue vivo, así que el botón se queda en
`Start taking photos!!` para reintentar. Los otros siete cambian el botón a
`Upload photos instead`, que despacha `SET_SOURCE: 'upload'` antes de navegar — si no, un
`Retake` posterior en `/review` volvería a `/camera` con un `source` que ya no es cierto.

## Estado que lee / escribe

- **Lee** `state.selectedLayout` (para saber cuántas fotos y con qué encuadre),
  `state.photos.length`.
- **Escribe** `ADD_PHOTO` una vez por captura, cuatro veces.

## Comportamiento

1. Al montar, `useCamera()` pide el stream y lo pinta en el `<video>` del área de
   preview. Nada se captura todavía.
2. `Start taking photos!!` lanza **una sola sesión** de 4 capturas seguidas, cada una
   con cuenta atrás 3-2-1. El botón se deshabilita mientras la sesión corre.
3. Cada captura hace `ADD_PHOTO`. La cuarta navega a `/review`.
4. Al desmontar, `useCamera` corta los tracks. **Sin excepciones**: una cámara que
   sigue encendida al navegar es un fallo grave y es lo primero que mira el revisor.

### Los tiempos de la sesión — decisión 22, cerrada el 2026-08-11

Las tres constantes viven en `hooks/useCamera.ts`. **Ninguna salía del diseño**: las eligió
un agente al construir C3, y estuvieron pendientes como pregunta **A5** hasta que la
propietaria las cerró.

| Constante           | Valor  | Qué controla                                                                    |
| ------------------- | ------ | ------------------------------------------------------------------------------- |
| `COUNTDOWN_SECONDS` | `3`    | el 3-2-1 antes de cada foto — **se queda así**                                  |
| `COUNTDOWN_TICK_MS` | `1000` | un segundo por dígito                                                           |
| `SHOT_GAP_MS`       | `1500` | la pausa entre una foto y la cuenta atrás de la siguiente — **subió de 800 ms** |

Una sesión completa dura **16,5 s** (4 × 3 s + 3 × 1,5 s), antes 14,4 s.

**El motivo de subir la pausa**, que es lo que hay que preservar si alguien la vuelve a
tocar: es el **único** hueco que tiene el usuario para cambiar de pose entre foto y foto, y
con 800 ms no había tiempo material de moverse.

## Dependencias

- **Hooks:** `useCamera` (C3) — `{ videoRef, stream, countdown, error, start, stop,
captureWithCountdown }`. La página **no** llama a `getUserMedia`.
- **Componentes:** `Loading` (C7) mientras se resuelve el permiso.
- **CSS:** `CameraPage.module.css` (D3).
- **Guard:** `useRouteGuard` (S3).

## Criterio de aceptación

- [ ] Con permiso concedido se ve el preview en vivo antes de pulsar nada
- [ ] Una pulsación produce **exactamente** 4 fotos, con cuenta atrás visible en cada una
- [ ] El botón no admite una segunda pulsación mientras la sesión corre
- [ ] Al llegar a la cuarta, navega a `/review` sin clic extra
- [ ] Navegar fuera (o cerrar) **apaga la cámara**: el indicador del navegador desaparece
- [ ] Permiso denegado: mensaje legible y salida a `/upload`, sin pantalla en blanco
- [ ] Entrar en frío a `/camera` redirige a `/`
- [ ] `npm run build` y `npm run lint` limpios

## Fuera de alcance

Filtros y efectos. Elegir entre cámara frontal y trasera. Repetir **una** foto suelta —
eso es el "Retake photos" de `/review`, que repite las cuatro. Temporizador
configurable. Grabar vídeo. Subir desde archivo (es `/upload`).

## Supuestos — no están en el diseño

1. **La cuenta atrás se pinta centrada sobre el preview.** El wireframe no la dibuja.
2. **El preview va espejado, y la foto guardada también.** Es lo que espera cualquiera
   que se haya visto en un photobooth; una captura sin espejar sorprende.
3. ~~**Copy de error de permiso inventado.**~~ **Cerrado el 2026-08-11:** la propietaria
   aprobó los ocho mensajes de error, no solo este. Ver la tabla de §Copy.
4. **No se muestran las capturas ya hechas** durante la sesión. El wireframe no tiene
   sitio para ellas y `/review` es justo la pantalla que las enseña.

## Nodo Figma

`91:954` — https://www.figma.com/design/df7hAve66qYTKiNz0UXE1E/cuteBooth--Copy-?node-id=91-954
