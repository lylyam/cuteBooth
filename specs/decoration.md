# Spec · DecorationPage `/decoration`

> Nodo **U3** · `ui-composer`. CSS en **D5**, manifiestos en **X1**, arrastre en **C5**.
> **DESBLOQUEADO el 2026-07-26.** Estaba marcada 🔴 porque no se encontraba la pantalla:
> el frame existía sin nombrar. Es `102:319`, ahora llamado "Decorarion". Y no es una
> pantalla, son **tres pasos** — confirmado por la propietaria el 2026-07-26.

## Objetivo

El usuario decora su tira en tres pasos: recorte, fondo y pegatinas.

## Entra / Sale

- **Entra con** `selectedLayout !== null` y `photos.length === 4`. Si no, guard (S3) → `/`.
- **Sale a** `/final` con `Next step →` en el paso 3.
- **Sale a** `/review` con `← Previous step` en el paso 1.
- **Nada es obligatorio.** Se pueden cruzar los tres pasos sin elegir nada y llegar a
  `/final` con la tira cruda.

## Una sola ruta, tres pasos

`/decoration` es **una ruta**. El paso es `useState` local de la página — no va en el
estado global, no se persiste, y no hay URL por paso. Siguen siendo **seis rutas**, como
dice [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) §9.

| #   | Paso        | Panel                | Escribe                                         |
| --- | ----------- | -------------------- | ----------------------------------------------- |
| 1   | Frames      | rejilla de recortes  | `SET_FRAME`                                     |
| 2   | Backgrounds | rejilla de fondos    | `SET_BACKGROUND`                                |
| 3   | Icons       | rejilla de pegatinas | `ADD_STICKER`, `MOVE_STICKER`, `REMOVE_STICKER` |

## Estructura — la misma en los tres pasos

Del nodo `102:319`, que es el paso 1 y **la plantilla de los otros dos**:

```
Frame 45 (943×543)
├── Frame 29 (425×543)   panel izquierdo: título + rejilla de 2 columnas, con scroll
└── Frame 7  (217×637)   preview de la tira — geometría del layout elegido
Frame 44 (1192×34)       [← Previous step]  ················  [Next step →]
```

El panel izquierdo y los botones **no cambian entre pasos**: cambia el título y el
contenido de la rejilla. Un solo componente de panel parametrizado, no tres.

## Copy

| Elemento            | Texto             | Origen               |
| ------------------- | ----------------- | -------------------- |
| Título panel paso 1 | `Frames`          | literal de `102:319` |
| Título panel paso 2 | `Backgrounds`     | supuesto             |
| Título panel paso 3 | `Icons`           | supuesto             |
| Botón izquierdo     | `← Previous step` | literal de `102:319` |
| Botón derecho       | `Next step →`     | literal de `102:319` |

## Los tres pasos, en detalle

### 1 · Frames

La rejilla muestra los **8 marcos del layout activo** — hay 8 por layout, en
`assets/frames/{classic,wide,spotlight}/`. Cada muestra se **genera del propio marco**,
recortando su SVG al primer hueco: así muestra y marco no pueden desincronizarse.

Elegir una escribe un `frame`, que es un id acotado a su layout (`'classic/Frame 7'`).
Cada SVG es la tira entera — borde exterior y cuatro huecos — y `canvasUtils` (C2) lo
pinta encima, escalado del viewBox al canvas. Detalle en
[../docs/contracts/assets.md](../docs/contracts/assets.md).

### 2 · Backgrounds

Los fondos son **por familia de layout**: 25 para `classic`, 21 para `wide` y
`spotlight`, que los comparten. Un id de fondo no vale para la otra familia.

**Requisito explícito de la propietaria:** la muestra de fondo **no** enseña la imagen
completa. Ocupa **el mismo hueco que una muestra de marco** y se ve como un rectángulo de
esquinas redondeadas **rellenado con la imagen recortada** (`object-fit: cover`). Nunca la
imagen entera encajada dentro.

**Aclarado el 2026-07-26 (decisión 17).** La redacción anterior decía "un cuadrado … del
mismo tamaño que las muestras de Frames", y eso se contradecía: las muestras de Frames no
son cuadradas (`classic` da 172×121). Lo que quería decir era **"que ocupe el mismo espacio
en pantalla"**, no que fuera 1:1. Así que **no** se fuerza `aspect-ratio: 1`: manda la caja
de la muestra de marco, y "cuadrado o rectángulo con bordes redondeados" describe el
aspecto, no una proporción exacta.

### 2.1 · Cómo se pinta el fondo

**Decisión 19.** El fondo **se repite como patrón**, no se estira. Se probó `cover` primero
y los de `classic` salían ampliados ×3,5 (son de 440×550 para un lienzo de 654×1911): el
patrón se veía gigante y blando. El tile se define en unidades de dibujo y escala con el
lienzo, de modo que **el preview enseña exactamente las mismas repeticiones que el PNG que
se descarga**. Si no fuera así, el usuario decoraría viendo una cosa y se llevaría otra.

### 3 · Icons

Hay **273 pegatinas en cuatro estilos** — `3dStyle` (102), `drawStyle` (75),
`feltStyle` (75), `pixelStyle` (21). Son 38 MB, así que se consumen **por URL** desde
`constants/stickers.ts` (`import.meta.glob` con `?url&no-inline`): salen a `dist/` como
ficheros y **no** entran dentro del JS. Cómo se agrupan los cuatro estilos en el panel
(pestañas, secciones o una lista sola) **no está dibujado**: ver supuesto 5.

**Tamaño (decisión 18):** cada pegatina entra en una caja de **20×20 unidades de dibujo**
(60 px en el PNG exportado, la constante `STICKER_BOX_UNITS`). No todas son cuadradas y
**no se deforman**: se aplica `contain`, el lado largo mide 20 y el corto sale de su
proporción. La caja de **agarre** sigue siendo el cuadrado completo aunque el dibujo sea más
estrecho — a 20 px CSS en el preview, ceñirla al dibujo dejaría objetivos de 10 px.

Clic en una pegatina la añade al centro de la tira (`ADD_STICKER`). Arrastrarla sobre el
preview la mueve (`MOVE_STICKER`), con la conversión px-CSS ↔ px-canvas de `useStickers`
(C5) — la página **no** hace esa aritmética. El orden del array `stickers` es el orden de
pintado: la última añadida va encima.

## Dependencias

- **Estado:** S1 (`SET_FRAME` y los tres de sticker), guard S3.
- **Hooks:** `useCanvas` (C4) para el preview, `useStickers` (C5) para el arrastre.
- **CSS:** `DecorationPage.module.css` (D5).
- **Assets:** `constants/{frames,backgrounds,stickers}.ts` (X1).
- **Componentes:** `Loading` (C7) mientras se cargan las imágenes del panel.

## Criterio de aceptación

- [ ] Una sola ruta `/decoration`; el paso no aparece en la URL ni en el estado global
- [ ] Los tres pasos comparten panel y botones: mismo componente, distinto contenido
- [ ] `← Previous step` en el paso 1 vuelve a `/review`; `Next step →` en el 3 va a `/final`
- [ ] Elegir un marco dibuja el SVG del marco **del layout activo** encajado con las fotos
- [ ] Los marcos no rectangulares recortan la foto con la forma de su hueco
- [ ] Las muestras de fondo ocupan el mismo hueco que las de Frames y llevan la imagen
      **recortada** (`cover`) con esquinas redondeadas — nunca la imagen completa, y **sin**
      forzar `aspect-ratio: 1` (decisión 17)
- [ ] Un sticker arrastrado se queda donde se suelta, también con la ventana redimensionada
- [ ] Cruzar los tres pasos sin elegir nada llega a `/final` sin errores
- [ ] El preview refleja cada cambio al momento, sin recargar
- [ ] Entrar en frío redirige a `/`
- [ ] `npm run build` y `npm run lint` limpios

## Fuera de alcance

Texto sobre la tira (sería un cuarto paso y hoy no lo es). Rotar o escalar pegatinas —
el contrato de estado solo guarda posición. Reordenar capas a mano. Deshacer/rehacer.
Elegir un recorte distinto por hueco. Volver a `/decoration` desde `/final`.

## Supuestos — no están en el diseño

1. **Títulos de panel de los pasos 2 y 3** (`Backgrounds`, `Icons`) inventados; el único
   literal es `Frames`.
2. **Borrar una pegatina:** arrastrarla fuera de la tira la elimina. No hay nada dibujado
   para esto y `REMOVE_STICKER` existe en el contrato, así que hace falta un gesto.
3. **La rejilla es de 2 columnas con scroll vertical**, como en el wireframe, donde está
   recortada por abajo.
4. **El preview del wireframe es `classic`.** `wide` y `spotlight` usan su geometría.
5. **Los cuatro estilos de pegatina se presentan como pestañas** dentro del panel del
   paso 3. Con 273 en una sola lista, encontrar algo es imposible; y el wireframe no
   dibuja el panel de iconos, así que hay que decidirlo.

## Nodos Figma

| Nodo      | Nombre en Figma           | Qué es                                               |
| --------- | ------------------------- | ---------------------------------------------------- |
| `102:319` | `Decorarion` _(con typo)_ | **Canónico.** El paso 1, Frames                      |
| `103:382` | `Decoration 2`            | **Duplicado exacto** de `102:319`. Conviene borrarlo |

Los pasos 2 y 3 **no están dibujados**: se construyen con la plantilla del paso 1.

**El arte ya está en el repo** (`src/assets/{frames,backgrounds,icons}`), subido el
2026-07-26. No hay que bajar nada de Figma. Inventario, renombrados pendientes y el
**dato que falta** — qué icono del menú corresponde a qué marco en cada layout — en
[../docs/contracts/assets.md](../docs/contracts/assets.md).
