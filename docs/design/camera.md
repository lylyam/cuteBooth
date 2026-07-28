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

- La cuenta atrás (`.countdown`) es un círculo superpuesto centrado, usando
  `--overlay-color` de fondo y `--background-color` de texto, tamaño
  `--font-size-title`. Nada de esto está dibujado; es la interpretación de la
  SUPUESTO 1 de `specs/camera.md`.
- El `<video>` va con `transform: scaleX(-1)` (mirror), la cuenta atrás NO
  (para que el número no salga al revés).

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
