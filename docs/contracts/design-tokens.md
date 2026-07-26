# Contrato · Tokens de diseño

> Dueño: `figma-design-sync` (nodo **D1**; §4 la rellena él).
> Consumidores: `ui-composer`, `booth-reviewer`.
> **El código es la fuente de verdad.** `get_variable_defs` sobre el fichero de Figma
> devuelve `{}`: no hay variables que sincronizar. Ver [../design/FIGMA.md](../design/FIGMA.md) §5.

## 1. Las 21 custom properties de `:root`

Verificadas contra `src/index.css` el 2026-07-26. La columna *usos* cuenta
`var(--x)` en todo `src/`, incluido `index.css`.

### Color — 5

| Token | Valor | Usos |
|---|---|---|
| `--primary-color` | `#C2C2C2` | **0 — huérfano, ver §3** |
| `--secondary-color` | `#565656` | 1 · color de `h1` |
| `--background-color` | `#DEDEDE` | 3 · fondo de página, `Button`, `Modal` |
| `--dark-secondary` | `#222` | 15 · texto y **todos** los bordes |
| `--overlay-color` | `rgba(34, 34, 34, 0.4)` | 1 · velo del `Modal` |

### Tipografía — 8

| Token | Valor | Usos |
|---|---|---|
| `--font-family-base` | `"Fira Code", monospace` | 1 |
| `--font-size-sm` | `14px` | 4 · texto base, `p`, `button`, footer |
| `--font-size-md` | `22px` | 1 · `h2` |
| `--font-size-title` | `clamp(2rem, 5vw, 4.625rem)` | 1 · `h1` |
| `--font-weight-light` | `300` | 1 |
| `--font-weight-regular` | `400` | 1 |
| `--line-height-tight` | `1` | 2 |
| `--line-height-base` | `normal` | 3 |

### Borde y radio — 4

| Token | Valor | Usos |
|---|---|---|
| `--border-width` | `1.94px` | 5 |
| `--border-radius-sm` | `8px` | 1 · `Button` |
| `--border-radius-lg` | `17.59px` | 3 · ventana, `Card`, `Modal` |
| `--border-radius-pill` | `999px` | 1 · botón de cerrar |

### Espaciado de página — 4

| Token | Valor | Usos |
|---|---|---|
| `--page-padding-y` | `clamp(1.5rem, 5vh, 80px)` | 3 |
| `--page-padding-x` | `10px` | 1 |
| `--content-max-width` | `743px` | 1 |
| `--footer-links-gap` | `33px` | 1 |

## 2. Reglas de mapeo

1. **Ningún valor visual hardcodeado en un `.module.css`.** Color, radio, grosor de
   borde, tamaño y peso de fuente van siempre por token.
2. **Un valor crudo de Figma se mapea al token existente más cercano** si la
   diferencia es cosmética (≤ 1 px, o el mismo color en otra notación). El fichero es
   un **wireframe**: sus números no son un acabado que haya que reproducir al píxel.
3. **Token nuevo solo cuando ninguno encaja**, y se *propone* en el informe con
   nombre, valor, motivo y sitios de uso. Nunca se añade en silencio a `:root`.
4. **Nomenclatura:** `--<categoría>-<escala|rol>`, en minúsculas y en inglés, igual
   que las 21 de arriba. Escalas `sm | md | lg | pill`, no números.
5. **No se renombra ni se cambia el valor de un token existente** sin listar sus
   consumidores. Es un cambio de API visual, y toca ficheros de otros dueños.
6. **Las `@media` no llevan tokens.** `var()` no se resuelve en una media query. Los
   breakpoints son la lista literal de §3 y se repiten a mano.
7. **Layout puro no es token.** `display`, `flex-direction`, `gap` estructural,
   `grid-template-columns` se escriben crudos.

## 3. Deuda conocida de tokens

Cada punto es un hallazgo real del CSS actual, no una hipótesis.

| # | Hallazgo | Dónde | Qué hacer |
|---|---|---|---|
| T1 | `border: 2px solid` en vez de `var(--border-width)` (1.94px) | `Button.module.css` | Unificar en D1. Dos grosores de borde en una UI de un solo trazo es un error, no una decisión |
| T2 | `gap: 10.514px` transcrito del inspector de Figma | `Button.module.css` | Redondear a `10px` y quitar el decimal |
| T3 | `--primary-color` (`#C2C2C2`) no se usa en ningún sitio | `index.css` | En D3-D7, comprobar si es el gris de los huecos de foto vacíos. Si no lo es, borrarlo |
| T4 | `box-shadow: 3px 3px 0 0` a pelo | `Button.module.css:hover` | Candidato a `--shadow-hard` si D3-D7 lo repiten |
| T5 | `z-index: 1000` a pelo | `Modal.module.css` | Solo hay una capa flotante; token cuando haya dos |
| T6 | `width: min(1292px, ...)` repetido en dos ficheros | `WebAppOldStyle`, `LayoutPage` | Candidato a `--window-max-width` |
| T7 | Espaciados sueltos sin escala: `8 10 12 15 16 20 24 30 32 37 40 70` px | todos los `.module.css` | **No inventar la escala ahora.** Ver §4 |
| T8 | Breakpoints literales: `640px`, `768px`, `900px` | 5 ficheros | Dejarlos literales (regla 6), pero **usar solo esos tres** |

## 4. Delta de tokens — la rellena D1

Esta sección está **vacía a propósito**. Se completa en el lote D3-D7, cuando haya
cinco pantallas de evidencia y no antes: una escala de espaciado inventada con dos
pantallas a la vista se rehace con la tercera.

`figma-design-sync` añade aquí, por cada token nuevo que proponga:

```
--nombre-token : valor
  motivo   : qué valor crudo de Figma no encajaba en ninguno de los 21
  usos     : fichero.module.css → .clase (uno por línea)
  reemplaza: qué literal se borra al introducirlo
```

Y una línea por cada punto de §3 que quede resuelto.

## 5. Criterio de aceptación de D1

- [ ] §1 sigue cuadrando con `index.css` (mismo número de tokens, mismos valores)
- [ ] T1 y T2 resueltos: `Button.module.css` sin `2px` ni `10.514px`
- [ ] T3 decidido: `--primary-color` usado o borrado, con motivo escrito
- [ ] Cada token nuevo tiene entrada en §4 con motivo y sitios de uso
- [ ] Ningún `.module.css` nuevo con color, radio o grosor de borde literal
- [ ] Ningún breakpoint fuera de `640px`, `768px`, `900px`
- [ ] `npm run build` limpio y las páginas ya implementadas se ven igual
