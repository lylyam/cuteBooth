# Qué debe existir antes de orquestar agentes

> Diagnóstico a 2026-07-25: el repositorio **no tiene** `docs/`, `specs/`,
> `.claude/`, tests, ni formateador. Tiene código y tres documentos de estudio.
> Este documento dice qué falta, qué es imprescindible y qué no lo es.

## 0. El principio

Un agente sin especificación no construye lo que quieres: construye lo que le
parece razonable. Y como es competente, lo que le parece razonable **compila,
pasa el lint y parece correcto** — que es la forma más cara de estar equivocado.

Por eso el orden es: primero la información, después los agentes. Cada hora de
`docs/` y `specs/` se amortiza en la primera pantalla, porque es contexto que
seis agentes reutilizan en vez de reinventar cada uno a su manera.

## 1. Imprescindible antes del primer agente

| #   | Qué                          | Por qué                                                                                                                                                         | Nodo DAG |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **`docs/ARCHITECTURE.md`**   | Sin esto, cada agente deduce la arquitectura de los ficheros que le toquen. Cinco agentes = cinco arquitecturas.                                                | P1 ✅    |
| 2   | **Triaje de `Analisis/`**    | 171 KB de notas sobre otros proyectos, en `.jsx`, con estructura de carpetas falsa. Un agente que las lea construirá contra un proyecto que no existe.          | P2 ✅    |
| 3   | **`docs/contracts/`** ✅     | Es lo que los agentes se intercambian. Sin contrato escrito, la interfaz entre `canvas-media` y `ui-composer` se negocia en cada invocación, y cambia cada vez. | P3       |
| 4   | **`specs/` por pantalla** ✅ | Un spec es la definición del nodo del DAG: alcance, criterio de aceptación, qué NO entra. Es lo que convierte "haz la CameraPage" en algo verificable.          | P4       |
| 5   | **`CLAUDE.md` corregido**    | Se inyecta en **todos** los agentes. Hoy afirma cosas ciertas, pero no apunta a `docs/` ni prohíbe `Analisis/`.                                                 | P9       |

## 2. Muy recomendable, y barato

| #   | Qué                                  | Por qué                                                                                                                                                                                                                               |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | **Prettier + `.editorconfig`**       | Hay tabs en `WebAppOldStyle.tsx` y 2 espacios en el resto. Con 6 agentes escribiendo, la deriva de formato se multiplica y ensucia todos los diffs — que es justo donde revisas. Un formateador es determinista: **hook, no agente**. |
| 7   | **Hooks en `.claude/settings.json`** | `PostToolUse` sobre `Edit`/`Write` de `*.tsx` → `eslint --fix`. `Stop` → `npm run build`. Coste cero por invocación y elimina toda una clase de hallazgos del revisor. Usa la skill `/update-config`.                                 |
| 8   | **Permisos en `settings.json`**      | Permitir `npm run build                                                                                                                                                                                                               | lint`, `npx tsc -b`, `git status | diff`evita interrumpirte con confirmaciones en cada nodo. La skill`/fewer-permission-prompts` lo genera desde tu historial. |
| 9   | **Skill `/nueva-pagina`**            | El patrón `PageShell` + `WebAppOldStyle` + guard + `.module.css` se repite 4 veces. Una skill se inyecta en el contexto actual: coste marginal cero frente a un subagente.                                                            |

## 3. Cuando toque, no ahora

| Qué                          | Cuándo                                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Vitest + Testing Library** | Cuando exista `useCanvas`. Testear composición sobre canvas sí paga; testear que un `<Button>` renderiza sus children, no. Hasta entonces la puerta es `npm run build` + `booth-reviewer`. |
| **Agente `booth-tester`**    | Solo después de instalar el runner. Un agente cuyo primer acto es instalar su propia infraestructura es expansión de alcance disfrazada.                                                   |
| **CI (GitHub Actions)**      | Cuando el repo se comparta o se despliegue. En solo local, el hook `Stop` cubre lo mismo.                                                                                                  |
| **Storybook**                | Con 5 componentes UI, no. Reevaluar a partir de ~15.                                                                                                                                       |

## 4. Nunca para este proyecto

- **Librería de estado global** (Zustand, Redux). 5 campos, 10 acciones.
- **Backend.** Todo el flujo es local: `getUserMedia`, canvas, descarga.
- **MCP de Jira/Confluence/Gmail/Calendar/Stripe.** Sin justificación funcional, y
  en el caso de Gmail, superficie de riesgo gratis para un agente que edita código.
- **Un agente por página.** Seis agentes redescubriendo las mismas convenciones.

## 5. Estructura objetivo

```
docs/
├── README.md                  ✅ índice + reglas de carga de contexto
├── ARCHITECTURE.md            ✅ arquitectura real
├── contracts/                 ✅ P3 — lo que los agentes se intercambian
│   ├── state.md               ✅ 6 campos, 11 acciones, guards, persistencia
│   ├── layouts.md             ✅ geometría de los 3 layouts
│   └── design-tokens.md       ✅ 21 tokens, reglas de mapeo, deuda T1-T8
├── design/                    ⬜ caché de specs de Figma (una por pantalla)
├── orchestration/
│   ├── PLAN.md                ✅ flota de agentes
│   ├── DAG.md                 ✅ grafo de trabajo
│   └── SETUP.md               ✅ este documento
└── reference/
    └── TRIAJE.md              ✅ veredicto sobre Analisis/

specs/                         ✅ P4 — una por pantalla pendiente
├── camera.md
├── upload.md
├── review.md                  ← nueva: /review entró en alcance
├── decoration.md
└── final.md

.claude/                       ⬜ P5-P7
├── agents/                    ← 3 en fase 1
├── skills/nueva-pagina/
└── settings.json              ← hooks + permisos

Analisis/                      🔒 congelado, prohibido en contexto de agente
```

## 6. Plantilla de spec

Un spec de pantalla cabe en una página. Si no cabe, la pantalla es dos nodos.

```markdown
# Spec · <Pantalla>

## Objetivo

Una frase. Qué consigue el usuario aquí.

## Entra / Sale

- Entra con: <estado que debe existir ya> (si no, el guard redirige a X)
- Sale a: <ruta> cuando <condición>

## Estado que lee / escribe

- Lee: state.selectedLayout, state.photos
- Escribe: dispatch ADD_PHOTO, dispatch SET_SOURCE

## Dependencias

- Hooks: useCamera (C3)
- CSS: CameraPage.module.css (D3)
- Assets: —

## Criterio de aceptación

- [ ] Verificable
- [ ] Y observable
- [ ] Sin ambigüedad

## Fuera de alcance

Lo que NO entra en este nodo, dicho explícitamente.

## Nodo Figma

<URL o "pendiente">
```
