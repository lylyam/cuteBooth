# Design cache · Selected pictures (`/review`)

> Pulled 2026-07-26, nodo D7. Fuente: `get_design_context` sobre `91:1348`
> (Frame 35 de `91:1346`). **Hacer antes de D6** — comparten componente.

## Estructura confirmada

```
Frame 35 (justify-between)
├─ Frame 42 (776 wide)
│   ├─ Frame 43: h1 "Here's your photo strip!" (74.042px, #222) +
│   │            subtítulo "Happy with it..." (40px, #565656)
│   └─ Frame 41: Button "Retake photos" (140) + Button "Start decorating" (150)
└─ Frame 8 (278.996×621.358): la tira, rotada 7.28°, contenedor
    204.556×600.27, radius exterior 16.576, huecos 162.082×114.017 radius 9.423
```

Los números del bloque derecho son la tira canónica (217.073×637, radius
17.59/10) **escalados × 0.9423** por cómo cupo en este frame concreto de
Figma. Se confirma que es el mismo marco que Camera/Upload/Decoration: en CSS
se usa la proporción canónica (`docs/contracts/layouts.md`: 218×637), no estos
decimales.

## Los anchos de botón NO son una decisión de CSS

140/150 (aquí) frente a 98/81 (`/final`) son solo la consecuencia natural del
`padding` fijo del `Button` compartido aplicado a textos de distinta longitud
("Retake photos"/"Start decorating" vs "Download"/"Retake"). **No se fuerza
ningún `width` en ningún botón** — por eso el mismo `.actions` sirve a las dos
pantallas sin parametrizar anchos.

## Mapeo a tokens

| Crudo Figma                | Token                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `h1` color `#222`          | `var(--dark-secondary)` — **pisa** el h1 global, que por defecto es `var(--secondary-color)` |
| Subtítulo `40px` `#565656` | **nuevo** `var(--font-size-lg)` + `var(--secondary-color)`                                   |
| Tira: borde/radius         | `var(--border-width)`, `var(--border-radius-lg)`                                             |

## Clases (compartidas en `PhotoResult.module.css`)

`layout`, `textBlock`, `heading`, `title`, `subtitle`, `actions`,
`stripWrapper`, `strip`, `stripClassic`, `stripWide`, `stripSpotlight`,
`canvas`.

`ReviewPage.module.css` solo aporta `windowContent` (padding lateral 50px, que
en Figma es distinto del resto de pantallas — Camera/Upload/Decoration usan
10px de serie, coincidente con el `.content` por defecto de
`WebAppOldStyle`).
