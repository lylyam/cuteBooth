# Design cache · Loading (componente, nodo C7)

> Pulled 2026-07-28. Fuente: `get_design_context` sobre `91:1285` (Frame 35, el
> contenido de `91:1283` sin la barra superior/footer, ya cubiertos por
> `WebAppOldStyle`/`AppFooter` — mismo criterio que `camera.md`).
>
> **`91:1283` está dibujado como pantalla completa en Figma**, pero KICKOFF §4
> decisión 3 ya cerró que `Loading` es **componente**, no ruta. Este documento
> cachea el pull crudo _y_ la reinterpretación a componente superpuesto, para
> que nadie repita ni la llamada a Figma ni la decisión de estructura.

## Estructura confirmada en Figma

```
Frame 35 (1292×718, ya cubierto por WebAppOldStyle.content)
└─ icono "Interface-Essential-Loading-0-Percent Streamline Pixel" (147×147, centrado)
```

Sin texto. Sin color de relleno propio: la pantalla es el gris de página
(`--background-color`) de siempre, con el icono en línea oscura.

## Por qué el CSS no es un calco del nodo

1. **Superpuesto, no pantalla completa.** `Loading` se monta encima de contenido
   ya pintado (un `<canvas>`, el preview de un slot) mientras `/upload` y
   `/decoration` esperan algo (D9/C7). El nodo de Figma no dice esto — es la
   pantalla "loading" a solas, dibujada igual que las otras once. La decisión de
   producto (componente, no ruta) ya estaba en KICKOFF §4; la de **cómo se ve
   superpuesto** no estaba en ningún sitio y la declaro aquí:
   - `position: absolute; inset: 0` sobre el contenedor que lo monte (que debe
     ser `position: relative`), no `fixed` como `Modal` — no es un bloqueo de
     página completa, es local a la zona que tapa.
   - Lleva **velo** (`var(--overlay-color)`, el mismo que ya usa `Modal`) para
     comunicar "espera, no interactúes" sobre el contenido de debajo. Sin esto,
     un spinner flotando sin fondo no se lee como bloqueante.
   - Sin `z-index` explícito: al ser absoluto y (se asume) el último hijo en el
     DOM del contenedor que lo usa, queda encima sin competir con el `Modal`
     (T5 del contrato de tokens sigue sin segunda capa flotante real).
2. **Sin asset nuevo.** El icono de Figma es un asset que no existe en
   `src/assets/`, y este agente no tiene `Bash` ni herramientas de escritura de
   binarios para bajarlo y comprometerlo. En su lugar, `.spinner` es un anillo
   CSS (`border` + `border-top-color` distinto + `@keyframes spin`) con los
   mismos tokens de borde/color que el resto de la UI. Mismo lenguaje visual,
   cero dependencia nueva. Si más adelante se sube un asset SVG real a
   `src/assets/`, esto es lo primero que hay que revisar.

## Mapeo a tokens

| Uso                              | Token                                             |
| --------------------------------- | -------------------------------------------------- |
| Velo de fondo                    | `var(--overlay-color)`                            |
| Anillo del spinner (base)        | `var(--border-width) solid var(--background-color)` |
| Anillo del spinner (segmento)    | `var(--dark-secondary)` en `border-top-color`     |
| Radio del contenedor (si aplica) | `border-radius: inherit` (copia el del padre)     |
| Texto opcional `.label`          | `var(--font-size-sm)` / `var(--font-weight-regular)` / `var(--background-color)` |

Ningún valor nuevo: todo lo anterior ya existe en `:root`. Ninguna propuesta de
token para este componente.

## Clases de `Loading.module.css`

`overlay`, `spinner`, `label` (esta última opcional: el TSX decide si pinta
texto o solo el spinner).

## Supuestos de estructura

- `.overlay` asume que su elemento padre inmediato es `position: relative` — si
  `ui-composer` lo monta como hijo directo de un contenedor sin posicionar, el
  overlay se escapa al `body`. Repórtalo si no encaja.
- `.label` es opcional a propósito: Figma no dibuja texto en `91:1283`, así que
  no hay copy que citar. Si el producto quiere un texto ("Loading…",
  "Processing…"), es una decisión de copy fuera de este documento.
