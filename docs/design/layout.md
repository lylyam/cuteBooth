# Design cache · Layout (`/layout`) — and the window every screen shares

> Pulled 2026-07-28, nodo **D9b** (revisión de estructura pedida por la propietaria
> tras ver las pantallas en marcha). Fuente: `get_metadata` sobre `88:1676` (Layout) y
> `91:1346` (Selected pictures), **no** `get_design_context` — solo hacía falta
> confirmar una medida, no releer contenido ya cacheado en `review.md`/`final.md`.

## Lo que se necesitaba confirmar: el ancho "bueno" del marco

La propietaria pidió que "el marco que envuelve todo" midiera lo mismo en las cinco
pantallas, y que el ancho de referencia fuera el de Figma. Confirmado:

```
88:1676 "Layout"           → Frame 38 x=74  y=80  width=1292 height=763
91:1346 "Selected pictures" → Frame 38 x=74  y=80  width=1292 height=763
```

**Idénticos**, byte a byte, en dos pantallas distintas del archivo — confirma la nota
de `FIGMA.md` §1: "las doce pantallas tienen exactamente la misma envoltura". No hizo
falta pedir las otras diez: con dos coincidiendo exactamente ya no hay ambigüedad.

- Ancho del marco: **1292px** → nuevo token `--window-max-width` en `index.css`.
- Margen horizontal en Figma: `(1440 − 1292) / 2 = 74px` por lado. El código ya usaba
  `calc(100vw - 140px)` (70px por lado) desde antes de este nodo — 4px de diferencia,
  cosmético, dentro de la tolerancia de wireframe (regla 2 de `design-tokens.md`). No se
  toca.
- Alto del marco en Figma: 763px fijo (de un artboard de 1024px, márgenes 80px arriba,
  ~181px abajo para el footer). El código **no** puede copiar un número fijo — no hay
  artboard de altura fija en un navegador — así que el alto se resuelve con flexbox
  (`PageShell` + `WebAppOldStyle`, ver sus `.module.css`), no con un píxel de Figma.

## Por qué solo Layout escapaba del ancho de 743px antes de esto

`PageShell.module.css` acota `.inner` (y por tanto `.main`) a `--content-max-width`
(743px) — pensado para el contenido de texto plano de `HomePage`. `LayoutPage` era la
única pantalla que rompía ese límite, con un truco de `position: relative; left: 50%;
transform: translateX(-50%)` en su propia `.wideWindow`. Upload/Review/Final nunca lo
tuvieron, así que su marco quedaba atrapado en 743px. Solucionado moviendo ese mismo
truco a `WebAppOldStyle.module.css` como comportamiento **por defecto** — ver el
comentario en ese fichero. `LayoutPage.module.css` conserva la clase `.wideWindow`
vacía porque `LayoutPage.tsx` la sigue pasando como `className`.

## Selected pictures (`91:1346`): confirma la estructura, no la corrige

`review.md` (D7, 2026-07-26) ya documentaba `Frame 35 (justify-between)` con
`Frame 42` (texto, 776px, x=50) a la izquierda y `Frame 8` (tira, x=1039) a la derecha.
Con las coordenadas exactas de esta pasada (`Frame 42` termina en x=826, `Frame 8`
empieza en x=1039), se confirma que **el wireframe siempre quiso la tira al lado del
texto, no debajo**. El bug que reportó la propietaria no era un malentendido de
estructura: `PhotoResult.module.css` ya tiene `justify-content: space-between` con
`flex-wrap: wrap` en `.layout`, exactamente lo que hace falta — lo que faltaba era
espacio horizontal. Con el marco atrapado en 743px menos el `padding` lateral de 50px
de `ReviewPage`/`FinalPage` (≈639px disponibles), los dos bloques (480 + 40 + 320 = 840px
necesarios) no cabían en una fila y el `flex-wrap` los apilaba. Al liberar el ancho del
marco a 1292px, sobran ~1188px: entran de sobra sin tocar `PhotoResult.module.css`.

Frame 42 también confirma que el texto está pegado arriba del área de contenido
(y=50 de 718 disponibles), no centrado — coherente con dejar `align-items`/sin
`justify-content` extra en el `.content` base. Lo que sí se decidió en este nodo,
sin evidencia directa de Figma (es una pantalla de código, responsive), es centrar
verticalmente el bloque **completo** de `PhotoResult` dentro de la ventana ya alta —
ver SUPUESTOS del informe D9b.
