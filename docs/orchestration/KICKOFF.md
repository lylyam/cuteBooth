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

| # | Documento | Para qué |
|---|---|---|
| 1 | `CLAUDE.md` | Reglas del repo. Se carga solo en todos los agentes |
| 2 | [../ARCHITECTURE.md](../ARCHITECTURE.md) | Capas, flujo definitivo, deudas conocidas |
| 3 | [DAG.md](DAG.md) | Qué hacer ahora y qué bloquea a qué |
| 4 | [PLAN.md](PLAN.md) | Qué agente es dueño de qué |
| 5 | `../contracts/*.md` | Solo el contrato que te toque |
| 6 | [../design/FIGMA.md](../design/FIGMA.md) | Solo si tocas diseño |

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

| # | Decisión |
|---|---|
| 1 | **`square` → `spotlight`.** El nombre viejo mentía. Se renombra **en S2**, antes de que nada dependa de él |
| 2 | **`/review` (Selected pictures) entra en alcance.** Es una ruta más, entre captura y decoración |
| 3 | **`Loading` es un componente, no una ruta.** `components/ui/Loading.tsx` |
| 4 | **`/final` existe en Figma** (`2074:52`) y es una copia de `/review` con otro copy y la foto ya decorada. **Comparten el componente `PhotoResult`** |
| 5 | **Todo el texto de usuario en inglés**, incluidos los `alt` |
| 6 | **No se crean variables en Figma.** Los tokens son code-first: `index.css` manda |

El flujo resultante son **seis rutas**, en [../ARCHITECTURE.md](../ARCHITECTURE.md) §9.

## 5. Herramientas y MCP

- **Figma MCP: conectado y verificado.** `fileKey df7hAve66qYTKiNz0UXE1E`. Los
  tools se llaman directamente, sin `@`. Node IDs y reglas en
  [../design/FIGMA.md](../design/FIGMA.md). **Nunca `get_metadata` sobre `0:1`.**
- **Ningún otro MCP.** Descartados con motivo en [PLAN.md](PLAN.md) §9.
- **No hay tests.** No instales un runner sin acordarlo: es cambio de alcance.

## 6. Lo único que sigue abierto

**No hay pantalla Decoration en Figma.** Desapareció al borrarse la zona en sucio.
Los nodos `102:319` y `103:382` se llaman "Selected pictures" pero contienen un
panel titulado **"Frames"** con 8 formas — eso es un selector de decoración, no
una revisión. Y no hay panel de fondos ni de stickers en ninguna parte del fichero.

**Bloquea:** D5, U3 y, de rebote, C5 (`useStickers`, cuyo único consumidor es U3).

**Mientras tanto no pares:** hay camino transitable hasta `/final` sin tocar la
decoración. Ver el orden de olas en [DAG.md](DAG.md) §7.

Un agente **no** resuelve esto inventándose la pantalla. Se pregunta.

## 7. Por dónde se empieza

DAG-0 (preparación): P1 ✅ P2 ✅ P3 🟡 (`layouts.md` hecho; faltan `state.md` y
`design-tokens.md`) P9 🟡. Pendientes P4-P8.

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
