# Design cache · Upload (`/upload`)

> Pulled 2026-07-26, nodo D4. Fuente: `get_design_context` sobre `91:1170`
> (classic), `91:1204` (wide), `91:1225` (spotlight) — el contenido de cada
> pantalla, sin barra superior/footer.

## Tres layouts, no tres estados

Cada nodo dibuja únicamente la tira vacía (sin botón, sin texto — confirmado,
ver `specs/upload.md`). Un solo `UploadPage.module.css` con variantes.

⚠️ Estos números son **válidos para el CSS de esta pantalla** (así lo dice
`FIGMA.md` §4), aunque **no** son la fuente de geometría del canvas de salida
— eso lo fija `docs/contracts/layouts.md` con datos del arte.

### classic (`91:1168`/`91:1170`)

Marco exterior 217.073×637, padding 20, gap 14, columna. 4 huecos de
172×120.99, radius 10, border 1.94 #222.

### wide (`91:1202`/`91:1204`)

Marco exterior 468×419, padding 20, gap 14, grid 2×2. 4 huecos de 203×143,
mismo radius/border.

### spotlight (`91:1223`/`91:1225`)

Marco exterior 468×419, padding 20. 1 hueco grande 428×246 arriba + 3 huecos
134×95 abajo (gap-y 20, gap-x variable por `justify-between` en el original —
en código se resuelve con `grid-template-columns: repeat(3, 1fr)` + `gap: 20px`,
más limpio que replicar el flex-wrap del wireframe).

## Mapeo a tokens

| Crudo Figma                      | Token                                             |
| -------------------------------- | ------------------------------------------------- |
| `border: 1.94px solid #222`      | `var(--border-width) solid var(--dark-secondary)` |
| Marco exterior `radius: 17.59px` | `var(--border-radius-lg)`                         |
| Hueco individual `radius: 10px`  | **nuevo** `var(--border-radius-md)` — ver informe |

Ninguna forma tiene relleno: son contornos sobre el fondo de la página. **No
hay evidencia de `--primary-color` (`#C2C2C2`)** en ninguno de los tres nodos:
decisión T3 en el informe de este lote.

## Clases de `UploadPage.module.css`

`windowContent`, `strip`, `classic`, `wide`, `spotlight`, `slot`, `featured`
(solo dentro de `.spotlight`, en el primer hueco), `slotPhoto`,
`slotPlaceholder`, `actions`, `error`, `visuallyHidden`.

## D9c (2026-07-28) — la forma real, y por qué el `padding: 20px` uniforme estaba mal

> Pedido de la propietaria: `wide` y `spotlight` no tenían la forma del marco real
> (le falta el "pie" inferior más ancho de `wide`, y el reparto interno de
> `spotlight`), y además los tres se veían pequeños. **No se ha vuelto a pedir
> contexto a Figma para esto** — la geometría correcta ya estaba cacheada en
> `contracts/layouts.md` (fuente: el arte de los marcos, no este wireframe; ver su
> "Qué cambió y por qué da igual"), y esta página **nunca fue la fuente de
> geometría**, solo de este CSS.

### Los números reales (de `layouts.md`, canvas por layout)

| Layout      | Canvas  | Margen sup. | Margen inf. | Margen lados | Gap                                         |
| ----------- | ------- | ----------- | ----------- | ------------ | ------------------------------------------- |
| `classic`   | 218×637 | 30          | 81          | 23           | 14 (entre los 4)                            |
| `wide`      | 468×419 | 30          | 87          | 23           | 16 (filas y columnas)                       |
| `spotlight` | 468×419 | 30          | 30          | 23           | 18 (fila) / 10 (columnas de las 3 pequeñas) |

`wide` tiene un margen inferior casi 3× el superior — el "pie" que la propietaria
echaba en falta. `spotlight` es simétrico arriba/abajo; lo que varía ahí es el
reparto entre el hueco grande y la fila de tres. `classic` también tiene pie (81 vs
30), aunque no fue lo que se reportó como roto.

Verificación aritmética (ancho/alto de contenido tras padding y gaps, dividido entre
huecos) contra las medidas de hueco de `layouts.md`: coincide exacta en las tres
—`wide` da 203×143, `spotlight` da 134×95 (con el hueco grande a 422×246), `classic`
da 172×121—, así que el `aspect-ratio` que cada `.slot` ya tenía no hacía falta
tocarlo, solo el padding/gap del contenedor. La única cifra que sí cambia dentro de
un `.slot` es `.spotlight .featured`: pasa de `428/246` a `422/246` (el wireframe
traía 6px de más, exactamente la deriva que `layouts.md` ya documentaba
"bailaba hasta 6 px en spotlight").

### El tamaño

`classic` se queda en 217px (nunca se reportó pequeño). `wide` y `spotlight` pasan
de 468px (su ancho de canvas nativo) a **620px** — toda la tabla de arriba escalada
×1.3248 (620/468) para que la forma no cambie, solo el tamaño. Cabe de sobra: la
ventana mide hasta 1292px y esta pantalla no tiene texto al lado de la tira (a
diferencia de `/review`), solo el botón "Continue" debajo.
