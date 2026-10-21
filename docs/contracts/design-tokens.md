# Contrato · Tokens de diseño

> Dueño: `figma-design-sync` (nodo **D1**; §4 la rellena él).
> Consumidores: `ui-composer`, `booth-reviewer`.
> **El código es la fuente de verdad.** `get_variable_defs` sobre el fichero de Figma
> devuelve `{}`: no hay variables que sincronizar. Ver [../design/FIGMA.md](../design/FIGMA.md) §5.

## 1. Las 26 custom properties de `:root`

La baja de `--primary-color` y las tipografías de §4 salieron del lote D3-D7;
`--window-max-width` de D9b; `--font-family-display` y `--font-size-display` de D3b (§4b).

**La columna _usos_ está generada, no contada a mano** — recontada el 2026-08-11, y son
ocurrencias de `var(--x)` en todo `src/`, `index.css` incluido. Vuelve a generarla en vez
de incrementarla:

```bash
cd src && sed -n '/^:root {/,/^}/p' index.css | grep -o '^\s*--[a-z-]*' | tr -d ' ' \
  | while read t; do printf "%-24s %s\n" "$t" "$(grep -ro "var($t)" . | wc -l)"; done
```

Se añade el comando porque la columna **ya mintió una vez**: decía 15 para
`--dark-secondary` cuando había 27, tras el CSS que aterrizó en D9b-D9d sin recontar. Un
número mantenido a mano en un documento que nadie ejecuta se desincroniza en silencio.

### Color — 4

| Token                | Valor                   | Usos                                    |
| -------------------- | ----------------------- | --------------------------------------- |
| `--secondary-color`  | `#565656`               | 3 · `h1` y subtítulo de `PhotoResult`   |
| `--background-color` | `#DEDEDE`               | 7 · fondo, `Button`, `Modal`, `Loading` |
| `--dark-secondary`   | `#222`                  | 28 · texto y **todos** los bordes       |
| `--overlay-color`    | `rgba(34, 34, 34, 0.4)` | 2 · velo de `Modal` y de `Loading`      |

### Tipografía — 12

| Token                   | Valor                        | Usos                                     |
| ----------------------- | ---------------------------- | ---------------------------------------- |
| `--font-family-base`    | `"Fira Code", monospace`     | 1 · `body`                               |
| `--font-family-display` | `"Pixelify Sans", monospace` | 1 · `.countdown` de Camera (D3b)         |
| `--font-size-sm`        | `14px`                       | 6 · texto base, `Modal`, footer, paneles |
| `--font-size-md`        | `22px`                       | 2 · `h2` y Upload                        |
| `--font-size-lg`        | `40px`                       | 1 · subtítulo de `PhotoResult` (D7)      |
| `--font-size-label`     | `17px`                       | 1 · título de panel en Decoration        |
| `--font-size-title`     | `clamp(2rem, 5vw, 4.625rem)` | 1 · `h1`                                 |
| `--font-size-display`   | `clamp(3rem, 9vw, 8rem)`     | 1 · `.countdown` de Camera (D3b)         |
| `--font-weight-light`   | `300`                        | 1 · `h1`                                 |
| `--font-weight-regular` | `400`                        | 6 · base y cuatro pantallas              |
| `--line-height-tight`   | `1`                          | 2 · `index.css`                          |
| `--line-height-base`    | `normal`                     | 7 · base y cinco componentes             |

### Borde y radio — 5

| Token                  | Valor     | Usos                                                 |
| ---------------------- | --------- | ---------------------------------------------------- |
| `--border-width`       | `1.94px`  | 14 · **todos** los bordes del producto               |
| `--border-radius-sm`   | `8px`     | 2 · `Button` y Decoration                            |
| `--border-radius-md`   | `10px`    | 3 · huecos de Upload, panel y muestras de Decoration |
| `--border-radius-lg`   | `17.59px` | 6 · ventana, `Card`, `Modal`, Upload, Camera, Decor. |
| `--border-radius-pill` | `999px`   | 2 · botón de cerrar y `Loading`                      |

### Espaciado de página — 5

| Token                 | Valor                      | Usos                                    |
| --------------------- | -------------------------- | --------------------------------------- |
| `--page-padding-y`    | `clamp(1.5rem, 5vh, 80px)` | 2 · `PageShell`                         |
| `--page-padding-x`    | `10px`                     | 1 · `PageShell`                         |
| `--content-max-width` | `743px`                    | 1 · `PageShell`                         |
| `--footer-links-gap`  | `33px`                     | 1 · `AppFooter`                         |
| `--window-max-width`  | `1292px`                   | 1 · el marco de **todas** las pantallas |

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

Cada punto es un hallazgo real del CSS actual, no una hipótesis. **T1, T2 y T3 están
cerrados**; T4-T8 siguen abiertos y el motivo de cada uno está al final de §4.

| #   | Hallazgo                                                               | Dónde                     | Qué hacer                                                                                 |
| --- | ---------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| T1  | **Resuelto (D1).** `border: 2px solid` en vez de `var(--border-width)` | `Button.module.css`       | Unificado. Dos grosores de borde en una UI de un solo trazo era un error, no una decisión |
| T2  | **Resuelto (D1).** `gap: 10.514px` transcrito del inspector            | `Button.module.css`       | Redondeado a `10px`                                                                       |
| T3  | **Resuelto (D3-D7).** `--primary-color` (`#C2C2C2`) no lo usaba nadie  | `index.css`               | **Borrado.** Ningún hueco vacío lleva relleno en las 5 pantallas: son contornos. Ver §4   |
| T4  | `box-shadow: 3px 3px 0 0` a pelo                                       | `Button.module.css:hover` | Candidato a `--shadow-hard` si D3-D7 lo repiten                                           |
| T5  | `z-index: 1000` a pelo                                                 | `Modal.module.css`        | Solo hay una capa flotante; token cuando haya dos                                         |
| T6  | **Resuelta (D9b).** `width: min(1292px, ...)` repetido                 | `WebAppOldStyle`          | Era la causa de que el marco midiera distinto en cada pantalla. Ver §4                    |
| T7  | Espaciados sueltos sin escala: `8 10 12 15 16 20 24 30 32 37 40 70` px | todos los `.module.css`   | **No inventar la escala ahora.** Ver §4                                                   |
| T8  | Breakpoints literales: `640px`, `768px`, `900px`                       | 5 ficheros                | Dejarlos literales (regla 6), pero **usar solo esos tres**                                |

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

```
--window-max-width : 1292px
  motivo   : T6 resuelto (D9b). El marco (WebAppOldStyle) medía distinto en cada
             pantalla porque solo LayoutPage escapaba del --content-max-width
             (743px) que PageShell impone a .main. Confirmado en Figma: Frame 38
             mide 1292×763 y es IDÉNTICO en 88:1676 (Layout) y 91:1346 (Review)
  usos     : WebAppOldStyle.module.css → .wrapper (todas las pantallas)
  reemplaza: el `min(1292px, calc(100vw - 140px))` que solo vivía en
             LayoutPage.module.css → .wideWindow, y el `min(1292px, 100%)` sin
             escape que dejaba Upload/Review/Final atrapadas en 743px
```

**T3 resuelto: `--primary-color` (`#C2C2C2`) se borra.** Con las cinco pantallas revisadas,
**ningún hueco vacío ni ninguna forma lleva relleno** — son contornos de 1.94px sobre el
fondo de página. `get_design_context` no devolvió `bg-[#c2c2c2]` en ningún nodo. Tenía 0
consumidores antes y 0 después, así que la baja es segura. Si algún día hace falta un gris
de "hueco vacío", se reintroduce con evidencia; mantenerlo huérfano solo invitaba a usarlo
por error.

Con esto `:root` pasa de **21 a 24** custom properties: −1 (`--primary-color`) +3 en el lote
D3-D7, +1 (`--window-max-width`) en D9b.

**T4-T8 siguen abiertas, y con motivo escrito:**

| #   | Por qué sigue abierta                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T4  | `--shadow-hard`: el fichero es un wireframe estático y **no dibuja estados hover**. D3-D7 no repiten la sombra, así que no hay evidencia para promoverla a token |
| T5  | `z-index`: D3-D7 no añaden ninguna capa flotante que compita con el `Modal` — la capa de stickers se apila por orden de DOM, sin `z-index` explícito             |
| T6  | **Resuelta (D9b).** Era la causa de que el marco midiera distinto en cada pantalla. Ver §4                                                                       |
| T7  | Escala de espaciado: **deliberadamente sin inventar.** El lote añadió más valores sueltos (14, 20, 25, 30, 40, 50…). Es más evidencia, no una escala             |
| T8  | Breakpoints: el lote usó solo `640px` y `768px`. Ninguno fuera de la lista                                                                                       |

## 4b. Delta de tokens — D3b (2026-08-11), `2084:47` "Camera shooting"

Dos tokens nuevos, sin bajas. Cerraron el supuesto sin respaldo de diseño que tenía
`.countdown` desde D3: círculo/píldora con `--overlay-color` de fondo y
`--background-color` de texto. `2084:47` no dibuja ningún chip — es texto plano.

```
--font-family-display : 'Pixelify Sans', monospace
  motivo   : la propietaria pide un pixel-font solo para el dígito de la cuenta
             atrás. --font-family-base ('Fira Code') es la única tipografía del
             proyecto; ninguna existente cubre esto
  usos     : CameraPage.module.css → .countdown
  carga    : @import en index.css línea 2, junto al de Fira Code, solo peso
             400 (wght@400) — el único que usa --font-weight-regular

--font-size-display : clamp(3rem, 9vw, 8rem)
  motivo   : 128px en Figma (dígito sobre el preview de 574px). Excede el máximo
             de --font-size-title (74px) y no hay ningún otro token de tipografía
             cerca; 8rem = 128px exacto, 3rem de suelo iguala al suelo de 48px
             que ya usa .icon en la misma pantalla
  usos     : CameraPage.module.css → .countdown
  reemplaza: el font-size: var(--font-size-title) del supuesto de D3
```

Con esto `:root` pasa de **24 a 26** custom properties.

## 5. Criterio de aceptación de D1

- [x] §1 verificada en D1. Tras el lote, `:root` tiene **23** tokens: ver §4
- [x] T1 y T2 resueltos: `Button.module.css` sin `2px` ni `10.514px`
- [x] T3 decidido en el lote D3-D7: **borrado**, con motivo escrito en §4
- [x] Cada token nuevo tiene entrada en §4 con motivo y sitios de uso
- [x] Ningún `.module.css` nuevo con color, radio o grosor de borde literal (verificado
      por el orquestador: 0 literales en los 6 ficheros del lote)
- [x] Ningún breakpoint fuera de `640px`, `768px`, `900px` (el lote usó 640 y 768)
- [x] `npm run build` limpio (ejecutado por el orquestador, no por el agente)

## 6. Móvil (≤ 640 px) — añadido el 2026-10-21

Pedido por la propietaria a partir del mockup `cutebooth · Mobile.html` (raíz del repo). El
mockup marca **la forma**, no el aspecto: colores, tipografía, botones, iconos y fondos son
los de siempre. Un solo punto de corte, `@media (max-width: 640px)`, literal (rule 6).

| Pieza                 | En móvil                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageShell`           | sin padding; el pie queda bajo la pantalla, a un scroll                                                                                      |
| `WebAppOldStyle`      | ventana a pantalla completa (`100dvh`), sin borde ni radio; barra de 56 px; el contenido hace scroll dentro                                  |
| `Modal`               | hoja inferior: pegada abajo, radio solo arriba, acciones apiladas a ancho completo                                                           |
| Acciones de página    | abajo del todo, a ancho completo (`--mobile-button-padding-y`); en `/decoration`, anterior/siguiente lado a lado                             |
| `/`                   | `PhotoboothMobile.png`; parpadea siempre con `PhotoboothMobile2.png`, al ritmo del hover de escritorio (0,5 s), porque en móvil no hay hover |
| `/review`, `/final`   | título arriba, tira inclinada en el alto que sobra, acciones abajo                                                                           |
| `/decoration`         | tira arriba; el panel debajo como hoja, con UNA fila de muestras que hace scroll lateral                                                     |
| `/upload` wide/spotl. | márgenes y huecos en `cqw` sobre el lienzo de 468, para que la tira conserve su forma a cualquier ancho                                      |

Las tiras de `/review`, `/final` y `/decoration` se dimensionan con `cqw`/`cqh` contra su
contenedor: caben a lo alto y a lo ancho sin deformarse. `useCanvas` ya redibuja al cambiar
el tamaño (`ResizeObserver`).

Tokens nuevos: `--mobile-gutter` (16 px) y `--mobile-button-padding-y` (14 px).
