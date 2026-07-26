# Briefing de arranque

> **Empieza aquí.** Punto de entrada para cualquier agente o persona que retome
> CuteBooth. Autosuficiente.
> Estado a 2026-07-26. Nada de `src/` ha sido modificado todavía.

## 1. Qué es CuteBooth

Photobooth en navegador, 100 % cliente, sin backend. El usuario elige un layout,
consigue 4 fotos (cámara o subida), las revisa, las decora con fondo y stickers, y
descarga la imagen compuesta. React 19 + TypeScript + Vite 8 + CSS Modules.

**Estado real:** funcionan `/` y `/layout`. Las demás páginas son ficheros de
**0 bytes** con las rutas comentadas en `src/App.tsx`. `hooks/`, `services/`,
`utils/` y `constants/` existen y están **vacías**.

## 2. Orden de lectura

| #   | Documento                                | Para qué                                                         |
| --- | ---------------------------------------- | ---------------------------------------------------------------- |
| 1   | `CLAUDE.md`                              | Reglas del repo. Se carga solo en todos los agentes              |
| 2   | [../ARCHITECTURE.md](../ARCHITECTURE.md) | Capas, flujo definitivo, deudas conocidas                        |
| 3   | [DAG.md](DAG.md)                         | Qué hacer ahora y qué bloquea a qué                              |
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
| 10  | **En el menú de fondos la muestra NO enseña la imagen completa**: cuadrado de esquinas redondeadas, del tamaño de las muestras de Frames, con la imagen recortada                                             |
| 11  | **`/final` lleva copy propio**, no el de `/review`: `Here's your decorated strip!` · `Download it, or start over to make a new one.` Botones `Download` y `Retake`                                            |
| 12  | **`Retake` conserva la decoración.** Vacía las fotos y vuelve al origen (`CLEAR_PHOTOS`), no reinicia todo                                                                                                    |
| 13  | **La geometría de los huecos la manda el ARTE de los marcos**, no el wireframe de Upload. Los números están en [../contracts/layouts.md](../contracts/layouts.md), extraídos de los tres marcos rectangulares |
| 14  | **La muestra del menú de Frames se genera del propio marco**, recortando su SVG al primer hueco. `assets/frames/icons for frames menu/` no se usa                                                             |
| 15  | **Los IDs de marco están acotados a su layout** (`'classic/Frame 7'`). No hay correspondencia entre layouts, y no hace falta                                                                                  |
| 16  | **Los marcos se quedan en SVG**, y cada hueco es una **forma cerrada rellena** dentro del propio fichero. No se pasan a PNG. Motivo en [../contracts/assets.md](../contracts/assets.md) § _Por qué SVG_       |
| 17  | **La muestra de un fondo ocupa el mismo hueco que la de un marco**: rectángulo de esquinas redondeadas con la imagen recortada. **No** se fuerza a 1:1 — "cuadrado" quería decir "misma caja", no cuadrado    |

Las decisiones 7-15 se cerraron el 2026-07-26, en la sesión que cerró DAG-0. Las **16 y
17**, el mismo día, cuando aterrizó el arte definitivo de los marcos.

El flujo resultante son **seis rutas**, en [../ARCHITECTURE.md](../ARCHITECTURE.md) §9.

## 5. Herramientas y MCP

- **Figma MCP: conectado y verificado.** `fileKey df7hAve66qYTKiNz0UXE1E`. Los
  tools se llaman directamente, sin `@`. Node IDs y reglas en
  [../design/FIGMA.md](../design/FIGMA.md). **Nunca `get_metadata` sobre `0:1`.**
- **Ningún otro MCP.** Descartados con motivo en [PLAN.md](PLAN.md) §9.
- **No hay tests.** No instales un runner sin acordarlo: es cambio de alcance.

## 6. Lo que estaba abierto y ya no

**La pantalla Decoration existe.** Estaba sin nombrar, y por eso no se encontraba: es
`102:319`, hoy llamado "Decorarion" (con typo). `103:382` ("Decoration 2") es un
**duplicado exacto** — conviene borrarlo antes de que alguien lo tome por otro estado.

Con eso, **D5, U3 y C5 quedan desbloqueados** y el camino crítico vuelve a ser uno.
Lo que trajo de nuevo esa pantalla está en las decisiones 7-12 de §4 y en
[../../specs/decoration.md](../../specs/decoration.md).

**Y el arte llegó al repo.** 343 ficheros el 2026-07-26 — 24 marcos, 46 fondos, 273
pegatinas. No hay que bajar nada de Figma. Trajo dos discrepancias, las dos ya cerradas
como decisiones 13 y 14 de §4:

- La geometría de los huecos **no coincidía** entre el arte y el wireframe (10 px en
  `classic`). Manda el arte, porque es lo que se dibuja encima de las fotos.
- **Faltaba** saber qué muestra del menú era qué marco. Ya no hace falta: la muestra se
  genera del propio marco.

**No queda ninguna pregunta abierta.** La regla sigue en pie de todas formas: un agente
**no** resuelve una laguna inventándose los números. Se pregunta.

**Y DAG-0 no deja nada pendiente.** La pasada de Prettier se aplicó el 2026-07-26 y con
ella cayó la deuda D5. El siguiente paso es el primer nodo de producto: **S2**.

## 7. Por dónde se empieza

DAG-0 (preparación): **cerrado el 2026-07-26** — P1-P9 ✅. Los contratos están en
`docs/contracts/`, los specs de las cinco pantallas en `specs/`, y la flota de fase 1
en `.claude/agents/`.

**El primer nodo de producto es S2: `src/constants/layouts.ts`.**

No es intuitivo, y por eso está escrito: un fichero de constantes de ~50 líneas es
la **raíz del camino crítico**. El reducer (S1), que parecería lo primero, no lo es.

```
S2 → C2 canvasUtils → C4 useCanvas → U5 /review → U4 /final
```

Contrato, geometría real y criterio de aceptación en
[../contracts/layouts.md](../contracts/layouts.md). La geometría ya está extraída
de Figma: no hay que inventar ni un número.

En paralelo con S2 se puede lanzar **D1** o **C1**. Máximo 2 agentes a la vez — el
límite no es técnico, es el ancho de banda de quien revisa.

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
