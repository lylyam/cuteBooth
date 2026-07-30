# Briefing de arranque

> **Empieza aquí.** Punto de entrada para cualquier agente o persona que retome
> CuteBooth. Autosuficiente.
> Estado a 2026-07-29. **24 nodos cerrados y el producto casi entero.** Se recorre
> `/` → `/layout` → `/upload` → `/review` → `/final` en el navegador. Faltan **dos
> pantallas** (`/camera` y `/decoration`) y **cinco nodos**. Detalle en §6.

## 1. Qué es CuteBooth

Photobooth en navegador, 100 % cliente, sin backend. El usuario elige un layout,
consigue 4 fotos (cámara o subida), las revisa, las decora con fondo y stickers, y
descarga la imagen compuesta. React 19 + TypeScript + Vite 8 + CSS Modules.

**Estado real:** funcionan `/`, `/layout`, `/upload`, `/review` y `/final`. Solo
`/camera` y `/decoration` siguen siendo ficheros de 0 bytes con la ruta comentada en
`src/App.tsx`. Tabla completa en §6.

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

No las reabras. Están cerradas por la propietaria del proyecto el 2026-07-26.

| #   | Decisión                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **`square` → `spotlight`.** El nombre viejo mentía. Se renombra **en S2**, antes de que nada dependa de él                                                                                                    |
| 2   | **`/review` (Selected pictures) entra en alcance.** Es una ruta más, entre captura y decoración                                                                                                               |
| 3   | **`Loading` es un componente, no una ruta.** `components/ui/Loading.tsx`                                                                                                                                      |
| 4   | **`/final` existe en Figma** (`2074:52`) y es una copia de `/review` con otro copy y la foto ya decorada. **Comparten el componente `PhotoResult`**                                                           |
| 5   | **Todo el texto de usuario en inglés**, incluidos los `alt`                                                                                                                                                   |
| 6   | **No se crean variables en Figma.** Los tokens son code-first: `index.css` manda                                                                                                                              |
| 7   | **`/decoration` son TRES PASOS en una sola ruta**, no tres rutas: Frames → Backgrounds → Icons. El paso es estado local de la página                                                                          |
| 8   | **Un marco es un conjunto temático de 4 recortes**, uno por hueco. El usuario elige el tema, no la forma de cada hueco. Añade `frame` al estado                                                               |
| 9   | **En `/upload` cada hueco es un botón** que abre el selector de archivos. `Continue` está siempre visible y deshabilitado hasta las 4 fotos                                                                   |
| 10  | **En el menú de fondos la muestra NO enseña la imagen completa**: esquinas redondeadas y la imagen recortada. Su tamaño lo **matiza la decisión 17**                                                          |
| 11  | **`/final` lleva copy propio**, no el de `/review`: `Here's your decorated strip!` · `Download it, or start over to make a new one.` Botones `Download` y `Retake`                                            |
| 12  | **`Retake` conserva la decoración.** Vacía las fotos y vuelve al origen (`CLEAR_PHOTOS`), no reinicia todo                                                                                                    |
| 13  | **La geometría de los huecos la manda el ARTE de los marcos**, no el wireframe de Upload. Los números están en [../contracts/layouts.md](../contracts/layouts.md), extraídos de los tres marcos rectangulares |
| 14  | **La muestra del menú de Frames se genera del propio marco**, recortando su SVG al primer hueco. `assets/frames/icons for frames menu/` no se usa                                                             |
| 15  | **Los IDs de marco están acotados a su layout** (`'classic/Frame 7'`). No hay correspondencia entre layouts, y no hace falta                                                                                  |
| 16  | **Los marcos se quedan en SVG**, y cada hueco es una **forma cerrada rellena** dentro del propio fichero. No se pasan a PNG. Motivo en [../contracts/assets.md](../contracts/assets.md) § _Por qué SVG_       |
| 17  | **La muestra de un fondo ocupa el mismo hueco que la de un marco**: rectángulo de esquinas redondeadas con la imagen recortada. **No** se fuerza a 1:1 — "cuadrado" quería decir "misma caja", no cuadrado    |
| 18  | **Las pegatinas miden 20×20 unidades de dibujo** (60 px en el PNG). No todas son cuadradas y **no se deforman**: `contain`, el lado largo a 20 y el otro por proporción                                       |
| 19  | **Los fondos se REPITEN como patrón**, no se estiran a `cover`. El tile va en unidades de dibujo, así que se ven las mismas repeticiones en el preview y en la descarga                                       |

Las decisiones 7-15 se cerraron el 2026-07-26, en la sesión que cerró DAG-0. Las **16 y
17**, el mismo día, cuando aterrizó el arte definitivo de los marcos. Las **18 y 19** el
2026-07-27, al ver la primera composición real y comprobar que los fondos salían
ampliados ×3,5.

El flujo resultante son **seis rutas**, en [../ARCHITECTURE.md](../ARCHITECTURE.md) §9.

## 5. Herramientas y MCP

- **Figma MCP: conectado y verificado.** `fileKey df7hAve66qYTKiNz0UXE1E`. Los
  tools se llaman directamente, sin `@`. Node IDs y reglas en
  [../design/FIGMA.md](../design/FIGMA.md). **Nunca `get_metadata` sobre `0:1`.**
- **Ningún otro MCP.** Descartados con motivo en [PLAN.md](PLAN.md) §9.
- **No hay tests.** No instales un runner sin acordarlo: es cambio de alcance.

## 6. Qué está construido, y qué falta

**24 nodos cerrados.** El producto se recorre de punta a punta salvo dos pantallas.

| Ruta          | Estado                                                 |
| ------------- | ------------------------------------------------------ |
| `/`           | ✅ funciona                                            |
| `/layout`     | ✅ funciona · elige layout y `source`                  |
| `/upload`     | ✅ funciona · 4 huecos, cada uno abre el selector      |
| `/review`     | ✅ funciona · la tira compuesta en canvas              |
| `/final`      | ✅ funciona · descarga el PNG                          |
| `/camera`     | ⬜ **`.tsx` de 0 bytes**, ruta comentada — nodo **U1** |
| `/decoration` | ⬜ **`.tsx` de 0 bytes**, ruta comentada — nodo **U3** |

Por debajo está **todo**: reducer de 6 campos y 11 acciones, geometría de los 3 layouts,
guards, primitivas de imagen, composición sobre canvas con recorte por la forma del hueco,
hook de cámara, hook de canvas, y los manifiestos de los 343 ficheros de arte.

**Lo que queda, exactamente cinco nodos:**

| Nodo    | Qué                             | Dueño               | Bloqueado por |
| ------- | ------------------------------- | ------------------- | ------------- |
| **C5**  | `useStickers` — arrastre        | `canvas-media`      | nada          |
| **C6**  | `storageService` — persistencia | `canvas-media`      | nada          |
| **D3b** | Tipografía de la cuenta atrás   | `figma-design-sync` | nada          |
| **U1**  | `/camera`                       | `ui-composer`       | D3b           |
| **U3**  | `/decoration`                   | `ui-composer`       | C5            |

Más las revisiones (`R*`) y el alta de las dos rutas que faltan (`O*`).

### El muro que hay que decidir antes de llegar

**`booth-reviewer` no existe.** Es el único agente de fase 2 que sigue sin crear, y es el
que no se puede reasignar sin perder su sentido: **juzga código que no ha escrito**. Si lo
revisa quien lo escribió, no es una revisión. Ya hay cinco pantallas construidas, así que
hay material de sobra. Decidir con la propietaria: crearlo o renunciar a los nodos `R*`.

Ya pasó dos veces que un nodo llegó sin dueño (`asset-pipeline` en X1, `ui-composer` en las
páginas). Las dos se resolvieron, pero costaron una ronda cada una.

## 7. Por dónde seguir

El camino crítico original (`S2 → C2 → C4 → C5 → U3`) está transitado hasta **C4**. Lo que
queda del camino es **C5 → U3**, y `U3` es la última pantalla del flujo.

Ola natural: **C5 + D3b**. La primera desbloquea `/decoration`; la segunda desbloquea
`/camera` y no depende de nada. Después **U3 + U1**, y con eso el producto está completo.

`C6` (persistencia) cabe en cualquier hueco: no bloquea a nadie.

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
