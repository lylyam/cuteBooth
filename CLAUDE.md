# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read this first

**Picking up this project? Start at
[docs/orchestration/KICKOFF.md](docs/orchestration/KICKOFF.md)** — self-contained
briefing: current state, non-negotiable rules, first node, open decisions.

| Need | Read |
|---|---|
| The real architecture, layers, known debt | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Which agent owns what, workflows, MCP usage | [docs/orchestration/PLAN.md](docs/orchestration/PLAN.md) |
| What to work on next, what's blocking what | [docs/orchestration/DAG.md](docs/orchestration/DAG.md) |
| Figma file key, node IDs, usage rules | [docs/design/FIGMA.md](docs/design/FIGMA.md) |
| Contracts between layers | `docs/contracts/*.md` |
| Per-screen scope and acceptance criteria | `specs/*.md` (pending, node P4) |

**Never decide these alone** — six open product decisions are listed in
[KICKOFF.md](docs/orchestration/KICKOFF.md) §6 (no Final screen designed, two
undecided screens, the `square` misnomer, UI language). Report and ask.

### Context rules

- **Never read `Analisis/`.** 171 KB (~43k tokens) of study notes on *other*
  projects, partly outdated (they describe `.jsx`, a reducer that isn't
  implemented, and folders that are empty). Everything still valid has been
  extracted into `docs/`. See [docs/reference/TRIAJE.md](docs/reference/TRIAJE.md).
- Load only the contract you need. `canvas-media` doesn't need the token table;
  `figma-design-sync` doesn't need the reducer.
- Keep this file under 200 lines — it is injected into *every* agent.

## Project

CuteBooth — a browser-based photobooth web app (React + TypeScript + Vite). Users pick a photo layout, capture or upload 4 photos, decorate them with backgrounds/stickers, and get a final composited image to download. The project is early-stage: routing and layout selection are implemented; camera capture, upload, decoration, and final-result pages exist only as empty stub files (`src/pages/{cameraPage,uploadPage,decorationPage,finalPage}`) and are commented out in `src/App.tsx` pending implementation.

## Commands

```bash
npm run dev       # start Vite dev server
npm run build     # type-check (tsc -b, project references) then vite build
npm run lint      # eslint .
npm run preview   # preview a production build
```

There is no test runner configured in this repo (no test script, no test files, no testing library dependency).

## Stack notes

- **Vite 8**, which bundles via Rolldown. The React Compiler is wired in manually as a Babel plugin rather than through `babel-plugin-react-compiler`'s usual Vite integration — see `vite.config.ts`: `babel({ presets: [reactCompilerPreset()] })` from `@rolldown/plugin-babel`. Don't "simplify" this to a standard `vite-plugin-react-compiler` setup without checking it still works with Rolldown.
- **TypeScript** is project-referenced: root `tsconfig.json` references `tsconfig.app.json` (src, DOM libs) and `tsconfig.node.json` (vite.config.ts, node libs). `npm run build` runs `tsc -b` across both before `vite build`.
- **React Router v7** (`react-router-dom`) with `BrowserRouter` — routes are declared directly in `src/App.tsx`.
- No global state library — global state is a single `useState` in Context (see below), not `useReducer`.
- CSS Modules per component/page (`X.module.css` next to `X.tsx`), no Tailwind/styled-components.

## Architecture

Layer-based structure under `src/`:

- `pages/<name>Page/` — one folder per route/screen, each with `<Name>Page.tsx` + `<Name>Page.module.css`.
- `components/ui/` — small generic/reusable pieces (`Button`, `Card`, `Modal`), each self-contained with its own `.module.css`.
- `components/layouts/` — page chrome: `PageShell` (outer page wrapper + `AppFooter`) and `WebAppOldStyle` (the retro "window" chrome with a title bar/logo/close button used to frame page content — see `LayoutPage.tsx` for the pattern).
- `context/PhotoBoothContext.tsx` — the one global state container, exposing `usePhotoBooth()`. Currently holds only `selectedLayout` (`LayoutId = 'classic' | 'wide' | 'square'`) and its setter. `PhotoBoothProvider` wraps the whole `<Routes>` tree in `App.tsx`. When adding photos/background/stickers state (per the planned flow below), extend this context rather than creating a second one.
- `hooks/`, `services/`, `utils/`, `constants/` exist as top-level folders but are currently empty — reserved for camera access, canvas composition, and layout/sticker/background definitions as those features get built.

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
  → DecorationPage (/decoration): apply background + drag stickers onto the chosen layout
  → FinalPage (/final): render composited result, download or restart
```

`/camera`, `/upload`, `/decoration`, `/final` routes are commented out in `App.tsx` until their pages are implemented — uncomment as each is built, don't leave dead imports.

### Layer dependency rule

```
pages → components → hooks → context/services → utils/constants/assets
```

Arrows point **down only**. A component never calls `getUserMedia`,
`canvas.getContext`, or `sessionStorage` directly — that lives in `hooks/`,
`utils/`, or `services/`. A hook never imports a component. This rule is what
makes the work DAG acyclic; if you ever need an upward edge, it's a design error,
not a scheduling problem.

## Reference documents

`Analisis/` is frozen study material, **not documentation of this repo** and
**not agent context** — see the context rules at the top of this file and
[docs/reference/TRIAJE.md](docs/reference/TRIAJE.md) for what was extracted from it
and why the rest is off-limits.
