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
