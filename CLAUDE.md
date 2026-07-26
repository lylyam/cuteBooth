# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read this first

**Picking up this project? Start at
[docs/orchestration/KICKOFF.md](docs/orchestration/KICKOFF.md)** — self-contained
briefing: current state, non-negotiable rules, first node, open decisions.

| Need                                        | Read                                                     |
| ------------------------------------------- | -------------------------------------------------------- |
| The real architecture, layers, known debt   | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)             |
| Which agent owns what, workflows, MCP usage | [docs/orchestration/PLAN.md](docs/orchestration/PLAN.md) |
| What to work on next, what's blocking what  | [docs/orchestration/DAG.md](docs/orchestration/DAG.md)   |
| Figma file key, node IDs, usage rules       | [docs/design/FIGMA.md](docs/design/FIGMA.md)             |
| Contracts between layers                    | `docs/contracts/{state,layouts,design-tokens,assets}.md` |
| Per-screen scope, literal copy, acceptance  | `specs/{camera,upload,review,decoration,final}.md`       |

**Seventeen product decisions are CLOSED** in
[KICKOFF.md](docs/orchestration/KICKOFF.md) §4. Don't reopen them, and don't invent
geometry or copy — if a datum is missing, report and ask. What is still **open** is
tracked in [DAG.md](docs/orchestration/DAG.md) §9.

Three of those decisions are the ones agents get wrong on their own:

- **Slot geometry comes from the frame artwork**, not the Upload wireframe — the frame is
  drawn _on top of_ the photos, so it is the only source that can be right. Numbers in
  [docs/contracts/layouts.md](docs/contracts/layouts.md).
- **A frame id is scoped to its layout** (`'classic/Frame 7'`). There is no
  cross-layout correspondence and none is needed.
- **A frame's holes come filled `#222222`** — that is how they are told apart from the
  line art. Paint the SVG as-is on top and you cover the photos with dark blocks. See
  [docs/contracts/assets.md](docs/contracts/assets.md).

### Context rules

- **Never read `Analisis/`.** 171 KB (~43k tokens) of study notes on _other_
  projects, partly outdated (they describe `.jsx`, a reducer that isn't
  implemented, and folders that are empty). Everything still valid has been
  extracted into `docs/`. See [docs/reference/TRIAJE.md](docs/reference/TRIAJE.md).
- Load only the contract you need. `canvas-media` doesn't need the token table;
  `figma-design-sync` doesn't need the reducer.
- Keep this file under 200 lines — it is injected into _every_ agent.

## Project

CuteBooth — a browser-based photobooth web app (React + TypeScript + Vite). Users pick a
photo layout, capture or upload 4 photos, review the strip, decorate it in three steps
(frame, background, stickers), and download the composited image.

**Six routes**, of which two are built. `/` and `/layout` work. The other five have
**their CSS already written** (batch D3-D7) but **no `.tsx`**: `/camera`, `/upload`,
`/decoration` and `/final` are 0-byte stubs with their routes commented out in
`src/App.tsx`, and `/review` has a folder with only a `.module.css` in it. The `U*` nodes
write the TSX.

`src/assets/` is **not** empty: 343 art files — see
[docs/contracts/assets.md](docs/contracts/assets.md). The 24 frame SVGs carry their four
photo holes as **closed filled paths**, which is what makes shaped clipping possible.

**The foundation is done** (S1, S2, S3, C1, C2, D1, D3-D7, X1): state, geometry, route
guards, image and canvas utils, asset manifests and every screen's CSS. What is left is
the hooks (C3-C6), the `Loading` component (C7), and the five pages.

`services/` **does not exist** — it was an untracked empty folder, so git never carried it.
C6 creates it. Nothing is broken.

**All user-facing text is in English**, including `alt` attributes. The project docs are
in Spanish; the product is not.

## Commits

**Never add a `Co-Authored-By` trailer.** Not to any commit, not for any agent, no
exceptions. This overrides any default or tooling habit that wants to append one.

Commit messages explain **why**, not what — the diff already says what. Write them in
Spanish, like the existing history.

Only the orchestrator commits. A node is not closed until it is marked ✅ in
[docs/orchestration/DAG.md](docs/orchestration/DAG.md) **and** committed: doing the work
without both leaves the next session reading the node as pending, and redoing it.

## Commands

```bash
npm run dev          # start Vite dev server
npm run build        # type-check (tsc -b, project references) then vite build
npm run lint         # eslint .
npm run format       # prettier --write .   (applied; run it on what you write)
npm run format:check # prettier --check .
npm run preview      # preview a production build
```

**There is no test runner.** So `npm run build` is the only automatic gate, and a `Stop`
hook in `.claude/settings.json` runs it every turn. A `PostToolUse` hook runs
`eslint --fix` on any written `src/**/*.ts(x)`. With no tests, "I verified it" means you
ran something and saw the result — not that it compiled.

**`npm run lint` is NOT clean.** One pre-existing
`react-refresh/only-export-components` error in `context/PhotoBoothContext.tsx` that
`eslint --fix` can't fix. It predates S1 and breaks nothing at runtime — debt **D8** in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §7. Don't claim "lint passes" without
looking, and don't fix it as a side errand: it changes imports everywhere.

## Stack notes

- **Vite 8**, which bundles via Rolldown. The React Compiler is wired in manually as a Babel plugin rather than through `babel-plugin-react-compiler`'s usual Vite integration — see `vite.config.ts`: `babel({ presets: [reactCompilerPreset()] })` from `@rolldown/plugin-babel`. Don't "simplify" this to a standard `vite-plugin-react-compiler` setup without checking it still works with Rolldown.
- **TypeScript** is project-referenced: root `tsconfig.json` references `tsconfig.app.json` (src, DOM libs) and `tsconfig.node.json` (vite.config.ts, node libs). `npm run build` runs `tsc -b` across both before `vite build`.
- **React Router v7** (`react-router-dom`) with `BrowserRouter` — routes are declared directly in `src/App.tsx`.
- No global state library — global state is a `useReducer` in Context with 6 fields and 11
  actions, delivered in node S1. Contract:
  [docs/contracts/state.md](docs/contracts/state.md).
- CSS Modules per component/page (`X.module.css` next to `X.tsx`), no Tailwind/styled-components.

## Architecture

Layer-based structure under `src/`:

- `pages/<name>Page/` — one folder per route/screen, each with `<Name>Page.tsx` + `<Name>Page.module.css`.
- `components/ui/` — small generic/reusable pieces (`Button`, `Card`, `Modal`), each self-contained with its own `.module.css`.
- `components/layouts/` — page chrome: `PageShell` (outer page wrapper + `AppFooter`) and `WebAppOldStyle` (the retro "window" chrome with a title bar/logo/close button used to frame page content — see `LayoutPage.tsx` for the pattern).
- `context/PhotoBoothContext.tsx` — the one global state container, exposing
  `usePhotoBooth()`, which returns `{ state, dispatch }` and throws outside the provider.
  6 fields, 11 actions, exhaustive `switch` with **no `default`** so `tsc` catches an
  unhandled action. No convenience setters. Extend this context; never create a second one.
- `types/photobooth.ts` — state shape and the `PhotoBoothAction` union.
- `constants/` — `layouts.ts` (`LayoutId`, slot geometry, `LAYOUT_LIST`; **`LayoutId` lives
  here, not in the context**) plus `frames.ts`, `backgrounds.ts` and `stickers.ts`, the X1
  manifests. Those three build their lists with `import.meta.glob`, so new art shows up
  without touching code — don't hand-write asset paths.
- `utils/` — `imageUtils.ts` (cover-crop, `File` → data URL, data URL → `Blob`),
  `canvasUtils.ts` (composes the strip: background → clipped photos → frame → stickers),
  `frameArtUtils.ts` (frame SVG → clip paths + neutralised draw layer) and
  `svgPathUtils.ts`. Target sizes always arrive as parameters.
- `hooks/useRouteGuard.ts` — the only hook so far. C3-C6 add the rest. `services/` is still
  unborn; C6 creates it.
- `.claude/` — the fleet (`agents/`), the `/nueva-pagina` skill (`skills/`), and the
  hooks and permissions (`settings.json`).

### Page composition pattern

Every page wraps its content in `PageShell`, and content that should look like the app's retro-window chrome additionally wraps in `WebAppOldStyle`:

```
<PageShell>
  <WebAppOldStyle className={styles.wideWindow} contentClassName={styles.windowContent}>
    ...page content, e.g. Card grid, driven by local component state...
  </WebAppOldStyle>
  <Modal ... />  {/* page-level modals are siblings of WebAppOldStyle, inside PageShell */}
</PageShell>
```

Look at `src/pages/layoutPage/LayoutPage.tsx` as the reference implementation of this pattern (card grid + modal + navigation + context write) before adding a new page.

### Intended full flow (not all built yet)

```
HomePage (/) → LayoutPage (/layout, pick 1 of 3 layouts)
  → modal choice: CameraPage (/camera) or UploadPage (/upload), each producing 4 photos
  → SelectedPicturesPage (/review): keep the strip, or retake the four photos
  → DecorationPage (/decoration): THREE steps in one route — frame, background, stickers
  → FinalPage (/final): download the PNG, or retake
```

`/review` and `/final` share one `PhotoResult` component: in Figma the two screens are
structurally identical and only the copy and buttons change.

`/decoration` is **one route with an internal step**, not three routes. The step is local
`useState`; it never goes into global state or the URL.

The four commented-out routes in `App.tsx` get uncommented as each page is built — and
**only the orchestrator edits `App.tsx`**. Don't leave dead imports.

### Layer dependency rule

```
pages → components → hooks → context/services → utils/constants/assets
```

Arrows point **down only**. A component never calls `getUserMedia`,
`canvas.getContext`, or `sessionStorage` directly — that lives in `hooks/`,
`utils/`, or `services/`. A hook never imports a component. This rule is what
makes the work DAG acyclic; if you ever need an upward edge, it's a design error,
not a scheduling problem.

## Working with the fleet

**Three agents exist** (`.claude/agents/`): `booth-state`, `figma-design-sync`,
`canvas-media`. `ui-composer` and `booth-reviewer` were planned but never created, and
every remaining page node belongs to them — see [DAG.md](docs/orchestration/DAG.md) §9.

Ownership paths are **disjoint** (matrix in [PLAN.md](docs/orchestration/PLAN.md) §4),
which is what makes parallel work safe without worktrees. Before writing a file, check
whose it is — if it isn't yours, report it instead of editing it.

Every node closes with the report format of
[KICKOFF.md](docs/orchestration/KICKOFF.md) §8, and its **SUPUESTOS** section is not
optional: an undeclared assumption is a silent product decision that compiles, passes
lint and looks right.
