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

### 3.1 · Borrar, y por qué sobresalir a medias es válido

**Decisión 20, cerrada por la propietaria el 2026-08-11.** Arrastrar una pegatina fuera de
la tira la borra (`REMOVE_STICKER`), **pero solo cuando sale completa**.

El motivo es suyo y es el que fija el umbral: **si la pegatina sobresale solo a medias, eso
es una decisión del usuario y se queda ahí, dibujada y cortada por el borde de la tira.**
Media pegatina asomando es una composición legítima, no un borrado a medio hacer.

En la práctica: se borra únicamente cuando la caja de agarre de 20×20 unidades **no
intersecta en absoluto** con el rectángulo del lienzo. Cualquier solape, por pequeño que
sea, conserva la pegatina. El recorte lo hace solo el propio canvas, que no dibuja fuera de
sus límites.

Importa porque no hay deshacer (está fuera de alcance): con el umbral en el centro, un
arrastre torpe pierde una pegatina sin vuelta atrás.

### 3.2 · Las pegatinas las pinta el CANVAS, no el DOM

**Decisión 21, del orquestador el 2026-08-11**, al encontrar dos geometrías para lo mismo.

`DecorationPage.module.css` (D5) trae `.stickerLayer` y `.sticker { width: 48px }`, una
capa de _handles_ DOM sobre el canvas. Pero `canvasUtils` (C2) **ya pinta las pegatinas
dentro del lienzo**, y 60 px de canvas son ~20 px CSS en un preview de 217 — no 48.

**Manda el canvas.** `useStickers` (C5) solo hace hit-test contra coordenadas de canvas, y
U3 **no** monta ninguna capa DOM de pegatinas. Dos motivos: una capa encima las dibujaría
dos veces y con tamaños distintos, y el canvas es además lo que se descarga, así que es la
única capa que no puede divergir de lo que se lleva el usuario.

**`.stickerLayer` y `.sticker` eran CSS muerto, y se borraron el 2026-08-11** (nodo D5b),
una vez cerrados C5 y U3 y confirmado por `grep` que ningún `.tsx` las consumía. Se
esperó a propósito: borrarlas antes habría sido tirar algo que C5 aún podía necesitar.

Es un caso de manual de
[../docs/orchestration/LECCIONES.md](../docs/orchestration/LECCIONES.md) §9: dos agentes en
paralelo que no se vieron, uno escribiendo una capa DOM de 48 px y el otro pintando dentro
del lienzo a ~20 px CSS. Si algún día reaparece la tentación de la capa DOM, el motivo por
el que no se hace está arriba, en §3.2.

### 3.3 · Lo que U3 tiene que cablear de `useStickers`, y lo que NO debe inventar

C5 cerró el 2026-08-11. Su firma real **no es** la de tres handlers que anunciaba
[../docs/orchestration/PLAN.md](../docs/orchestration/PLAN.md) §5; ahí está corregida.

```ts
const {
  stickers,
  draggingId,
  willRemove,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
} = useStickers(canvasRef, { layout, stickers: state.stickers, onMove, onRemove });
```

- **Los cuatro handlers van al `<canvas>`.** `onPointerCancel` no es opcional: sin él, un
  arrastre que pierda la captura se congela para siempre.
- **Dibuja con el `stickers` que devuelve el hook**, no con `state.stickers`:
  `draw({ ...state, stickers })`. Es el mismo array cuando no hay arrastre, así que puede
  ir en las dependencias del efecto sin provocar un bucle.
- **`onMove` despacha `MOVE_STICKER` y `onRemove` despacha `REMOVE_STICKER`.** Un gesto
  entero produce **un solo** dispatch, al soltar.
- **`ADD_STICKER` lo dispara la rejilla del panel**, no el hook.

Tres decisiones del orquestador sobre las dudas que dejó C5:

1. **`touch-action: none` se queda en línea, en el hook.** Lo escribe sobre el `<canvas>` al
   montar y lo restaura al desmontar. Podría vivir en `.canvas` de D5, pero entonces el
   arrastre táctil dependería de que otro agente mantenga una línea de CSS en otro fichero:
   exactamente la costura de LECCIONES §9. Medido sin él: el navegador se queda el gesto al
   segundo movimiento y **el arrastre táctil no existe**. El hook garantiza su propia
   precondición.
2. **Cursor `grab`/`grabbing`: no hay, y U3 no lo inventa.** Exigiría re-renderizar en cada
   movimiento del ratón o escribir CSS que no es suyo. Si la propietaria lo echa en falta al
   verlo, es una línea en D5 y `draggingId` ya está expuesto.
3. **`willRemove` se expone pero no hay señal visual de «suelta para borrar».** Decidirlo
   mirando, con la pantalla construida, no antes. Sin deshacer, una pista es probablemente
   buena idea — pero no se inventa el aspecto sin verla.

**Fuera de alcance, y declarado:** mover o borrar pegatinas con el teclado. El gesto es solo
de puntero. No está en este spec y C5 no lo implementa.

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
2. ~~**Borrar una pegatina:** arrastrarla fuera de la tira la elimina.~~ **Cerrado el
   2026-08-11 — ya no es un supuesto, es la decisión 20.** Ver abajo.
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
