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

**Lo que NO se replica (en D9c):** `Frame 9` (la rejilla) está en `position: absolute`, con un
`top: 196px` que no coincide con el top del texto (`y=50`) — es la propia rejilla
del wireframe la que queda desplazada hacia abajo respecto al bloque de texto, no al
revés. En CSS no hay ningún posicionamiento absoluto para la tira: `.layout` es un
flex row con `align-items: flex-start`, así que hoy el `stripWrapper` se alinea con
la parte de arriba del `textBlock`, no con la fila de botones como en este wireframe
concreto. No se ha tocado — es un detalle de posicionamiento fino de un wireframe,
no el bug reportado (que era sobre el texto, no sobre la tira), y placeholder para
duda abierta en el informe de cierre.

### Corrección aplicada (D9c)

`ReviewPage.module.css` y `FinalPage.module.css`: `.windowContent` pasa de
`justify-content: center` (D9b) a `justify-content: flex-start` (D9c). Sin cambios
en `PhotoResult.module.css` para esto — su `.layout` ya tenía
`align-items: flex-start`, que es lo que mantiene el texto pegado a la parte de
arriba de su propia fila; lo que sobraba era el centrado de la fila completa dentro
de la ventana.

Ningún token nuevo: coordenadas y padding puros, sin color/radio/borde/fuente de por
medio.

## D9d (2026-07-29) — la tira baja a la esquina inferior derecha

> Pedido de la propietaria: la tira (hoy arriba a la derecha) tiene que quedar
> **abajo a la derecha**; el texto se queda donde está. Reportado con capturas del
> app real, no de Figma: la ventana medía **1292×959** con mucho hueco vacío por
> debajo del bloque de texto+tira.

### Esto cierra la duda abierta de D9c

Se repitió `get_metadata` sobre `2090:21` (no `get_design_context`: los números ya
estaban cacheados arriba desde D9c, solo hacía falta releerlos con esta pregunta en
mente) y confirma exactamente lo que D9c había registrado como "no replicado":
`Frame 9` (`791.09, 197`, `517.32×474.93`) dentro de `Frame 35` (`1292×718`) —

- **vertical**: `197 + 474.93 = 671.93`, a **46px** del borde inferior de `Frame 35`
  (`718`). Muy por debajo del bloque de texto (`Frame 42`, `y=50` a `y=281`).
- **horizontal**: `791.09 + 517.32 = 1308.4`, prácticamente a ras del borde derecho
  (`Frame 35` mide `1292`; el sobrante de 16px es imprecisión de wireframe, no una
  medida a reproducir — regla 2 de mapeo).

O sea: el wireframe **ya** dibuja la tira abajo-derecha, desacoplada del top del
texto. D9c no tocó esto porque el bug que resolvía era sobre el texto, no sobre la
tira — quedó anotado como pendiente, y es lo que D9d resuelve.

### Qué le faltaba al contenedor

`.layout` (en `PhotoResult.module.css`) nunca tuvo una altura real: al ser el único
hijo de `.content` (columna flex en `WebAppOldStyle.module.css`), medía solo lo que
medía su contenido (el texto o la tira, lo que fuera más alto), y le sobraba toda la
altura real de la ventana sin usar — de ahí el hueco de la captura. "Abajo" no podía
significar nada sin una caja con altura real contra la que anclarse.

### Corrección aplicada (D9d)

`PhotoResult.module.css`, dos clases:

- **`.layout`**: `flex: 1; min-height: 0;` — mismo patrón que `PageShell.module.css`
  ya usa en `.main` para el mismo problema. Ahora `.layout` mide toda la altura real
  de `.content` (que a su vez la lee de `.wrapper { height: 100% }`), no solo la de
  su contenido.
- **`.stripWrapper`**: `align-self: flex-end` — con `.layout` ya alto de verdad, esto
  ancla la tira al borde inferior de esa caja. El anclaje horizontal (derecha) ya
  existía: es `justify-content: space-between` de `.layout`, sin tocar.

Las dos, en `@media (max-width: 768px)`, se revierten (`.layout { flex: 0 1 auto }`)
para no tocar el comportamiento móvil existente, que no tiene diseño de Figma detrás
(design-tokens.md §5) y ya resolvía su propio apilado sin este ancla.

### Por qué sobrevive a que se quite `rotate(7.28deg)`

`align-self: flex-end` está en `.stripWrapper`, no en `.strip` (que es quien lleva
la rotación). Un `transform` en CSS repinta un elemento en su sitio sin cambiar la
caja que ese elemento aporta al layout flex de su contenedor — por eso la caja
envolvente rotada de la tira mide 277×620 mientras su caja real sigue siendo
205×599 (`clientWidth`) y no 277×620 (`getBoundingClientRect()`). Si `.strip` pierde
el `transform` la semana que viene, `.stripWrapper` sigue midiendo y anclándose
igual: nada de esto lee la rotación.

Ningún token nuevo: `flex`, `min-height`, `align-self` son layout puro (regla 7 de
`design-tokens.md`), sin color/radio/borde/fuente de por medio.

## D9d, segunda mitad (2026-07-29) — el giro se muda al canvas (C4c)

> `canvas-media` midió el trazo con escalones que la propietaria reportó: girar con
> CSS un bitmap ya rasterizado da un pico de 69 (sd 18,5) contra 35 (sd 0,8) girando
> dentro del `<canvas>` — ocho propiedades de compositor probadas y descartadas,
> byte a byte idénticas a girar sin más. `hooks/useCanvas.ts` ya soporta
> `rotation: 'css'` (nodo **C4c**, ya commiteado); esta mitad es la que le
> corresponde a esta capa: `PhotoResult.module.css` deja de girar con `transform` y
> en su lugar **publica el ángulo** en `--strip-rotation`, que el hook lee de
> `getComputedStyle`.

### Qué cambia y por qué

- **`.strip`**: `transform: rotate(7.28deg)` fuera, `--strip-rotation: 7.28;`
  dentro. Es una custom property de mecanismo (puente CSS→JS), no uno de los 24
  tokens del contrato — vive en el componente porque el ángulo depende de la media
  query (`/review` endereza la tira por debajo de 768px) y solo la hoja de estilos
  sabe cuándo; un número en el TSX habría duplicado ese breakpoint ahí.
- **`.stripClassic`** y **`.stripWide`/`.stripSpotlight`**: `width`/`aspect-ratio`
  pasan de la caja real (205×599 vía `218/637`; 468×419) a la **envolvente** de esa
  caja girada 7,28° — fórmula `(w·cosθ + h·sinθ) × (w·sinθ + h·cosθ)`,
  `cos 7,28° = 0,9919398`, `sin 7,28° = 0,1267311`. El `<canvas>` ahora dibuja ya
  girado, así que necesita esa caja mayor para no recortarse; la tinta no cambia de
  tamaño ni posición — es la misma envolvente en la que ya desbordaba el bitmap
  girado por CSS, solo que antes sin clip.
- **`.stripWrapper`**: su tope sube de 520px a **566px** (517,23 + 2×24 de padding).
  Es obligatorio: por debajo de eso, `wide`/`spotlight` se habrían encogido en
  silencio un 9% — exactamente la trampa que documentó el propio comentario de D9c
  en esta clase.
- **Media query `≤768px`**: `--strip-rotation: 0` (nunca `transform: none` de
  nuevo — las dos cosas a la vez sumarían 14,56°) y las cajas vuelven a sus valores
  reales sin envolvente (205px/`218 / 637`, 468px/`468 / 419`): sin giro, envolvente
  y caja real coinciden.

### Lo que no se toca

`align-self: flex-end` en `.stripWrapper` (la mitad anterior de D9d) sigue igual:
su caja no cambia de naturaleza, solo de tamaño, así que el anclaje abajo-derecha
sobrevive intacto a este cambio — tal como se garantizó cuando se escribió.

Ningún token nuevo: `width`/`aspect-ratio` con números crudos ya era el patrón
existente en estas clases (218/637, 468/419 tampoco eran tokens); `--strip-rotation`
es mecanismo, no diseño reutilizable, y no entra en `index.css`.
