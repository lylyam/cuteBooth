# Design cache · Decoration (`/decoration`, 3 pasos)

> Pulled 2026-07-26, nodo D5. Fuente: `get_design_context` sobre `102:321`
> (Frame 35 de `102:319`, "Decorarion"). `103:382` es duplicado exacto — no se
> ha vuelto a traer, ver `FIGMA.md` §3.

## Estructura confirmada

```
Frame 45 (943×543)
├─ Frame 29 (425×543)  panel: título "Frames" (17px) + rejilla 2 col, scroll
│    Frame 32: 8 formas 172×120.99, radius 10, distintas geometrías
│    (rect, ellipse, subtract, union…) — el arte YA tiene su propio trazo
│    #222/1.94px "horneado" en el SVG (ver contracts/assets.md)
└─ Frame 7  (217.073×637)  preview — idéntico en proporción al marco de Upload
     classic. Radius exterior 17.59, huecos internos radius 10.
Frame 44 (1192×34): [← Previous step] ·· [Next step →]
```

## Decisión de arquitectura de esta pantalla

El preview (Frame 7) **no se reconstruye como 4 divs**: en la app real es un
`<canvas>` (useCanvas, C4) que pinta el marco + fotos + fondo + stickers. Los 4
rectángulos del wireframe son solo la referencia geométrica para el
`aspect-ratio` del contenedor — y ahí manda `docs/contracts/layouts.md`
(218×637 / 468×419), no los decimales del wireframe, porque es geometría de
canvas real, no un simple placeholder de UI como en Upload.

Las muestras del panel (Frame 32) también son imágenes reales generadas por
`asset-pipeline` (ver `contracts/assets.md`), no formas CSS: el contenedor
`.swatch` solo las centra y les da hueco de click.

## Mapeo a tokens

| Crudo Figma                        | Token                                             |
| ---------------------------------- | ------------------------------------------------- |
| Panel `radius: 10px`               | **nuevo** `var(--border-radius-md)`               |
| Preview exterior `radius: 17.59px` | `var(--border-radius-lg)`                         |
| Título panel "Frames" `17px`       | **nuevo** `var(--font-size-label)`                |
| Bordes `1.94px #222`               | `var(--border-width) solid var(--dark-secondary)` |

## Los 3 pasos comparten plantilla

Backgrounds e Icons no están dibujados. Misma estructura de panel + preview +
botones; solo cambia el contenido de `.grid`:

- **Frames / Icons**: `.swatch` — la imagen se ve entera (`object-fit: contain`).
- **Backgrounds**: `.swatch.backgroundSwatch` — recorte cuadrado
  (`object-fit: cover`), nunca la imagen completa. Ver SUPUESTO en el informe
  sobre la palabra "cuadrado" del requisito de la propietaria.
- **Icons**: además, `.tabs` con las 4 familias de sticker (3dStyle, drawStyle,
  feltStyle, pixelStyle) — no dibujado, ver `specs/decoration.md` SUPUESTO 5.

## Clases de `DecorationPage.module.css`

`windowContent`, `layout`, `panel`, `panelTitle`, `tabs`, `tab`, `tabActive`,
`grid`, `swatch`, `swatchSelected`, `backgroundSwatch`, `preview`,
`previewClassic`, `previewWide`, `previewSpotlight`, `canvas`, `stickerLayer`,
`sticker`, `footerActions`.
