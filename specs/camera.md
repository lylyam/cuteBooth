# Spec · CameraPage `/camera`

> Nodo **U1** · `ui-composer`. Hook en **C3**, CSS en **D3**.

## Objetivo

El usuario consigue sus 4 fotos con la cámara del dispositivo, sin salir de la página.

## Entra / Sale

- **Entra con** `selectedLayout !== null` y `source === 'camera'`. Si no, el guard (S3)
  redirige a `/`.
- **Sale a** `/review` en cuanto `photos.length === 4`. Automático: la cuarta captura es
  el final de la sesión, no hay botón de confirmar.

## Copy — literal de Figma `91:954`

| Elemento    | Texto                   |
| ----------- | ----------------------- |
| Botón único | `Start taking photos!!` |

No hay más texto en la pantalla. El icono de objetivo + destello de la cabecera es
decorativo (`alt=""`).

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
3. **Copy de error de permiso inventado:** `We can't reach your camera. Check the
browser permission, or upload photos instead.` Si no vale, es una línea.
4. **No se muestran las capturas ya hechas** durante la sesión. El wireframe no tiene
   sitio para ellas y `/review` es justo la pantalla que las enseña.

## Nodo Figma

`91:954` — https://www.figma.com/design/df7hAve66qYTKiNz0UXE1E/cuteBooth--Copy-?node-id=91-954
