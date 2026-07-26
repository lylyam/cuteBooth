# Triaje de `Analisis/`

> Decisión tomada el 2026-07-25. Los tres documentos se **conservan** (son trabajo
> propio y tienen valor de estudio) pero quedan **fuera del contexto de los agentes**.

## Veredicto

| Documento                 | Tamaño                  | Qué es                                                                | Veredicto                             |
| ------------------------- | ----------------------- | --------------------------------------------------------------------- | ------------------------------------- |
| `arquitectura.md`         | 63 KB · 1802 líneas     | §1-14 manual genérico de React; §15 diseño de CuteBooth               | 🟡 **Extraer §15, congelar el resto** |
| `ANALISIS_ny.md`          | 68 KB · 1904 líneas     | Análisis de _NYC Photobooth_, proyecto ajeno (React + Express)        | 🟠 **Extraer solo dominio, congelar** |
| `ANALISIS-underthesea.md` | 40 KB · 874 líneas      | Análisis de _Underwater Photobooth_, proyecto ajeno (vanilla JS, MPA) | 🟠 **Extraer solo dominio, congelar** |
| **Total**                 | **171 KB ≈ 43k tokens** |                                                                       |                                       |

## Por qué no pueden entrar en contexto

Tres motivos, de menos a más grave:

1. **Coste.** 43k tokens. Si seis agentes los cargan cada sprint, son ~260k tokens
   por sprint tirados a la basura.
2. **Ruido.** Dos de los tres analizan proyectos que no son este: un React+Express
   con backend, y una MPA en vanilla JS sin framework. Sus decisiones de
   arquitectura no aplican y sus ejemplos de código no compilan aquí.
3. **Toxicidad.** `arquitectura.md` §15 describe `.jsx`, un `useReducer` ya
   implementado, `pages/HomePage.jsx` plano y carpetas con contenido que están
   vacías. Un agente que lo lea no se confunde a medias: construye con confianza
   contra un proyecto que no existe. **Un documento desactualizado es peor que
   ningún documento**, porque un agente sin información pregunta y uno mal
   informado no.

## Qué se salva de cada uno

### `arquitectura.md`

| Sección                       | Destino                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| §15.1 Flujo de pantallas      | → `docs/ARCHITECTURE.md` (ya migrado, corregido)                                                  |
| §15.2 Forma del estado global | → `docs/contracts/state.md` (P3) — **corregir a TS**                                              |
| §15.7 Geometría de layouts    | → `docs/contracts/layouts.md` (P3) — **resolver la incoherencia de nombres, ver ARCHITECTURE D2** |
| §15.9 Guards de ruta          | → `docs/contracts/state.md` (P3)                                                                  |
| §15.10 Grafo de capas         | → `docs/ARCHITECTURE.md` §3 (ya migrado) — **es la base del DAG**                                 |
| §1-14 (manual de React)       | 🔒 Congelar. Es material de aprendizaje, no documentación del proyecto.                           |
| §15.3-15.6, 15.8              | 🔒 Congelar. Ya reflejado o desactualizado.                                                       |

### `ANALISIS_ny.md`

Proyecto ajeno, pero **mismo dominio y mismo problema difícil**: 4 fotos, fondos,
composición en alta resolución. Es la única fuente que tienes sobre eso.

- **Salvar:** de §4 (Análisis por módulos, líneas ~297-1113), únicamente lo relativo
  a **composición sobre canvas y exportación en alta resolución**. Destino:
  `specs/decoration.md` y `specs/final.md` como referencia de problema resuelto.
- 🔒 **Congelar:** todo lo demás. Tiene backend Express, compartir en redes y QR —
  nada de eso está en el alcance de CuteBooth.

### `ANALISIS-underthesea.md`

Vanilla JS y solo 2 fotos, así que su arquitectura es irrelevante. Pero resuelve
**drag & drop de stickers sobre canvas**, que es el nodo C5 del DAG.

- **Salvar:** de §3 (Análisis por módulos, líneas ~175-456), únicamente la mecánica
  de **arrastre de stickers y escalado de coordenadas**. Destino: `specs/decoration.md`.
- 🔒 **Congelar:** todo lo demás. Arquitectura MPA sin framework, no aplica.

## La regla

> **Del material de estudio se extrae conocimiento de dominio (cómo se compone un
> canvas, cómo se arrastra un sticker). Nunca decisiones de arquitectura, nunca
> código, nunca estructura de carpetas.** Eso ya lo tiene este proyecto, y lo tiene
> distinto.

## Cómo se aplica

1. En `CLAUDE.md`, regla explícita: ningún agente lee `Analisis/`.
2. En cada definición de agente (`.claude/agents/*.md`), repetir la prohibición.
   Redundante a propósito: es la regla que más caro sale saltarse.
3. Las extracciones las hace el orquestador **una vez**, al redactar P3 y P4, y
   quedan como frases concretas dentro del spec — no como enlaces al original.
   Un enlace invita a abrirlo; una frase extraída, no.
4. `Analisis/` no se borra ni se mueve. Es trabajo propio y tiene valor. Solo deja
   de ser una fuente para los agentes.
