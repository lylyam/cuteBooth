# Contrato · Tokens de diseño

> Dueño: `figma-design-sync` (nodo **D1**; §4 la rellena él).
> Consumidores: `ui-composer`, `booth-reviewer`.
> **El código es la fuente de verdad.** `get_variable_defs` sobre el fichero de Figma
> devuelve `{}`: no hay variables que sincronizar. Ver [../design/FIGMA.md](../design/FIGMA.md) §5.

## 1. Las 21 custom properties de `:root`

Verificadas contra `src/index.css` el 2026-07-26. La columna _usos_ cuenta
`var(--x)` en todo `src/`, incluido `index.css`.

### Color — 5

| Token                | Valor                   | Usos                                   |
| -------------------- | ----------------------- | -------------------------------------- |
| `--primary-color`    | `#C2C2C2`               | **0 — huérfano, ver §3**               |
| `--secondary-color`  | `#565656`               | 1 · color de `h1`                      |
| `--background-color` | `#DEDEDE`               | 3 · fondo de página, `Button`, `Modal` |
| `--dark-secondary`   | `#222`                  | 15 · texto y **todos** los bordes      |
| `--overlay-color`    | `rgba(34, 34, 34, 0.4)` | 1 · velo del `Modal`                   |

### Tipografía — 8

| Token                   | Valor                        | Usos                                  |
| ----------------------- | ---------------------------- | ------------------------------------- |
| `--font-family-base`    | `"Fira Code", monospace`     | 1                                     |
| `--font-size-sm`        | `14px`                       | 4 · texto base, `p`, `button`, footer |
| `--font-size-md`        | `22px`                       | 1 · `h2`                              |
| `--font-size-title`     | `clamp(2rem, 5vw, 4.625rem)` | 1 · `h1`                              |
| `--font-weight-light`   | `300`                        | 1                                     |
| `--font-weight-regular` | `400`                        | 1                                     |
| `--line-height-tight`   | `1`                          | 2                                     |
| `--line-height-base`    | `normal`                     | 3                                     |

### Borde y radio — 4

| Token                  | Valor     | Usos                         |
| ---------------------- | --------- | ---------------------------- |
| `--border-width`       | `1.94px`  | 5                            |
| `--border-radius-sm`   | `8px`     | 1 · `Button`                 |
| `--border-radius-lg`   | `17.59px` | 3 · ventana, `Card`, `Modal` |
| `--border-radius-pill` | `999px`   | 1 · botón de cerrar          |

### Espaciado de página — 4

| Token                 | Valor                      | Usos |
| --------------------- | -------------------------- | ---- |
| `--page-padding-y`    | `clamp(1.5rem, 5vh, 80px)` | 3    |
| `--page-padding-x`    | `10px`                     | 1    |
| `--content-max-width` | `743px`                    | 1    |
| `--footer-links-gap`  | `33px`                     | 1    |

## 2. Reglas de mapeo

1. **Ningún valor visual hardcodeado en un `.module.css`.** Color, radio, grosor de
   borde, tamaño y peso de fuente van siempre por token.
2. **Un valor crudo de Figma se mapea al token existente más cercano** si la
   diferencia es cosmética (≤ 1 px, o el mismo color en otra notación). El fichero es
   un **wireframe**: sus números no son un acabado que haya que reproducir al píxel.
3. **Token nuevo solo cuando ninguno encaja**, y se _propone_ en el informe con
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

| #   | Hallazgo                                                               | Dónde                          | Qué hacer                                                                                     |
| --- | ---------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| T1  | `border: 2px solid` en vez de `var(--border-width)` (1.94px)           | `Button.module.css`            | Unificar en D1. Dos grosores de borde en una UI de un solo trazo es un error, no una decisión |
| T2  | `gap: 10.514px` transcrito del inspector de Figma                      | `Button.module.css`            | Redondear a `10px` y quitar el decimal                                                        |
| T3  | `--primary-color` (`#C2C2C2`) no se usa en ningún sitio                | `index.css`                    | En D3-D7, comprobar si es el gris de los huecos de foto vacíos. Si no lo es, borrarlo         |
| T4  | `box-shadow: 3px 3px 0 0` a pelo                                       | `Button.module.css:hover`      | Candidato a `--shadow-hard` si D3-D7 lo repiten                                               |
| T5  | `z-index: 1000` a pelo                                                 | `Modal.module.css`             | Solo hay una capa flotante; token cuando haya dos                                             |
| T6  | `width: min(1292px, ...)` repetido en dos ficheros                     | `WebAppOldStyle`, `LayoutPage` | Candidato a `--window-max-width`                                                              |
| T7  | Espaciados sueltos sin escala: `8 10 12 15 16 20 24 30 32 37 40 70` px | todos los `.module.css`        | **No inventar la escala ahora.** Ver §4                                                       |
| T8  | Breakpoints literales: `640px`, `768px`, `900px`                       | 5 ficheros                     | Dejarlos literales (regla 6), pero **usar solo esos tres**                                    |

## 4. Delta de tokens — rellenada por el lote D3-D7 (2026-07-26)

Tres tokens nuevos y una baja. Se decidieron con las **cinco pantallas a la vista**, que es
la condición que esta sección exigía.

```
--border-radius-md : 10px
  motivo   : hueco/panel interior repetido en Upload (los 3 layouts), Decoration
             (panel + muestras) y la tira escalada de Review/Final. No encaja en
             --border-radius-sm (8px, diff 2px) ni en --border-radius-lg (17.59px)
  usos     : UploadPage.module.css → .slot
             DecorationPage.module.css → .panel, .swatch, .backgroundSwatch
  reemplaza: el rounded-[10px] repetido en 91:1170/1204/1225 y 102:321

--font-size-lg : 40px
  motivo   : subtítulo de PhotoResult, el componente compartido por /review y /final.
             --font-size-md (22px) se queda a 18px; --font-size-title solo llega a 40
             en el máximo de su clamp
  usos     : components/result/PhotoResult.module.css → .subtitle
  reemplaza: text-[40px] de 91:1402 y 2074:58

--font-size-label : 17px
  motivo   : título de sección del panel en los tres pasos de Decoration
             (Frames/Backgrounds/Icons). diff 5px con --font-size-md, 3px con --sm
  usos     : DecorationPage.module.css → .panelTitle
  reemplaza: text-[17px] de 102:351
```

**T3 resuelto: `--primary-color` (`#C2C2C2`) se borra.** Con las cinco pantallas revisadas,
**ningún hueco vacío ni ninguna forma lleva relleno** — son contornos de 1.94px sobre el
fondo de página. `get_design_context` no devolvió `bg-[#c2c2c2]` en ningún nodo. Tenía 0
consumidores antes y 0 después, así que la baja es segura. Si algún día hace falta un gris
de "hueco vacío", se reintroduce con evidencia; mantenerlo huérfano solo invitaba a usarlo
por error.

Con esto `:root` pasa de **21 a 23** custom properties (−1 +3).

**T4-T8 siguen abiertas, y con motivo escrito:**

| #   | Por qué sigue abierta                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T4  | `--shadow-hard`: el fichero es un wireframe estático y **no dibuja estados hover**. D3-D7 no repiten la sombra, así que no hay evidencia para promoverla a token |
| T5  | `z-index`: D3-D7 no añaden ninguna capa flotante que compita con el `Modal` — la capa de stickers se apila por orden de DOM, sin `z-index` explícito             |
| T6  | `--window-max-width`: ninguno de los 6 ficheros nuevos escribe 1292px. Sigue siendo cosa de `WebAppOldStyle` y `LayoutPage`                                      |
| T7  | Escala de espaciado: **deliberadamente sin inventar.** El lote añadió más valores sueltos (14, 20, 25, 30, 40, 50…). Es más evidencia, no una escala             |
| T8  | Breakpoints: el lote usó solo `640px` y `768px`. Ninguno fuera de la lista                                                                                       |

## 5. Criterio de aceptación de D1

- [x] §1 verificada en D1. Tras el lote, `:root` tiene **23** tokens: ver §4
- [x] T1 y T2 resueltos: `Button.module.css` sin `2px` ni `10.514px`
- [x] T3 decidido en el lote D3-D7: **borrado**, con motivo escrito en §4
- [x] Cada token nuevo tiene entrada en §4 con motivo y sitios de uso
- [x] Ningún `.module.css` nuevo con color, radio o grosor de borde literal (verificado
      por el orquestador: 0 literales en los 6 ficheros del lote)
- [x] Ningún breakpoint fuera de `640px`, `768px`, `900px` (el lote usó 640 y 768)
- [x] `npm run build` limpio (ejecutado por el orquestador, no por el agente)
