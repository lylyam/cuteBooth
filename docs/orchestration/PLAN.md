# Plan de orquestación de agentes

> Estado vivo. Revisado el 2026-07-29.
> El grafo de trabajo y su estado están en [DAG.md](DAG.md).
> Los prerrequisitos del repositorio están en [SETUP.md](SETUP.md).

## 1. Criterio: cuándo un agente, y cuándo no

No todo lo que se repite merece un agente. Antes de crear uno, comprobar si algo
más barato lo resuelve:

| Mecanismo                  | Coste                                       | Para qué                                                                         |
| -------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------- |
| **Hook** (`settings.json`) | ~0                                          | Determinista, sin criterio: `eslint --fix`, `npm run build`                      |
| **Skill** (`/comando`)     | Bajo — se inyecta en el contexto **actual** | Procedimiento repetible con criterio: "añade una página con el patrón PageShell" |
| **Subagente**              | Alto — ventana de contexto nueva            | Contexto aislado, payload MCP pesado, paralelismo real, o juicio independiente   |

**Regla:** un subagente se justifica si cumple al menos dos de estas cuatro:
(a) su contexto contaminaría al principal, (b) puede correr en paralelo con otro
sobre ficheros disjuntos, (c) necesita un modelo distinto, (d) debe juzgar código
que no ha escrito.

Los seis de abajo cumplen dos o más. Lo que no cumple (formateo, lint, "buscar
dónde está X") va a hook, skill, o al agente `Explore` que ya viene de serie.

## 2. La flota

| #   | Agente               | Rol                              | Modelo        | MCP                    | Fase              |
| --- | -------------------- | -------------------------------- | ------------- | ---------------------- | ----------------- |
| —   | **Sesión principal** | **Orquestador**                  | Opus          | —                      | siempre           |
| 1   | `booth-state`        | Estado, tipos, contratos         | Sonnet        | —                      | 1                 |
| 2   | `figma-design-sync`  | Diseño → CSS                     | Sonnet (high) | Figma (lectura)        | 1                 |
| 3   | `canvas-media`       | Cámara, canvas, hooks            | Opus          | —                      | 1                 |
| 4   | `booth-reviewer`     | Puerta de calidad (solo lectura) | Sonnet (high) | Figma `get_screenshot` | 2 · **SIN CREAR** |
| 5   | `ui-composer`        | Páginas y componentes            | Sonnet        | —                      | 2 · ✅ 2026-07-28 |
| 6   | ~~`asset-pipeline`~~ | ~~Manifiestos de assets~~        | —             | —                      | **no se creó**    |

### 1 · `booth-state` — dueño del contrato de estado

- **Responsabilidad.** Única fuente de verdad de `PhotoBoothContext`, los tipos y la
  geometría de layouts. Migra `useState` → `useReducer` (6 campos, 11 acciones), define
  los guards de las 6 rutas, y saca `cardData` de `LayoutPage.tsx` a
  `constants/layouts.ts`.
- **Contexto.** `CLAUDE.md`, `docs/contracts/state.md`, `docs/contracts/layouts.md`.
- **Herramientas.** `Read, Write, Edit, Grep, Glob, Bash(npx tsc -b)`. Sin MCP.
- **Entrega.** El contrato de estado: tipos, acciones, reglas de guard.
- **Carga.** Concentrada en los nodos S1-S3. Después, casi nula. Es un agente
  **frontal, no permanente**: no lo invoques por rutina.

### 2 · `figma-design-sync` — dueño del CSS con origen en diseño

- **Responsabilidad.** Traducir nodos de Figma a CSS Modules **mapeando contra los
  tokens que ya existen** en `:root`. Es el agente que elimina la transcripción
  manual (hoy hay `--border-radius-lg: 17.59px` y `gap: 10.514px` copiados a mano
  del inspector).
- ⚠️ **El fichero de Figma no tiene variables** (`get_variable_defs` → `{}`) y es
  de **wireframes**, no de alta fidelidad. Por tanto **el código es la fuente de
  verdad de los tokens**, no Figma. Este agente mapea valores crudos contra las 21
  custom properties existentes (hoy **24**) y _propone_ tokens nuevos solo cuando ninguno
  encaja — nunca los crea a escondidas. Ver [../design/FIGMA.md](../design/FIGMA.md).
- **Contexto.** `docs/design/FIGMA.md` (node IDs y reglas de uso),
  `docs/contracts/design-tokens.md`, `index.css`, los `.module.css` existentes.
- **Herramientas.** Skill `figma-design-to-code` (**obligatoria** antes de
  `get_design_context`) + `get_metadata`, `get_design_context`, `get_variable_defs`,
  `get_screenshot`, `get_code_connect_map`. Escritura limitada a `*.module.css` e
  `index.css`. **Sin `Bash`. Sin herramientas de escritura en Figma.**
- **Entrega.** Delta de tokens, ficheros CSS escritos, clases que el TSX consumirá.
- **Programación.** Trabaja **en lote y por delante**, nunca dentro del bucle de
  página. Ver [DAG.md](DAG.md) §6.

### 3 · `canvas-media` — dueño de la lógica imperativa

- **Responsabilidad.** `hooks/`, `utils/canvasUtils.ts`, `utils/imageUtils.ts`,
  `services/storageService.ts`. La única parte del proyecto con complejidad
  algorítmica real, y **el camino crítico del DAG**.
- **Contexto.** `docs/contracts/state.md`, `docs/contracts/layouts.md`, y la lista
  de trampas del navegador: `devicePixelRatio`, cortar los tracks al desmontar,
  `playsInline` en iOS, permiso denegado, `URL.revokeObjectURL`, `setPointerCapture`,
  conversión px-CSS ↔ px-canvas.
- **Herramientas.** `Read, Write, Edit, Grep, Glob, Bash(npm run build|lint)`.
  **Sin Figma. Sin web.**
- **Entrega.** Firmas de los hooks — el contrato que consume `ui-composer`.
- **Por qué Opus.** Es donde los errores son caros y silenciosos: fugas de memoria,
  canvas borroso en pantalla retina, cámara que sigue encendida al navegar.

### 4 · `booth-reviewer` — puerta de calidad, sin permiso de escritura

- **Responsabilidad.** Solo lo que `tsc` y ESLint no ven: reglas de capa (¿un
  componente llama a `getUserMedia`?), conformidad con el patrón `PageShell`,
  accesibilidad, coherencia de idioma en el copy, fidelidad visual contra
  `get_screenshot`.
- **Herramientas.** `Read, Grep, Glob, Bash(npm run lint|build)`, `get_screenshot`.
  **`Edit` y `Write` denegados.**
- **Por qué sin escritura.** Si puede arreglar, arregla y deja de reportar: pierdes
  la señal. Y evita que "corrija" a su gusto código que otro acaba de escribir
  con criterio.
- **Entrega.** Hallazgos con `file:line`, severidad y escenario de fallo.

### 5 · `ui-composer` — dueño del TSX

- **Responsabilidad.** Páginas y componentes de presentación siguiendo el patrón
  existente. Consume hooks de `canvas-media`, clases de `figma-design-sync` y
  acciones de `booth-state`. **No escribe lógica imperativa ni CSS de Figma.**
- **Contexto.** `LayoutPage.tsx` como referencia + los tres contratos + el spec
  de la pantalla + la estructura cacheada en `docs/design/<pantalla>.md`.
- **Entrega.** Ficheros creados y acciones del reducer cableadas.
- **Creado el 2026-07-28**, y ya cerró C7, U2, U4 y U5. Ficha completa en
  `.claude/agents/ui-composer.md`, que lleva dentro las cuatro piezas que debe reunir
  antes de teclear y las prohibiciones que le van a tentar.

### 6 · ~~`asset-pipeline`~~ — nunca se creó, y está bien así

Estaba previsto en Haiku para generar los manifiestos y renombrar carpetas: volumen sin
criterio, 343 ficheros, y en Sonnet no salía a cuenta.

**No hizo falta.** Al llegar a X1 el agente no existía, se reasignó a `canvas-media`, y al
implementarlo el nodo resultó ser pequeño: `import.meta.glob` construye las listas sola, así
que fueron tres renombrados con `git mv` y ~30 líneas. El volumen que justificaba el agente
lo absorbe el bundler.

**La lección, que vale para `ui-composer` y `booth-reviewer`:** el tamaño aparente de un
nodo no es su tamaño real hasta que alguien lo mira de cerca. Antes de crear un agente para
algo que parece pesado, comprobar si una herramienta ya lo resuelve.

## 3. Quién orquesta

**La sesión principal, no un subagente.** Un subagente que delega crea nietos que
le reportan a él, no a ti: pagas el relevo dos veces, pierdes visibilidad del
progreso, y su contexto de coordinación muere al acabar el turno — justo el que
quieres conservar entre nodos del DAG.

```
                    ┌───────────────────────────────┐
                    │   SESIÓN PRINCIPAL (Opus)     │
                    │   · lee DAG.md, calcula listo │
                    │   · reparte y hace de barrera │
                    │   · dueña de App.tsx y de git │
                    └──┬────┬────┬────┬────┬────┬───┘
        ┌──────────────┘    │    │    │    │    └──────────────┐
        ▼                   ▼    ▼    ▼    ▼                   ▼
 ┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────────┐
 │ booth-state │  │ figma-design │  │canvas-media│  │ (ui-composer)│
 │  contrato   │  │    -sync     │  │   hooks    │  │   (Haiku)    │
 └──────┬──────┘  └──────┬───────┘  └──────┬─────┘  └──────┬───────┘
        └────────────────┴────────┬────────┴───────────────┘
                                  ▼
                          ┌───────────────┐
                          │  ui-composer  │  ← barrera real del DAG
                          └───────┬───────┘
                                  ▼
                          ┌───────────────┐
                          │ booth-reviewer│  (solo lectura)
                          └───────┬───────┘
                                  ▼
                     orquestador: ruta en App.tsx + commit
```

**Los agentes no se hablan entre sí.** La comunicación es radial: cada especialista
devuelve un informe al orquestador. **El sistema de ficheros y git son el bus de
datos real** — los contratos viven en disco, no en mensajes.

Una excepción que ahorra: si el revisor encuentra un fallo, usar `SendMessage` para
volver **al agente que escribió ese código** en lugar de lanzar uno nuevo. Conserva
su contexto y evita pagar la relectura.

## 4. Matriz de propiedad de ficheros

Esto es lo que hace seguro el paralelismo sin worktrees: **rutas disjuntas**.

| Ruta                                                              | Dueño exclusivo     | Resto        |
| ----------------------------------------------------------------- | ------------------- | ------------ |
| `src/context/**`, `src/constants/layouts.ts`, `src/types/**`      | `booth-state`       | lectura      |
| `src/index.css` (`:root`) y `*.module.css` con nodo Figma         | `figma-design-sync` | lectura      |
| `src/assets/**`, `src/constants/{frames,stickers,backgrounds}.ts` | `canvas-media`      | lectura      |
| `src/hooks/**`, `src/utils/**`, `src/services/**`                 | `canvas-media`      | lectura      |
| `src/pages/**/*.tsx`, `src/components/**/*.tsx`                   | `ui-composer`       | lectura      |
| `src/App.tsx`, `CLAUDE.md`, `docs/**`, `specs/**`                 | **orquestador**     | —            |
| — (nada)                                                          | `booth-reviewer`    | solo lectura |

`src/constants/` está **partido a propósito**: `layouts.ts` es de `booth-state`, y los
tres manifiestos de quien ejecute X1. Así S2 y X1 corren a la vez sin tocarse.

**Dos reasignaciones reales, el 2026-07-26**, las dos porque el agente dueño no existía:

| Qué                              | De               | A              | Por qué                                          |
| -------------------------------- | ---------------- | -------------- | ------------------------------------------------ |
| Nodo **X1** y `src/assets/**`    | `asset-pipeline` | `canvas-media` | Nunca se creó, y `canvas-media` es quien consume |
| `Button.tsx` (solo el className) | `ui-composer`    | `booth-state`  | Nunca se creó; arreglo puntual de una línea      |

La segunda fue **un solo cambio autorizado**, no un traspaso: `components/**/*.tsx` sigue
siendo de `ui-composer` el día que exista.

`App.tsx` se queda con el orquestador porque es el registro de rutas: lo toca cada
feature y tiene 25 líneas. Centralizarlo elimina el único conflicto estructural.

## 5. Qué se intercambian

```
booth-state ──▶ CONTRATO DE ESTADO   (entregado en S1 · completo en contracts/state.md)
  { state:   { selectedLayout, source, photos[], frame, background, stickers[] },
    actions: ['SET_LAYOUT','SET_SOURCE','ADD_PHOTO','SET_PHOTOS','CLEAR_PHOTOS',
              'SET_FRAME','SET_BACKGROUND','ADD_STICKER','MOVE_STICKER',
              'REMOVE_STICKER','RESET'],
    guards:  [{ route:'/decoration', requires:['selectedLayout','photos.length===4'] }] }

figma-design-sync ──▶ SPEC DE PANTALLA
  { screen, figmaNodeId, tokensAdded[], tokensChanged[],
    cssFiles[], classNames[], openQuestions[] }

canvas-media ──▶ FIRMAS DE HOOKS
  useCamera():    { videoRef, stream, countdown, error, isStarting, isCapturing,
                    start, stop, captureWithCountdown }        ← entregado en C3
     · captureWithCountdown({shots, onPhoto}) corre la SESIÓN entera y devuelve Photo[]
     · nunca lanza: el permiso denegado es un estado (error.kind), no una excepción
     · se apaga solo al desmontar — la página no tiene que hacer nada
  useCanvas(ref): { draw, exportAsBlob, download, isDrawing, isExporting }  ← entregado en C4
     · el estado va POR PARÁMETRO: permite previsualizar un marco al pasar el ratón
       (`draw({...state, frame: hovered})`) sin despachar nada
     · draw() nunca rechaza; exportAsBlob() y download() sí
     · download() crea el <a>, lo pulsa y revoca el object URL — la página no toca eso
  useStickers(ref): { onPointerDown, onPointerMove, onPointerUp }

X1 (canvas-media) ──▶ MANIFIESTO
  { manifestPath, ids[], count, skipped[] }

booth-reviewer ──▶ HALLAZGOS
  [{ file, line, severity, category, summary, failureScenario }]
```

## 6. Flujos de trabajo

Cada flujo se corresponde con un tramo del [DAG](DAG.md).

### F1 · Cimientos _(nodos S1-S3, D1, X1, C1 — una vez)_

Arranca el orquestador. `booth-state` cierra el reducer **completo** antes de que
nadie construya páginas; si no, `CameraPage` y `UploadPage` inventan cada una su
forma de guardar fotos. En paralelo, `figma-design-sync` fija los tokens y
X1 llena los manifiestos de assets: ficheros disjuntos, cero conflicto.

### F2 · Nueva pantalla _(×5 — el bucle principal)_

```
1. orquestador   entrega el spec + los contratos
2. canvas-media  produce el hook que falta        (el CSS YA existe, del lote D3-D6)
3. ui-composer   monta la página                  ← barrera: necesita hook + CSS
4. booth-reviewer build, lint, capas, a11y, fidelidad visual
5. orquestador   descomenta la ruta en App.tsx, commit
```

Nótese que Figma **no aparece**: su trabajo ya está hecho y cacheado. Esa es la
corrección que impuso el análisis del DAG.

### F3 · Cambió el diseño en Figma

`figma-design-sync` → `booth-reviewer` (diff visual). **Nadie más.** Si un cambio de
color arrastra al agente de canvas, la separación de capas está rota.

### F4 · Nuevos stickers o fondos

**Nada.** Se dejan en `src/assets/stickers/` y aparecen solos: los manifiestos se
construyen con `import.meta.glob`, así que `DecorationPage` los recoge sin tocar código.
Ese es el rendimiento del patrón, y salió más barato de lo previsto.

### F5 · Refactor

`/simplify` (built-in) → `booth-reviewer`. Ningún agente nuevo.

### F6 · Bugfix

**Solo la sesión principal.** Ninguna delegación. Un fix de tres líneas no paga la
ventana de contexto de un subagente. Esta regla, escrita, es lo que evita que la
flota degenere en ceremonia.

### F7 · Código → diseño _(opcional)_

`use_figma` / `generate_figma_design` para devolver a Figma pantallas ya
construidas, o para maquetar una antes de programarla. Útil, fuera del camino
crítico, y decisión tuya — no un agente permanente.

## 7. Cuellos de botella

| #   | Cuello                                                                                                                  | Mitigación                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 0   | ~~Falta la pantalla Decoration~~ **Resuelto el 2026-07-26**: existía sin nombrar (`102:319`). D5, U3 y C5 desbloqueados | Queda un dato menor y sin bloqueo: los node IDs del arte que X1 tiene que descargar ([KICKOFF.md](KICKOFF.md) §6) |
| 1   | **`constants/layouts.ts` es la raíz del camino crítico**                                                                | Primer nodo del proyecto. Ver [DAG.md](DAG.md) §5                                                                 |
| 2   | **`PhotoBoothContext` serializa todo.** Camera y Upload necesitan las mismas acciones                                   | Reducer completo en F1, antes de cualquier página                                                                 |
| 3   | **`canvas-media` es el 60 % del camino crítico**                                                                        | Máxima prioridad de programación, mejor modelo, nunca en segundo plano                                            |
| 4   | **Figma tiene rate limit (plan student)** y `get_design_context` es caro                                                | Lote único + caché en `docs/design/` + `get_metadata` antes de cada pull                                          |
| 5   | **El revisor al final del sprint** — cinco features juntas, arreglo caro                                                | Revisar **por pantalla**, no por sprint                                                                           |
| 6   | **Tú.** Una persona revisando la salida de seis agentes                                                                 | Máximo 2 concurrentes. El límite real no es la CPU                                                                |

## 8. Duplicidades y sus fronteras

| Solapamiento                                             | Frontera                                                                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `design-sync` y `ui-composer` escriben CSS               | **Si hay nodo Figma → design-sync. Si no → ui-composer.** Sin excepciones                                                        |
| `canvas-media` y `ui-composer` tocan DecorationPage      | Costura por capa: **hooks/utils vs. components/pages**                                                                           |
| Quién toca `src/assets/**`                               | Solo el nodo X1 (hoy `canvas-media`). Genera manifiestos y renombra; **jamás escribe CSS**                                       |
| `booth-reviewer` vs. `/code-review`, `/simplify`, ESLint | El revisor solo mira lo que las herramientas no ven: capas, a11y, fidelidad visual, idioma. Los bugs genéricos, a `/code-review` |

## 9. Coste

La mayor palanca, con diferencia: **`Analisis/` fuera del contexto** (~43k tokens,
y además incorrectos). Ver [../reference/TRIAJE.md](../reference/TRIAJE.md).

Las otras cuatro:

1. **Modelo por agente.** Haiku para assets, Sonnet para CSS/estado/UI, Opus solo
   para canvas. No pagar Opus por renombrar PNGs.
2. **Allowlist de herramientas.** Figma expone ~28 herramientas; cargar sus esquemas
   en los cuatro agentes que no las usan es peso muerto.
3. **`get_metadata` antes de `get_design_context`.** Sondear barato, traer caro solo
   lo confirmado.
4. **Code Connect** (nodo D2). Mapear los 5 componentes una vez hace que
   `get_design_context` devuelva `<Button>` en vez de `<div>`: payloads más pequeños
   y sin markup reinventado, para siempre. Es la inversión de mejor retorno.

**Corolario:** `CLAUDE.md` se inyecta en todos los agentes, así que uno
desactualizado envenena la flota entera. Mantenerlo al día es responsabilidad del
orquestador tras cada merge, no de un "agente de documentación".

## 10. Por qué esta talla

**Frente a un solo agente generalista:** se pierden las cuatro cosas que dan valor —
el escalonado de modelos (todo a precio de Opus), el aislamiento de contexto
(matemática de canvas y píxeles de CSS en la misma ventana degradan ambas), el
paralelismo (el DAG tiene olas de 5 nodos listos), y la revisión independiente.

**Frente a un agente por página:** seis agentes redescubriendo las mismas
convenciones, seis veces el coste, y convenciones divergentes entre páginas —
exactamente el problema que la arquitectura por capas resuelve.

**El principio que ordena todo:** _las fronteras entre agentes son las fronteras
entre capas._ El grafo de dependencias de `ARCHITECTURE.md` §3 se reutiliza como
reparto de agentes, así que las dependencias entre agentes son las que ya existen
entre capas. No hay un segundo modelo mental que mantener, las rutas de propiedad
salen disjuntas por construcción, y el DAG de trabajo hereda la aciclicidad.

## 11. Adopción por fases

| Fase                   | Agentes                                            | Cuándo                                                          |
| ---------------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| **1 — mínimo honesto** | `booth-state`, `figma-design-sync`, `canvas-media` | Al cerrar DAG-0. Cubren los cimientos y el camino crítico       |
| **2**                  | `+ booth-reviewer`, `+ ui-composer`                | Al llegar al primer nodo `U*`                                   |
| ~~**3**~~              | ~~`+ asset-pipeline`~~                             | **Descartada.** X1 resultó ser pequeño y lo hizo `canvas-media` |
| **Diferido**           | `booth-tester`                                     | Solo tras instalar Vitest                                       |

## 12. Plantilla de agente

`.claude/agents/figma-design-sync.md`:

```markdown
---
name: figma-design-sync
description: Traduce nodos de Figma a CSS Modules y a los tokens de index.css.
  Úsalo cuando haya una URL de Figma o cambie el diseño de una pantalla.
tools: Read, Write, Edit, Glob, Grep, Skill,
  mcp__plugin_figma_figma__get_metadata,
  mcp__plugin_figma_figma__get_design_context,
  mcp__plugin_figma_figma__get_variable_defs,
  mcp__plugin_figma_figma__get_screenshot,
  mcp__plugin_figma_figma__get_code_connect_map
model: sonnet
---

Eres el dueño del CSS con origen en diseño de CuteBooth.

Antes de `get_design_context`, invoca SIEMPRE la skill `figma-design-to-code`.
Antes de traer contexto completo, sondea con `get_metadata`.

Escribes SOLO: `src/index.css` (bloque :root) y `src/**/*.module.css`.
Nunca escribes `.tsx`. Nunca lees `Analisis/`.

Todo valor visual va a una custom property de :root — nunca hardcodees un color,
radio o espaciado dentro de un .module.css.

Devuelve: tokens añadidos, tokens cambiados, ficheros escritos, clases que el TSX
debe consumir, y dudas abiertas.
```
