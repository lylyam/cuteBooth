# Design cache · Camera (`/camera`)

> Pulled 2026-07-26, nodo D3. Fuente: `get_design_context` sobre `91:956` (Frame 35,
> el contenido de `91:954` sin la barra superior/footer, ya cubiertos por
> `WebAppOldStyle`/`AppFooter`).

## Estructura confirmada

```
Frame 35 (1292×718, ya cubierto por WebAppOldStyle.content)
├─ Frame 40 (71×71)   icono cámara + destello — decorativo, alt=""
├─ Frame 7  (574×388)  área de preview — border 1.94 #222, radius 17.59
└─ Button   "Start taking photos!!"
```

Distribución vertical: `justify-content: space-between` dentro de `.content`
(padding del wrapper ya es pt-50/pb-80/px-10, que coincide EXACTO con el
`.content` por defecto de `WebAppOldStyle.module.css` — no hizo falta tocar el
padding).

## Mapeo a tokens

| Crudo Figma                                              | Token                                             |
| -------------------------------------------------------- | ------------------------------------------------- |
| `border: 1.94px solid #222`                              | `var(--border-width) solid var(--dark-secondary)` |
| `border-radius: 17.59px`                                 | `var(--border-radius-lg)`                         |
| Botón (ya cubierto por `Button.module.css`, D1 resuelto) | —                                                 |

Sin color de relleno en ninguna forma (ni en el icono decorativo ni en el área
de preview): son solo contornos. Sin evidencia de `--primary-color`.

## Clases de `CameraPage.module.css`

`windowContent`, `icon`, `previewBox`, `previewVideo`, `countdown`, `error`.

## Supuestos de estructura (no de producto — esos ya están en `specs/camera.md`)

- ~~La cuenta atrás (`.countdown`) es un círculo superpuesto centrado, usando
  `--overlay-color` de fondo y `--background-color` de texto, tamaño
  `--font-size-title`.~~ **Superseded por D3b (2026-08-11), ver más abajo.** Era
  la interpretación de la SUPUESTO 1 de `specs/camera.md` sin respaldo de
  diseño; `2084:47` no dibuja ningún chip.
- El `<video>` va con `transform: scaleX(-1)` (mirror), la cuenta atrás NO
  (para que el número no salga al revés). Esto sigue vigente.

## D3b (2026-08-11) · resuelto: `2084:47` "Camera shooting"

El enlace directo llegó de la propietaria. `get_metadata` sobre `2084:47`
confirma la misma estructura `Frame 38 → Frame 35 → Frame 7` que `91:954`
(mismo `Frame 7` 574×388), más un único hijo de texto: el nodo `2084:75`
("3"), 75×154, centrado. `get_design_context` sobre `Frame 7` (`2084:59`)
devuelve:

```
Frame 7 (contenedor, = nuestro .previewBox)
  bg: rgba(34,34,34,0.4)   border: 1.94px #222   radius: 17.59px
  └─ texto "3"
       font-family: 'Pixelify Sans', Regular
       font-size: 128px
       font-weight: normal (400)
       color: #222
       line-height: normal
       centrado (left: calc(50% - 37px), top: calc(50% - 77.5px))
```

**Lectura:** el `rgba(34,34,34,0.4)` y el borde/radio de `Frame 7` son el
propio `.previewBox` (ya coincidían con `--dark-secondary`/`--border-width`/
`--border-radius-lg` desde D3); en el wireframe ese relleno es el placeholder
del feed de cámara que no existe en Figma, no una capa nueva que haya que
pintar encima del `<video>` real. **La cuenta atrás no lleva chip, píldora ni
fondo propio: es texto plano** — #222 sobre el placeholder gris de Figma, lo
que se traduce a `--dark-secondary` en nuestro CSS.

Mapeo a tokens:

| Crudo Figma                    | Token                                         | Nota                                                                                                  |
| ------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `color: #222`                  | `var(--dark-secondary)`                       | match exacto                                                                                          |
| `font-weight: 400` (Regular)   | `var(--font-weight-regular)`                  | match exacto                                                                                          |
| `line-height: normal`          | `var(--line-height-base)`                     | match exacto                                                                                          |
| `font-family: 'Pixelify Sans'` | **`var(--font-family-display)`, token nuevo** | no hay tipografía pixel-art entre las 21                                                              |
| `font-size: 128px`             | **`var(--font-size-display)`, token nuevo**   | 128px excede el máximo de `--font-size-title` (74px); no hay token que cubra un dígito de esta escala |

Tokens añadidos en `src/index.css` `:root`:

```
--font-family-display: 'Pixelify Sans', monospace;
--font-size-display: clamp(3rem, 9vw, 8rem);   /* 48px → 128px, 128px = 8rem exacto en Figma */
```

**Resuelto (orquestador, mismo día):** `'Pixelify Sans'` se carga por
`@import` en la línea 2 de `index.css`, junto al de Fira Code, pidiendo solo
el peso 400 (`wght@400`) — el único que usa `--font-weight-regular`. El
`@import` va antes del bloque `:root`, como exige la sintaxis CSS.

## Búsqueda bloqueada 2026-07-28 · frame "Camera shooting"

La propietaria dice haber creado un frame nuevo llamado **"Camera shooting"**
con la tipografía y el color reales para la cuenta atrás (hoy `.countdown`
arriba es un SUPUESTO sin respaldo de diseño). Se intentó localizar su node ID
sin violar la regla absoluta de `FIGMA.md` §6.1 (nunca `get_metadata` sobre
`0:1`):

- `get_metadata` sobre `91:954` (Camera) y `91:1283` (Loading): ninguno de los
  dos devolvió un bloque `Currently selected nodes`, así que no hay nada
  seleccionado ahora mismo en el Figma desktop que delate el ID por selección.
- `get_metadata` solo devuelve el subárbol del nodo consultado, no sus
  hermanos ni su padre — consultar un nodo conocido (`91:954`, `2074:52`) no
  expone los IDs de frames vecinos añadidos después.
- Sin nodeId, `get_metadata` solo lista páginas de nivel superior (hay una:
  `0:1`), no frames dentro de la página.
- Ningún otro tool MCP de Figma busca por nombre; todos piden un `nodeId` ya
  conocido.
- Se comprobó el repo entero (`grep -i "camera shooting\|shooting"`): no hay
  ningún node ID cacheado en ningún doc.

**Conclusión: no se puede localizar "Camera shooting" sin romper la regla de
`0:1`.** No se ha tocado `CameraPage.module.css` con tipografía o color nuevos
— `.countdown` sigue siendo el SUPUESTO de arriba hasta que llegue el enlace
directo (`?node-id=...`) del frame. Si alguien lo trae, que no repita esta
búsqueda: que pegue el ID aquí y siga desde `get_metadata` de ese nodo
concreto.
