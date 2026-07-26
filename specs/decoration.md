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

| # | Paso | Panel | Escribe |
|---|---|---|---|
| 1 | Frames | rejilla de recortes | `SET_FRAME_SET` |
| 2 | Backgrounds | rejilla de fondos | `SET_BACKGROUND` |
| 3 | Icons | rejilla de pegatinas | `ADD_STICKER`, `MOVE_STICKER`, `REMOVE_STICKER` |

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

| Elemento | Texto | Origen |
|---|---|---|
| Título panel paso 1 | `Frames` | literal de `102:319` |
| Título panel paso 2 | `Backgrounds` | supuesto |
| Título panel paso 3 | `Icons` | supuesto |
| Botón izquierdo | `← Previous step` | literal de `102:319` |
| Botón derecho | `Next step →` | literal de `102:319` |

## Los tres pasos, en detalle

### 1 · Frames

La rejilla muestra **una muestra por conjunto temático**, del tamaño de un hueco de foto
(172×121 en px de wireframe). Elegir una muestra escribe **un** `frameSet`, y ese id
implica los **cuatro** recortes: uno por hueco, distintos entre sí pero de la misma
temática. El usuario elige el tema, no la forma de cada hueco. El reparto vive en
`constants/frames.ts` (X1) y lo aplica `canvasUtils` (C2).

### 2 · Backgrounds

**Requisito explícito de la propietaria:** la muestra de fondo **no** enseña la imagen
completa. Es un cuadrado de esquinas redondeadas, del mismo tamaño que las muestras de
Frames, **rellenado con la imagen recortada** (`object-fit: cover`). Nunca la foto
entera encajada dentro.

### 3 · Icons

Clic en una pegatina la añade al centro de la tira (`ADD_STICKER`). Arrastrarla sobre el
preview la mueve (`MOVE_STICKER`), con la conversión px-CSS ↔ px-canvas de `useStickers`
(C5) — la página **no** hace esa aritmética. El orden del array `stickers` es el orden de
pintado: la última añadida va encima.

## Dependencias

- **Estado:** S1 (`SET_FRAME_SET` y los tres de sticker), guard S3.
- **Hooks:** `useCanvas` (C4) para el preview, `useStickers` (C5) para el arrastre.
- **CSS:** `DecorationPage.module.css` (D5).
- **Assets:** `constants/{frames,backgrounds,stickers}.ts` (X1).
- **Componentes:** `Loading` (C7) mientras se cargan las imágenes del panel.

## Criterio de aceptación

- [ ] Una sola ruta `/decoration`; el paso no aparece en la URL ni en el estado global
- [ ] Los tres pasos comparten panel y botones: mismo componente, distinto contenido
- [ ] `← Previous step` en el paso 1 vuelve a `/review`; `Next step →` en el 3 va a `/final`
- [ ] Elegir un frame set recorta **los cuatro** huecos, cada uno con su forma del set
- [ ] Las muestras de fondo son cuadrados redondeados con la imagen **recortada**, del
      tamaño de las muestras de Frames — nunca la imagen completa
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

## Nodos Figma

| Nodo | Nombre en Figma | Qué es |
|---|---|---|
| `102:319` | `Decorarion` *(con typo)* | **Canónico.** El paso 1, Frames |
| `103:382` | `Decoration 2` | **Duplicado exacto** de `102:319`. Conviene borrarlo |

Los pasos 2 y 3 **no están dibujados**: se construyen con la plantilla del paso 1.

**Pendiente para X1:** el arte de frames, fondos e iconos ya está subido a Figma, pero
faltan los node IDs de sus contenedores. `asset-pipeline` los pide al arrancar, o los
lee de la selección actual — `get_metadata` devuelve un bloque *"Currently selected
nodes"* con lo que haya seleccionado en el editor.
