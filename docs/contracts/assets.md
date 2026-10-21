# Contrato · Assets y manifiestos

> Dueño: `canvas-media` (nodo **X1**, reasignado el 2026-07-26 — `asset-pipeline` nunca se
> creó, y quien consume estos ficheros para dibujar es `canvas-media`).
> Consumidores: `canvas-media` (C2), `ui-composer` (U3).
> **El arte ya está en el repo**, subido el 2026-07-26. No hay que descargarlo de Figma.

## Lo que hay, verificado

```
src/assets/
├── frames/
│   ├── classic/Frame {7..14}.svg          8 · 218×637   · la tira ENTERA
│   ├── wide/Frame {7..14}.svg             8 · 468×419
│   ├── spotlight/Frame {7,8,9,10,12,13,15,18}.svg  8 · 468×419
│   └── icons for frames menu/*.svg        8 · muestras del panel
├── backgrounds/
│   ├── classic/{1..25}.png                25
│   └── wide-and-spotlight/{1..18,20,21,22}.png  21 · falta el 19
└── stickers/
    ├── 3dStyle/*.png     102        ├── feltStyle/*.png    75
    ├── drawStyle/*.png    75        └── pixelStyle/*.png   21
```

**273 pegatinas y 38 MB.** El volumen parecía justificar un agente propio, pero al
implementarlo resultó ser un nodo pequeño: `import.meta.glob` genera las listas, así que
todo el nodo fueron los renombrados más ~30 líneas. Lo ejecutó `canvas-media`, que es quien
las consume para dibujar.

## Por qué SVG, y no PNG

**Decisión 16, cerrada el 2026-07-26.** La pregunta era razonable: si el marco solo se
dibuja encima, ¿no sería más simple un PNG con los huecos recortados? No, y el motivo es
que **el fondo elegido se ve a través del marco**.

El marco es solo línea (trazo `#222`, sin relleno en el área de papel), así que el fondo
rellena la tira y las fotos se asoman por los huecos. Con un PNG hay dos opciones y las dos
fallan:

| PNG                                   | Qué pasa                                               |
| ------------------------------------- | ------------------------------------------------------ |
| Huecos transparentes, **papel opaco** | La foto encaja, pero el papel **tapa el fondo**        |
| Huecos y papel **transparentes**      | El fondo se ve, pero nada tapa las esquinas de la foto |

Con el fondo detrás **hay que recortar la foto con la forma del hueco**, y para recortar
hace falta la forma — información que el SVG tiene y el PNG no. Súmale que la tira se
exporta a 3× (`classic` sale a 654×1911): el vector aguanta, un PNG habría que exportarlo
ya a ese tamaño.

## Los huecos son formas cerradas dentro del propio marco

**Así llegó el arte definitivo el 2026-07-26**, y así se consume. Cada uno de los 24 SVG
trae sus **4 huecos como `<path>` cerrado y con relleno**, aplanados desde el grupo
booleano original. Eso da las dos cosas que hacen falta, del mismo fichero:

1. **Recorte exacto**: `new Path2D(d)` + `ctx.clip()`. Sin parsear máscaras, sin
   reconstruir nada a mano, y escala a cualquier resolución.
2. **El dibujo de encima**: el mismo fichero, renderizado como imagen.

### El relleno hay que neutralizarlo al dibujar

**Esto es la trampa del nodo C2, y no es opcional.** Los huecos vienen con
`fill="#222222"`, que es lo que permite distinguirlos del arte (que es solo trazo). Si el
SVG se pinta encima **tal cual**, esos rellenos tapan las 4 fotos con bloques oscuros.

Así que C2, del mismo texto SVG que ya descarga, deriva **dos** cosas:

- los `d` de los huecos → `Path2D` para recortar,
- una copia con el relleno de esos huecos puesto a `none` → la capa que se dibuja encima.

Un fichero, dos usos derivados, cero desincronización. Mismo argumento que ganó en la
muestra del menú.

### Identificar un hueco

**Relleno distinto de `none` = hueco. Solo trazo = arte.** El export de Figma no incluyó
los `id`, así que el nombre del grupo `holes` no está en el fichero — y no hace falta: la
distinción relleno/trazo es suficiente y se verificó en los 24.

### Dos cosas verificadas que hay que conocer

- **`spotlight/Frame 18.svg` trae los 4 huecos DUPLICADOS** (8 formas rellenas, dos copias
  exactas de cada hueco). Es un artefacto del aplanado. La geometría es correcta, así que
  **se deduplica en código** por `d` idéntico: no se le pide a nadie reexportar por esto.
- **En los marcos con forma, la caja del hueco NO coincide con el rectángulo de
  [layouts.md](layouts.md)**, y eso es correcto: una nube inscrita en el hueco tiene una
  caja algo menor. Medido, la desviación llega a 6,2 px en `classic/Frame 10`. **No es
  error, es la forma.** Consecuencia: la foto se ajusta a la caja **del hueco**, no al
  rectángulo del layout. Los rectángulos de `layouts.ts` siguen mandando para el tamaño del
  canvas, para los marcos rectangulares y para la ventana de la muestra.

## Un marco no son cuatro máscaras

Corrige la primera versión de este contrato. Un fichero de marco es **el dibujo
completo de la tira para UN layout**: rectángulo exterior más los cuatro huecos, en
trazo `#222222` de `1.94px`, sin relleno. Los marcos con formas raras (nube, orejas de
gato) sustituyen el hueco rectangular por `path` + `mask`.

```ts
// src/constants/frames.ts
export type FrameId = `${LayoutId}/${string}`; // p. ej. 'classic/Frame 7'

export type FrameDef = {
  id: FrameId;
  layout: LayoutId;
  art: string; // URL del SVG del marco
  viewBox: Rect; // el viewBox completo del SVG
  swatch: Rect; // ventana de recorte para la muestra del menú, en unidades de viewBox
};

export const FRAMES: Record<LayoutId, FrameDef[]>; // 8 por layout
```

**Los IDs de marco son por layout, y eso disuelve el problema del mapeo.** No hace falta
saber qué marco de `classic` es "el mismo" que cuál de `wide`: el layout se elige **antes**
de decorar y no hay camino de vuelta a `/layout`. Un `frame` solo tiene que resolver
dentro de su propio layout.

Consecuencias:

1. **El estado guarda un solo `FrameId`**, válido únicamente para el layout activo. Ver
   [state.md](state.md).
2. **`canvasUtils` (C2) dibuja el marco como capa superior**, escalado del viewBox del
   SVG al canvas del layout. No lo reconstruye con `Path2D` a mano.
3. **Recortar la foto solo hace falta en los marcos no rectangulares.** El recorte sale
   del mismo SVG, no de una lista aparte.

## La muestra del menú se genera del propio marco

**Decidido el 2026-07-26.** `assets/frames/icons for frames menu/` **no se usa**. Para
cada marco, la muestra es su propio SVG recortado al **primer hueco** (el de menor `y`,
luego menor `x`) con un margen pequeño.

**Revisado el 2026-10-19** por la propietaria: en un marco de formas mezcladas el primer
hueco no siempre nombra el tema, y los ficheros no coinciden en número entre layouts (el
óvalo es `Frame 13` en `classic`, `Frame 8` en `wide` y `Frame 7` en `spotlight`). La tabla
`FRAME_MENU` (`frames.ts`) fija, por layout, el **orden** del menú —los mismos 8 temas en
los tres: rectángulo, conejo, cúpula, ticket, mancha, corazón, óvalo, gato— y el **hueco**
de cada muestra. Sigue siendo el mismo fichero: solo cambia qué ventana se recorta. Un
fichero nuevo que la tabla no liste aparece al final, en orden numérico.

Es determinista y **no puede desincronizarse**: muestra y marco son el mismo fichero. La
alternativa —mantener a mano una tabla de 8 iconos × 3 layouts— era el único dato que
faltaba para cerrar X1, y así deja de faltar.

**Corregido al implementar X1: el `swatch` es un rect, no un `string`.** No existe string
honesto — recortar un SVG exige un `viewBox`, y a un `<img>` no se le puede dar uno. Así
que el manifiesto entrega la **ventana de recorte** en unidades de `viewBox` y la UI
recorta con su propio `viewBox` o con una caja `overflow: hidden` escalada. Las
alternativas eran generar 24 SVG nuevos en disco o incrustar 224 KB de markup en el JS.

Consecuencia que hay que conocer: la ventana de recorte **es la misma para los 8 marcos de
un layout** (sale de `LAYOUTS[layout].slots[0]`). Lo que distingue una muestra de otra es
la **forma dibujada dentro**, que es justo lo que la muestra debe enseñar.

La carpeta de iconos del menú se queda donde está, sin usar. Borrarla es decisión de
diseño, no de código.

## Los fondos valen para cualquier layout

**Revisado el 2026-10-21** (decisión 23). El arte sigue en dos carpetas —`classic` (25) y
`wide-and-spotlight` (21)—, pero **los 46 valen para los tres layouts**: `BACKGROUND_LIST`
los lista todos, los de `classic` primero. La familia se queda en el id solo porque
`classic/1` y `wideAndSpotlight/1` son dibujos distintos, y así ningún id guardado deja de
valer. Un patrón de una familia se ve bien en la otra porque se repite a un píxel natural
por unidad de lienzo (decisión 19): su escala no depende de la tira.

Además del arte, un fondo puede ser un **color plano** (`SolidColor`, `'#rrggbb'`,
decisión 24), que no es un asset: no tiene fichero ni miniatura y se pinta como relleno; o
**el fondo que sube el usuario** (decisión 26): `background: 'upload'` y los píxeles en
`state.uploadedBackground`, recortados al lienzo del layout al subirlos y pintados
**cubriendo** la tira, no repetidos.

```ts
export type BackgroundChoice = BackgroundId | SolidColor; // lo que guarda state.background
export function resolveBackground(value: unknown): ResolvedBackground | null;
```

Antes de esta revisión los fondos eran por familia y un id de una no valía en la otra.

## Reglas

1. **Nada de meter 38 MB DENTRO del bundle.** Lo que esta regla protege es el tamaño del
   JS, y se cumple con `import.meta.glob` + `query: '?url&no-inline'`: Vite emite los 343
   ficheros a `dist/` y en el JS solo quedan las cadenas de URL. **No se usa `public/`** —
   como se decidió al implementar X1, porque a `public/` no se le puede hacer glob y
   volveríamos a escribir 343 rutas a mano, además de perder el hash de caché.

   **`no-inline` no es decorativo.** Sin él, Vite incrusta en base64 todo fichero por
   debajo de su `assetsInlineLimit` (4 KB): serían 27 ficheros dentro del JS, entre ellos
   12 de los 24 SVG de marco. Era el error silencioso de este nodo.

   Los **marcos** además entran al grafo de módulos: hacen falta como contenido, no solo
   como URL, para poder recortar con ellos.

2. **Los IDs son tipados y estables.** Un manifiesto es la lista de IDs con su ruta; si
   cambia el arte, cambia el manifiesto y **nadie más se toca**. Ese es todo el valor
   del patrón.
3. **Un `frame`, `background` o sticker desconocido al rehidratar se trata como
   `null`.** El manifiesto manda sobre el estado guardado. Un `frame` de otro layout
   cuenta como desconocido.

   ⚠️ **Corregido en C2b (2026-07-27): `frame: null` NO significa «sin marco».** Significa
   «el usuario no ha elegido todavía», y la composición dibuja el **rectangular simple** del
   layout (`classic/Frame 7`, `wide/Frame 7`, `spotlight/Frame 8`). Lo pidió la propietaria:
   una tira sin borde ni esquinas redondeadas no parece una tira.

   **Ya no existe ningún valor que signifique «sin marco».** Si algún día hace falta una
   celda «None» en el panel de decoración, es un cambio de contrato explícito, no un `null`
   disfrazado.

   El respaldo vive en el **manifiesto**, no en `canvasUtils`: `DEFAULT_FRAME_ID`,
   `getDefaultFrame()` y `getEffectiveFrame()`. Y esa última es la que **debe usar la UI de
   `/decoration`** para pintar la celda seleccionada — si leyera `state.frame` directamente,
   el lienzo enseñaría `Frame 7` con la rejilla sin nada marcado.

4. Quien ejecute X1 **no escribe CSS ni TSX.** Solo `assets/**` y
   `constants/{frames,backgrounds,stickers}.ts`.

## Renombrados — HECHOS en X1 el 2026-07-26

302 ficheros movidos con `git mv`, así que el historial de cada uno sigue intacto.

| Antes                           | Ahora                                | Por qué                                                         |
| ------------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| `frames/square/`                | `frames/spotlight/` ✅               | `square` miente: ese layout es apaisado                         |
| `backgrounds/wide and square/`  | `backgrounds/wide-and-spotlight/` ✅ | Espacios en rutas de import                                     |
| `icons/`                        | `stickers/` ✅                       | Son pegatinas, no iconos de UI. `assets/icons/` inducía a error |
| `frames/icons for frames menu/` | _sin tocar_                          | **Sin usar.** Las muestras se generan del marco                 |

`frames/spotlight/` **no** contiene `Frame 7..14` como `classic` y `wide`: sus nombres
reales son `7, 8, 9, 10, 12, 13, 15, 18`. No lo supongas, míralo.

Los nombres de fichero (`1.png`, `Frame 7.svg`) **se dejan como están**: renombrar 320
ficheros para ganar legibilidad que el manifiesto ya da es trabajo sin retorno.

## Criterio de aceptación de X1

- [x] `constants/{frames,backgrounds,stickers}.ts` exportan IDs tipados y sus rutas
- [x] `FRAMES` tiene 8 entradas por layout, y ninguna apunta a un fichero que no existe
      (verificado, no supuesto)
- [x] Cada marco tiene su muestra generada de su propio SVG, recortada al primer hueco
- [x] La geometría que usa S2 sale de los tres marcos rectangulares que lista
      [layouts.md](layouts.md)
- [x] `BACKGROUND_FAMILY` cubre los 3 layouts
- [x] Ningún icono ni fondo entra DENTRO del JS (`no-inline`); los marcos sí como módulo
- [x] Los tres renombrados hechos con `git mv`. La única ruta con espacios que queda es
      `frames/icons for frames menu/`, que por decisión **no se usa ni se importa**
- [x] `npm run build` limpio y el tamaño del bundle no crece con los 38 MB

**Verificado por el orquestador el 2026-07-26** ejecutando los manifiestos, no leyéndolos:
`FRAMES` 8/8/8, `BACKGROUNDS` 25/21, `STICKERS` 273, `BACKGROUND_FAMILY` cubre los tres
layouts, `getFrame('nope/x')` → `null` y `getFrameForLayout('classic/Frame 7','wide')` →
`null` (un marco de otro layout cuenta como desconocido, regla 3).

El JS de `dist/` sigue en 243 kB porque hoy nadie importa los manifiestos; medido con un
entry de prueba que sí los importa, el coste real es **+27 kB de JS** y 343 ficheros
emitidos, con **0 coincidencias** de `data:image` en el bundle.
