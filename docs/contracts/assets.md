# Contrato · Assets y manifiestos

> Dueño: `asset-pipeline` (nodo **X1**).
> Consumidores: `canvas-media` (C2), `ui-composer` (U3).
> **El arte ya está en el repo**, subido el 2026-07-26. No hay que descargarlo de Figma.

## Lo que hay, verificado

```
src/assets/
├── frames/
│   ├── classic/Frame {7..14}.svg          8 · 218×637   · la tira ENTERA
│   ├── wide/Frame {7..14}.svg             8 · 468×419
│   ├── square/Frame {7,8,9,10,12,13,15,18}.svg   8 · 468×419
│   └── icons for frames menu/*.svg        8 · muestras del panel
├── backgrounds/
│   ├── classic/{1..25}.png                25
│   └── wide and square/{1..18,20,21,22}.png   21 · falta el 19
└── icons/
    ├── 3dStyle/*.png     102        ├── feltStyle/*.png    75
    ├── drawStyle/*.png    75        └── pixelStyle/*.png   21
```

**273 iconos y 38 MB.** Eso confirma que `asset-pipeline` sigue siendo un agente
propio y no se fusiona con `figma-design-sync` (el umbral estaba en ~15 assets).

## Un marco no son cuatro máscaras

Corrige la primera versión de este contrato. Un fichero de marco es **el dibujo
completo de la tira para UN layout**: rectángulo exterior más los cuatro huecos, en
trazo `#222222` de `1.94px`, sin relleno. Los marcos con formas raras (nube, orejas de
gato) sustituyen el hueco rectangular por `path` + `mask`.

```ts
// src/constants/frames.ts
export type FrameId = /* los 8 del menú */;

export type FrameDef = {
  id: FrameId;
  menuIcon: string;                        // icons for frames menu/*.svg
  art: Record<LayoutId, string>;            // un SVG por layout
};
```

Consecuencias:

1. **El estado guarda un solo `FrameId`**, y el layout activo elige el SVG. Ver
   [state.md](state.md).
2. **`canvasUtils` (C2) dibuja el marco como capa superior**, escalado del viewBox del
   SVG al canvas del layout. No lo reconstruye con `Path2D` a mano.
3. **Recortar la foto solo hace falta en los marcos no rectangulares.** El recorte sale
   del mismo SVG, no de una lista aparte.

## Los fondos son por familia de layout, no globales

`classic` tiene su juego; `wide` y `spotlight` comparten otro. Un `BackgroundId` **no
es válido para las dos familias**, y las cuentas no coinciden (25 frente a 21).

```ts
export type BackgroundFamily = 'classic' | 'wideAndSpotlight';
export const BACKGROUND_FAMILY: Record<LayoutId, BackgroundFamily>;
```

Si algún día se cambia de layout con un fondo ya elegido, el fondo se descarta. Hoy no
puede pasar: el layout se elige antes de decorar y `/layout` no es alcanzable desde
`/decoration`.

## Reglas

1. **Nada de importar 38 MB por el bundler.** Los iconos y los fondos se sirven por URL
   desde `public/`, no como módulos de Vite. Los **marcos** sí se importan: son 24 SVG
   de trazo, 324 KB en total, y hay que poder recortar con ellos.
2. **Los IDs son tipados y estables.** Un manifiesto es la lista de IDs con su ruta; si
   cambia el arte, cambia el manifiesto y **nadie más se toca**. Ese es todo el valor
   del patrón.
3. **Un `frame`, `background` o sticker desconocido al rehidratar se trata como
   `null`.** El manifiesto manda sobre el estado guardado.
4. `asset-pipeline` **no escribe CSS ni TSX.** Solo `assets/**` y
   `constants/{frames,backgrounds,stickers}.ts`.

## Renombrados que toca hacer en X1

| Hoy | Debe ser | Por qué |
|---|---|---|
| `frames/square/` | `frames/spotlight/` | `square` miente y se renombra en S2 |
| `backgrounds/wide and square/` | `backgrounds/wide-and-spotlight/` | Espacios en rutas de import |
| `frames/icons for frames menu/` | `frames/menu-icons/` | Igual |
| `icons/` | `stickers/` | Son pegatinas, no iconos de UI. `assets/icons/` induce a error |

Los nombres de fichero (`1.png`, `Frame 7.svg`) **se dejan como están**: renombrar 320
ficheros para ganar legibilidad que el manifiesto ya da es trabajo sin retorno.

## Pendiente de un dato — bloquea X1 parcialmente

**¿Qué icono del menú corresponde a qué marco, en cada layout?** No se puede deducir:
son 8 iconos con nombres de Figma (`Ellipse 68`, `Subtract`, `Union-1`…) y 8 marcos por
layout con numeración que **no coincide entre layouts** — `classic` va del 7 al 14,
`spotlight` es 7, 8, 9, 10, 12, 13, 15, 18. Hacen falta las ocho ternas
`icono → classic → wide → spotlight`. Solo lo sabe quien dibujó los marcos.

Mientras no esté, X1 puede generar el manifiesto de fondos y de pegatinas, y dejar el de
marcos declarado pero vacío.

## Criterio de aceptación de X1

- [ ] `constants/{frames,backgrounds,stickers}.ts` exportan IDs tipados y sus rutas
- [ ] Los 8 marcos tienen los 3 layouts resueltos, y ninguno apunta a un fichero que no
      existe (verificado, no supuesto)
- [ ] `BACKGROUND_FAMILY` cubre los 3 layouts
- [ ] Ningún icono ni fondo entra por el bundler; los marcos sí
- [ ] Las cuatro rutas de §Renombrados están renombradas y no queda ninguna con espacios
- [ ] `npm run build` limpio y el tamaño del bundle no crece con los 38 MB
