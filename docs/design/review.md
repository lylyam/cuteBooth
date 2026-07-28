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

## D9c (2026-07-28) — `Review · wide/spotlight` (`2090:21`), y por qué el texto va arriba siempre

> Pedido de la propietaria: en `/review` (y `/final`, mismo componente) el texto
> queda arriba con `classic` pero centrado con `wide`/`spotlight`. Quiere los tres
> como `classic`. Fuente: `get_metadata` sobre `2090:21` y `get_design_context`
> sobre `2090:23` ("Frame 35" de esa pantalla — el mismo patrón de sourcing que
> `91:1348` para classic).

### Estructura confirmada

```
2090:22 Frame 38 (1292×763)
└─ 2090:23 Frame 35 (1292×718) — pt-[50px] pb-[80px] px-[50px], items-start
   ├─ 2090:24 Frame 42 (776×231) — x=50 y=50: h1 + subtítulo + Frame 41 (2 botones)
   └─ 2090:51 Frame 9 (517.3×474.9) — position ABSOLUTE, left=737 top=196:
      la rejilla 2×2 de 4 huecos (219.5×167.6 cada uno), rotada 7.28°
```

### El hallazgo que cierra el ticket

`Frame 35` **no centra nada verticalmente**: es `padding-top:50px; padding-bottom:80px`
a secas, `align-items: flex-start` (`items-start` en el Tailwind generado), el mismo
patrón que `layout.md` ya había confirmado para `Frame 42` de `91:1348` (classic):
"el texto está pegado arriba del área de contenido (y=50 de 718 disponibles)". Con
`wide`/`spotlight` el texto está en el mismo `x=50 y=50` — **idéntico al de classic**,
no una variante. El wireframe nunca centró nada; el centrado vertical era una decisión
de D9b sin respaldo en Figma (su propia nota lo decía: "sin evidencia directa de
Figma"). Revertida en D9c.

**Lo que NO se replica:** `Frame 9` (la rejilla) está en `position: absolute`, con un
`top: 196px` que no coincide con el top del texto (`y=50`) — es la propia rejilla
del wireframe la que queda desplazada hacia abajo respecto al bloque de texto, no al
revés. En CSS no hay ningún posicionamiento absoluto para la tira: `.layout` es un
flex row con `align-items: flex-start`, así que hoy el `stripWrapper` se alinea con
la parte de arriba del `textBlock`, no con la fila de botones como en este wireframe
concreto. No se ha tocado — es un detalle de posicionamiento fino de un wireframe,
no el bug reportado (que era sobre el texto, no sobre la tira), y placeholder para
duda abierta en el informe de cierre.

### Corrección aplicada

`ReviewPage.module.css` y `FinalPage.module.css`: `.windowContent` pasa de
`justify-content: center` (D9b) a `justify-content: flex-start` (D9c). Sin cambios
en `PhotoResult.module.css` para esto — su `.layout` ya tenía
`align-items: flex-start`, que es lo que mantiene el texto pegado a la parte de
arriba de su propia fila; lo que sobraba era el centrado de la fila completa dentro
de la ventana.

Ningún token nuevo: coordenadas y padding puros, sin color/radio/borde/fuente de por
medio.
