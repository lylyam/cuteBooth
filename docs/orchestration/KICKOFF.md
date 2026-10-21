# Briefing de arranque

> **Empieza aquí.** Punto de entrada para cualquier agente o persona que retome
> CuteBooth. Autosuficiente.
> Estado a **2026-08-11**. **34 nodos cerrados y DAG-1 completo.** El producto se recorre
> ENTERO: `/` → `/layout` → (`/camera` | `/upload`) → `/review` → `/decoration` → `/final`,
> con clics reales y cero errores de consola. Detalle en §6.

## 1. Qué es CuteBooth

Photobooth en navegador, 100 % cliente, sin backend. El usuario elige un layout,
consigue 4 fotos (cámara o subida), las revisa, las decora con fondo y stickers, y
descarga la imagen compuesta. React 19 + TypeScript + Vite 8 + CSS Modules.

**Estado real: las seis rutas funcionan y están dadas de alta** en `src/App.tsx`. Una
sesión sobrevive a un refresco (S4). Tabla completa en §6.

## 2. Orden de lectura

| #   | Documento                                | Para qué                                                         |
| --- | ---------------------------------------- | ---------------------------------------------------------------- |
| 1   | `CLAUDE.md`                              | Reglas del repo. Se carga solo en todos los agentes              |
| 2   | [../ARCHITECTURE.md](../ARCHITECTURE.md) | Capas, flujo definitivo, deudas conocidas                        |
| 3   | [DAG.md](DAG.md)                         | Qué hacer ahora y qué bloquea a qué                              |
| 3b  | [LECCIONES.md](LECCIONES.md)             | Trampas que ya costaron tiempo. **Antes de tocar código**        |
| 3c  | [HANDOFF.md](HANDOFF.md)                 | **Solo si orquestas.** Lo que sabía el anterior y no escribió    |
| 4   | [PLAN.md](PLAN.md)                       | Qué agente es dueño de qué                                       |
| 5   | `../contracts/*.md`                      | Solo el contrato que te toque                                    |
| 6   | `../../specs/*.md`                       | Solo el spec de tu pantalla: copy literal, aceptación, supuestos |
| 7   | [../design/FIGMA.md](../design/FIGMA.md) | Solo si tocas diseño                                             |

No leas `Analisis/`. Ver regla 3.

## 3. Las siete reglas innegociables

1. **Las capas solo apuntan hacia abajo.**
   `pages → components → hooks → context/services → utils/constants/assets`.
   Un componente nunca llama a `getUserMedia`, `canvas.getContext` ni
   `sessionStorage`. Un hook nunca importa un componente.
2. **Un fichero, un dueño.** Consulta la matriz de [PLAN.md](PLAN.md) §4 antes de
   escribir. Si el fichero no es tuyo, repórtalo, no lo edites.
3. **Nunca leas `Analisis/`.** 171 KB de notas sobre otros proyectos, en `.jsx`,
   describiendo carpetas vacías. Ver [../reference/TRIAJE.md](../reference/TRIAJE.md).
4. **Ningún valor visual hardcodeado.** Colores, radios y espaciados van a custom
   properties de `:root` en `index.css`.
5. **`npm run build` limpio antes de dar nada por terminado.** Es la única puerta
   automática: no hay runner de tests.
6. **`src/App.tsx` lo toca solo el orquestador.** Es el registro de rutas.
7. **Si te falta un dato, pregunta.** No inventes geometría, copy ni alcance.

## 4. Decisiones de producto — CERRADAS

No las reabras. Las cerró la propietaria del proyecto entre el 2026-07-26 y el 2026-08-11;
las fechas exactas, bajo la tabla.

**Solo la propietaria revisa una decisión cerrada**, y cuando lo hace la fila lo dice: se
reescribe con la fecha y con lo que decía antes. Una fila con «Revisada el …» es la versión
vigente, no una propuesta. Ningún agente puede reabrir una decisión por su cuenta — si crees
que una está mal, repórtalo y pregunta.

| #   | Decisión                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **`square` → `spotlight`.** El nombre viejo mentía. Se renombra **en S2**, antes de que nada dependa de él                                                                                                                                                                                                                                                                                                                                                                  |
| 2   | **`/review` (Selected pictures) entra en alcance.** Es una ruta más, entre captura y decoración                                                                                                                                                                                                                                                                                                                                                                             |
| 3   | **`Loading` es un componente, no una ruta.** `components/ui/Loading.tsx`                                                                                                                                                                                                                                                                                                                                                                                                    |
| 4   | **`/final` existe en Figma** (`2074:52`) y es una copia de `/review` con otro copy y la foto ya decorada. **Comparten el componente `PhotoResult`**                                                                                                                                                                                                                                                                                                                         |
| 5   | **Todo el texto de usuario en inglés**, incluidos los `alt`                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 6   | **No se crean variables en Figma.** Los tokens son code-first: `index.css` manda                                                                                                                                                                                                                                                                                                                                                                                            |
| 7   | **`/decoration` son TRES PASOS en una sola ruta**, no tres rutas: Frames → Backgrounds → Icons. El paso es estado local de la página                                                                                                                                                                                                                                                                                                                                        |
| 8   | **Un marco es un conjunto temático de 4 recortes**, uno por hueco. El usuario elige el tema, no la forma de cada hueco. Añade `frame` al estado                                                                                                                                                                                                                                                                                                                             |
| 9   | **En `/upload` cada hueco es un botón** que abre el selector de archivos. `Continue` está siempre visible y deshabilitado hasta las 4 fotos                                                                                                                                                                                                                                                                                                                                 |
| 10  | **En el menú de fondos la muestra NO enseña la imagen completa**: esquinas redondeadas y la imagen recortada. Su tamaño lo **matiza la decisión 17**                                                                                                                                                                                                                                                                                                                        |
| 11  | **`/final` lleva copy propio**, no el de `/review`: `Here's your decorated strip!` · `Download it, or start over to make a new one.` Botones `Download` y `Retake`                                                                                                                                                                                                                                                                                                          |
| 12  | **`Retake` vuelve a `/layout` y reinicia todo** (`RESET`): se eligen layout y origen otra vez, y la decoración se pierde siempre. **Revisada el 2026-08-18** por la propietaria; antes volvía al origen conservando layout y decoración                                                                                                                                                                                                                                     |
| 13  | **La geometría de los huecos la manda el ARTE de los marcos**, no el wireframe de Upload. Los números están en [../contracts/layouts.md](../contracts/layouts.md), extraídos de los tres marcos rectangulares                                                                                                                                                                                                                                                               |
| 14  | **La muestra del menú de Frames se genera del propio marco**, recortando su SVG al hueco que nombra el tema. **Los tres layouts muestran los mismos 8 temas en el mismo orden**: rectángulo, conejo, cúpula, ticket, mancha, corazón, óvalo, gato. Orden y hueco, en la tabla `FRAME_MENU` de `frames.ts`. `assets/frames/icons for frames menu/` no se usa. **Revisada el 2026-10-19** por la propietaria; antes era siempre el primer hueco, en orden numérico de fichero |
| 15  | **Los IDs de marco están acotados a su layout** (`'classic/Frame 7'`). No hay correspondencia entre layouts, y no hace falta                                                                                                                                                                                                                                                                                                                                                |
| 16  | **Los marcos se quedan en SVG**, y cada hueco es una **forma cerrada rellena** dentro del propio fichero. No se pasan a PNG. Motivo en [../contracts/assets.md](../contracts/assets.md) § _Por qué SVG_                                                                                                                                                                                                                                                                     |
| 17  | **La muestra de un fondo ocupa el mismo hueco que la de un marco**: rectángulo de esquinas redondeadas con la imagen recortada. **No** se fuerza a 1:1 — "cuadrado" quería decir "misma caja", no cuadrado                                                                                                                                                                                                                                                                  |
| 18  | **Las pegatinas se añaden a 40×40 unidades de dibujo** en `classic` (120 px en el PNG; las otras tiras, en proporción), y **se pueden girar y reescalar** (×0,5 a ×3) con dos tiradores sobre la pegatina seleccionada, que solo se ven en el preview. No se deforman: `contain`. **Revisada el 2026-10-18** por la propietaria; antes medían 20×20 fijas y no giraban                                                                                                      |
| 19  | **Los fondos se REPITEN como patrón**, no se estiran a `cover`. El tile va en unidades de dibujo, así que se ven las mismas repeticiones en el preview y en la descarga                                                                                                                                                                                                                                                                                                     |

| 20 | **Arrastrar una pegatina fuera de la tira la borra, pero SOLO si sale completa.** Sobresalir a medias es una decisión del usuario: la pegatina se queda y se ve cortada por el borde |
| 21 | **Las pegatinas las pinta el canvas, no el DOM.** `useStickers` hace hit-test en coordenadas de canvas. Las clases `.sticker`/`.stickerLayer` que D5 habia escrito para una capa DOM **se borraron en D5b**: no existen |
| 22 | **La pausa entre fotos sube a 1,5 s** (`SHOT_GAP_MS`); la cuenta atrás se queda en 3 s. Es el único hueco para cambiar de pose entre fotos. La sesión pasa de 14,4 s a **16,5 s** |
| 23 | **Los 46 fondos valen para los tres layouts.** Los de `classic` se usan en `wide`/`spotlight` y al revés; el panel lista los de `classic` y luego los de `wide-and-spotlight`. La carpeta sigue en el id (`classic/1` ≠ `wideAndSpotlight/1`), así que ningún id guardado se invalida. Cerrada el 2026-10-21; antes cada familia era exclusiva de sus layouts |
| 24 | **Un fondo puede ser un color plano**, elegido con la muestra arcoíris, que es **la primera** del paso 2 y abre una rueda de color (matiz y saturación) con un control de brillo y un **campo hex editable** (`#a1b2c3`, sin `#` o en mayúsculas; el corto `#fa0` cuenta al pulsar Enter o salir del campo). La muestra arcoíris va en **tonos pastel**; la rueda, en tonos plenos. `state.background` admite `'#rrggbb'`. ⚠️ **La rueda es PROVISIONAL**: solo vale cuando la propietaria la pruebe a mano, y puede cambiarse por el `<input type="color">` del navegador. Cerrada el 2026-10-21 |
| 25 | **Elegir fondo es obligatorio.** En el paso 2, `Next step →` está deshabilitado hasta que hay un fondo (imagen o color), con el aviso `Pick a background to continue.` Cerrada el 2026-10-21 |
| 26 | **El usuario puede subir su propio fondo.** La última muestra del paso 2 es un botón vacío con borde y `+`. La imagen **cubre la tira** (no se repite) y se recorta al lienzo del layout al subirla. **Solo se guarda la última**: su muestra aparece justo antes del botón, y subir otra la sustituye. Vive en `state.uploadedBackground` y sobrevive a una recarga. Cerrada el 2026-10-21 |

Las decisiones 7-15 se cerraron el 2026-07-26, en la sesión que cerró DAG-0. Las **16 y
17**, el mismo día, cuando aterrizó el arte definitivo de los marcos. Las **18 y 19** el
2026-07-27, al ver la primera composición real y comprobar que los fondos salían
ampliados ×3,5. La **20** el 2026-08-11, al despachar C5 — y su umbral no es un detalle de
implementación: no hay deshacer, así que borrar por el centro pierde pegatinas sin vuelta
atrás. La **21** el mismo día, al encontrar dos geometrías para la misma pegatina (48 px en
el CSS de D5 contra ~20 px CSS del canvas). Las dos, detalladas en
[../../specs/decoration.md](../../specs/decoration.md) §3.1 y §3.2.

La **22** el mismo día, al despachar `/camera`: los tiempos de la sesión de cámara los
había elegido un agente en C3, no el diseño, y estaban pendientes como pregunta A5. Ahora
son decisión suya. Detalle en [../../specs/camera.md](../../specs/camera.md).

El flujo resultante son **seis rutas**, en [../ARCHITECTURE.md](../ARCHITECTURE.md) §9.

## 5. Herramientas y MCP

- **Figma MCP: conectado y verificado.** `fileKey df7hAve66qYTKiNz0UXE1E`. Los
  tools se llaman directamente, sin `@`. Node IDs y reglas en
  [../design/FIGMA.md](../design/FIGMA.md). **Nunca `get_metadata` sobre `0:1`.**
- **Ningún otro MCP.** Descartados con motivo en [PLAN.md](PLAN.md) §9.
- **No hay tests.** No instales un runner sin acordarlo: es cambio de alcance.

## 6. Qué está construido, y qué falta

**34 nodos cerrados y DAG-1 completo.** Las seis rutas funcionan de punta a punta.

| Ruta          | Estado                                                              |
| ------------- | ------------------------------------------------------------------- |
| `/`           | ✅ funciona                                                         |
| `/layout`     | ✅ funciona · elige layout y `source`                               |
| `/camera`     | ✅ funciona · 4 capturas con cuenta atrás, y los 8 estados de error |
| `/upload`     | ✅ funciona · 4 huecos, cada uno abre el selector                   |
| `/review`     | ✅ funciona · la tira compuesta en canvas                           |
| `/decoration` | ✅ funciona · tres pasos, arrastre de pegatinas                     |
| `/final`      | ✅ funciona · descarga el PNG                                       |

Y por debajo, **todo**: reducer de 7 campos y 13 acciones, geometría de los 3 layouts,
guards, primitivas de imagen, composición sobre canvas con recorte por la forma del hueco,
hooks de cámara, canvas y arrastre, persistencia cableada, y los manifiestos de los 343
ficheros de arte.

**Del grafo original solo queda `D2`** (Code Connect), que siempre fue opcional.

**Lo que de verdad queda pendiente no es código, son las revisiones `R*`**: siete pantallas
construidas y **ninguna revisada**. Es la deuda más grande del proyecto. `booth-reviewer`
existe desde el 2026-08-11 y está para eso.

Lo abierto con la propietaria, con detalle en [DAG.md](DAG.md) §9: **A3** (fondo plano con
selector de color — alcance nuevo que ella pidió), y la deuda menor D3, D8-D12.

### El muro, derribado el 2026-08-11

**`booth-reviewer` ya existe**, decidido por la propietaria. Era el único agente de fase 2
sin crear, y el único que no se podía reasignar sin perder su sentido: **juzga código que
no ha escrito**. Si lo revisa quien lo escribió, no es una revisión.

**La flota está completa** y ningún nodo del DAG se queda sin dueño. Ya había pasado dos
veces que un nodo llegara sin agente (`asset-pipeline` en X1, `ui-composer` en las
páginas): las dos se resolvieron, pero costaron una ronda cada una.

Lo que sigue pendiente no es el agente, es el trabajo: **siete pantallas construidas y
ninguna revisada todavía**. Y ojo: **el registro de agentes no se recarga en caliente**, así
que para usarlo hay que abrir una sesión nueva.

## 7. Por dónde seguir

**El camino crítico está recorrido entero** (`S2 → C2 → C4 → C5 → U3`) y el producto
funciona. Ya no hay camino crítico que planificar: lo que queda no bloquea a nada.

Dos cosas, por orden de valor:

1. **Las revisiones `R*`, con `booth-reviewer`.** Siete pantallas y ninguna revisada. Es lo
   único grande que queda, y **necesita una sesión nueva** para que el agente exista. Se
   revisa **por pantalla**, no las siete de golpe: cinco features juntas hacen un arreglo
   caro ([PLAN.md](PLAN.md) §7, cuello 5).
2. **`A3` — fondo de color plano con selector.** Alcance nuevo, pedido por la propietaria el
   2026-08-11. No es un ajuste: toca el contrato de estado, la composición sobre canvas, el
   panel de `/decoration` y su CSS, o sea **los cuatro agentes**. Detalle y reparto en
   [DAG.md](DAG.md) §9.

`D2` (Code Connect) sigue abierto y sigue siendo opcional.

**Antes de tocar nada, lee [LECCIONES.md](LECCIONES.md).** Son las trampas que ya costaron
tiempo en este proyecto, y varias no se deducen del código.

## 8. Cómo reportar al terminar un nodo

```
NODO      : <id, p.ej. S2>
ESTADO    : completo | parcial | bloqueado
FICHEROS  : rutas escritas
CONTRATO  : lo que ahora pueden consumir los demás (firmas, tipos, acciones, clases)
BUILD     : salida de `npm run build`
ACEPTACIÓN: la checklist del contrato, marcada
SUPUESTOS : lo que has decidido tú por falta de dato — explícito, uno por línea
DUDAS     : lo que no has decidido y necesita respuesta
```

El campo **SUPUESTOS** no es opcional. Un supuesto no declarado es una decisión de
producto tomada en silencio por un agente, y es la forma más cara de equivocarse:
compila, pasa el lint y parece correcta.
