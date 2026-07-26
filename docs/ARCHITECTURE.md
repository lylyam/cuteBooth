# Arquitectura real de CuteBooth

> Este documento describe **lo que hay**, no lo que se planeó. Verificado contra
> `src/` el 2026-07-26. Si el código y este documento discrepan, el código gana y
> este documento se corrige.

## 1. Qué es

Photobooth en navegador, 100 % cliente. Sin backend, sin base de datos, sin auth.
El usuario elige un layout, consigue 4 fotos (cámara o subida), las revisa, las decora
en tres pasos (recorte, fondo, pegatinas) y descarga una imagen compuesta.

## 2. Stack y restricciones

- **React 19.2** + **TypeScript 5.9** (estricto, project references)
- **Vite 8** (bundler Rolldown) — el React Compiler está cableado a mano como
  preset de Babel en `vite.config.ts` vía `@rolldown/plugin-babel`. **No migrar** a
  la integración estándar sin comprobar que sigue funcionando con Rolldown.
- **React Router v7**, `BrowserRouter`, rutas declaradas en `src/App.tsx`
- **CSS Modules** (`X.module.css` junto a `X.tsx`) + 23 custom properties en `:root`.
  Sin Tailwind, sin styled-components, sin librería de UI.
- **Sin librería de estado global.** Context API.
- **Sin runner de tests.** No hay Vitest, ni Jest, ni Testing Library.
- **Prettier aplicado** (`.prettierrc.json`, `.editorconfig`, `npm run format`). El
  formato del repo es uniforme desde el 2026-07-26.

## 3. Capas y regla de dependencia

```
páginas        pages/**
   ↓
componentes    components/ui/ · components/layouts/
   ↓
hooks          hooks/**
   ↓
estado         context/**          servicios   services/**
   ↓                                   ↓
base           utils/** · constants/** · assets/**
```

**Regla única e innegociable: las flechas solo apuntan hacia abajo.**
Una capa nunca importa de una capa superior. Este grafo es acíclico por
construcción, y es la razón por la que el DAG de trabajo también lo es
(ver [orchestration/DAG.md](orchestration/DAG.md)).

Corolarios prácticos:

- Un componente **nunca** llama a `getUserMedia`, `canvas.getContext` ni
  `sessionStorage` directamente. Eso vive en `hooks/`, `utils/` o `services/`.
- Un hook **nunca** importa un componente.
- `constants/` y `utils/` no importan nada de `src/` salvo tipos.

## 4. Estructura actual

```
src/
├── App.tsx                    ← registro de rutas (2 activas, 4 comentadas · /review sin dar de alta)
├── main.tsx
├── index.css                  ← reset + 23 custom properties en :root
├── assets/
│   ├── draws/                 ← layoutIcon1..3.svg, en uso
│   ├── frames/{classic,wide,spotlight}/  ← 8 SVG cada uno + carpeta de menú sin usar
│   ├── backgrounds/{classic,wide-and-spotlight}/  ← 25 + 21 PNG
│   └── stickers/{3dStyle,drawStyle,feltStyle,pixelStyle}/  ← 273 PNG
├── components/
│   ├── ui/                    ← Button, Card, Modal
│   ├── layouts/               ← PageShell, WebAppOldStyle, AppFooter
│   └── result/                ← SOLO PhotoResult.module.css (D7) · el .tsx lo hace U5
├── context/
│   └── PhotoBoothContext.tsx  ← useReducer · 6 campos, 11 acciones (S1)
├── types/
│   └── photobooth.ts          ← forma del estado + unión de acciones (S1)
├── constants/
│   ├── layouts.ts             ← LayoutId + geometría + LAYOUT_LIST (S2)
│   └── {frames,backgrounds,stickers}.ts  ← manifiestos por import.meta.glob (X1)
├── utils/
│   ├── imageUtils.ts          ← primitivas de imagen (C1)
│   ├── canvasUtils.ts         ← composición de la tira (C2)
│   ├── frameArtUtils.ts       ← SVG del marco → recortes + capa neutralizada (C2)
│   ├── svgPathUtils.ts        ← parseo de path-data, sin DOM (C2)
│   └── assetManifest.ts       ← fontanería común de los manifiestos (X1)
├── hooks/
│   └── useRouteGuard.ts       ← guards de las 6 rutas (S3)
└── pages/
    ├── homePage/              ← implementada
    ├── layoutPage/            ← implementada (referencia del patrón)
    ├── reviewPage/            ← SOLO el .module.css (D7)
    └── {camera,upload,decoration,final}Page/  ← .module.css escrito, .tsx de 0 bytes
```

**Tres cosas que sorprenden al mirar el árbol:**

1. **Las cinco pantallas pendientes ya tienen su CSS**, escrito en el lote D3-D7. Lo que
   falta es el `.tsx`. Si vas a montar una página, **no escribas CSS**: léelo, ya está,
   y las clases que expone están en `docs/design/<pantalla>.md`.
2. **`services/` no existe.** Era una carpeta vacía sin trackear y git nunca la llevó; la
   crea C6. `hooks/` sí existe ya, desde S3.
3. **Las pegatinas ya no se llaman `icons/`.** X1 las renombró a `stickers/`, porque no
   son iconos de UI y el nombre inducía a error. Ver [contracts/assets.md](contracts/assets.md).

## 5. Patrón de composición de página

`src/pages/layoutPage/LayoutPage.tsx` es la **implementación de referencia**.
Léela antes de crear cualquier página.

```tsx
<PageShell>                                  {/* wrapper + AppFooter */}
  <WebAppOldStyle                            {/* chrome retro: barra + logo + cerrar */}
    className={styles.wideWindow}
    contentClassName={styles.windowContent}
  >
    {/* contenido de la página */}
  </WebAppOldStyle>

  <Modal ... />   {/* los modales son hermanos de WebAppOldStyle, dentro de PageShell */}
</PageShell>
```

## 6. Estado global

### Actual — S1 y S2 cerrados el 2026-07-26

```ts
// context/PhotoBoothContext.tsx
const { state, dispatch } = usePhotoBooth();
// state: { selectedLayout, source, photos[], frame, background, stickers[] }
// dispatch: unión discriminada de 11 acciones · types/photobooth.ts

// constants/layouts.ts (S2)
type LayoutId = 'classic' | 'wide' | 'spotlight';
```

Un `useReducer` con los 6 campos del flujo completo y las 11 acciones del contrato.
`usePhotoBooth()` sigue lanzando fuera del provider (buena decisión, mantenida), y no
expone setters de conveniencia: cada uno sería una segunda forma de mutar lo mismo.

`LayoutId` ya **no** se define aquí — vive en `constants/layouts.ts` con la geometría.

Los tres alias de manifiesto (`FrameId`, `StickerId`, `BackgroundId`) se declararon en S1
como `string` con un `TODO(X1)`, a la espera de que X1 los estrechara.

**X1 aterrizó y no los estrechó**: definió los suyos propios en `constants/`. Así que hoy
hay **dos definiciones de cada uno** y el estado sigue usando la ancha, que es la deuda
**D9** de §7. Es exactamente contra lo que avisa la regla 5 del contrato de estado.

### Lo que quedó hecho

Dos cambios, ambos propiedad de `booth-state`, **los dos ya aplicados**:

1. **`square` → `spotlight`** (nodo S2 ✅). El nombre viejo mentía: ese layout es
   apaisado con una foto destacada, no cuadrado. Ver
   [contracts/layouts.md](contracts/layouts.md). Queda el renombrado de
   `assets/frames/square/` → `spotlight/`, hecho en X1.
2. **`useState` → `useReducer`** (nodo S1 ✅). Contrato en
   [contracts/state.md](contracts/state.md). Motivo: `photos`, `frame`, `background` y
   `stickers` se actualizan de forma relacionada y desde páginas y pasos distintos; con
   `useState` sueltos, cada uno inventaría su forma de mutarlos.

**No** introducir Zustand ni Redux. Seis campos y once acciones no lo justifican.
Contrato completo — forma, acciones, guards, persistencia — en
[contracts/state.md](contracts/state.md).

## 7. Deuda conocida

Estado a 2026-07-27. Cada punto es candidato a nodo del DAG.

| #   | Deuda                                                                                                         | Ubicación                               | Impacto                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------- |
| D1  | **Resuelto** (S2). `cardData` se reconstruía en cada render y tenía datos de dominio                          | `pages/layoutPage/LayoutPage.tsx:26`    | Vive en `constants/layouts.ts` como `LAYOUT_LIST`                                           |
| D2  | **Resuelto.** Los `alt` describen mal los layouts y `square` no es cuadrado (es 4:3 apaisado con rejilla 1+3) | `LayoutPage.tsx:30-42`                  | Ver [contracts/layouts.md](contracts/layouts.md)                                            |
| D3  | `Modal` sin focus trap, sin restaurar foco al cerrar, sin `aria-labelledby`                                   | `components/ui/Modal.tsx:34`            | Accesibilidad                                                                               |
| D4  | Idioma mezclado: UI en inglés, `alt` en español                                                               | `HomePage.tsx`, `LayoutPage.tsx`        | El `alt` es texto de usuario; hay que elegir uno                                            |
| D5  | **Resuelto** (P8). Indentación con tabs en un fichero, 2 espacios en el resto                                 | `components/layouts/WebAppOldStyle.tsx` | Pasada de Prettier aplicada el 2026-07-26: 41 ficheros en un commit solo de formato         |
| D6  | 4 páginas son ficheros de 0 bytes con imports comentados                                                      | `pages/*`, `App.tsx:5`                  | Es el trabajo pendiente                                                                     |
| D7  | Sin runner de tests                                                                                           | —                                       | La única puerta de calidad es `npm run build` + revisión                                    |
| D8  | `npm run lint` da **1 error preexistente**: `react-refresh/only-export-components`                            | `context/PhotoBoothContext.tsx`         | El fichero exporta el provider _y_ `usePhotoBooth`. `eslint --fix` no lo arregla. Ver abajo |
| D9  | **`FrameId`, `StickerId` y `BackgroundId` están definidos DOS veces**                                         | `types/photobooth.ts` y `constants/`    | El estado usa la versión ancha (`string`), así que nada impide guardar un id inválido       |

**Sobre D8, porque va a confundir a alguien.** `npm run build` está limpio, pero
`npm run lint` **no**: da un error, y daba el mismo antes de S1 (comprobado contra
`HEAD` el 2026-07-26 — la única diferencia es el número de línea). No lo introdujo ningún
nodo y no rompe nada en producción: `react-refresh` solo afecta al hot-reload en
desarrollo.

El arreglo canónico es mover `usePhotoBooth` a su propio fichero, y eso es de
`booth-state` (`src/context/**`). No se ha hecho aquí porque no es el alcance de S1 y
porque toca los imports de toda página que consuma el contexto: cuanto más tarde, más
caro. Candidato a nodo propio antes de la primera `U*`.

Lo que **no** hay que hacer es asumir que `npm run lint` está verde: hoy no lo está, y
un agente que dé por bueno "el lint pasa" sin mirar se va a llevar una sorpresa.

**Sobre D9.** S1 declaró los tres alias como `string` con un `TODO(X1)` porque los
manifiestos no existían, y el contrato decía que **X1 los estrecharía al llegar**. X1 llegó,
pero definió los suyos en `constants/{frames,stickers,backgrounds}.ts` y no tocó
`types/photobooth.ts`, que no es suyo. Nadie hizo nada mal; se cayó por la juntura entre dos
nodos.

Consecuencia real: `state.frame` es `string | null`, así que el compilador acepta
`'no-existe/nada'`. Los getters del manifiesto ya devuelven `null` ante un id desconocido, y
`canvasUtils` lo pinta como "sin marco", así que **no hay bug en tiempo de ejecución** — pero
se pierde la red de seguridad que el contrato quería. El arreglo es que `types/photobooth.ts`
reexporte los tipos de `constants/`, y es de `booth-state`.

## 8. Divergencias con `Analisis/arquitectura.md`

Ese documento **no describe este repositorio**. Diferencias verificadas:

| `arquitectura.md` §15                          | Realidad                                          |
| ---------------------------------------------- | ------------------------------------------------- |
| `.jsx` sin tipos                               | `.tsx` con TypeScript estricto                    |
| Context + `useReducer` ya implementado         | `useState` con un solo campo                      |
| `pages/HomePage.jsx` plano                     | `pages/homePage/HomePage.tsx`, carpeta por página |
| `components/{camera,upload,decoration,final}/` | Solo `ui/` y `layouts/`                           |
| No menciona `PageShell` ni `WebAppOldStyle`    | Son el patrón de composición real                 |
| `constants/layouts.js` existe                  | `constants/` está vacía                           |
| `hooks/`, `services/`, `utils/` con contenido  | Vacías                                            |
| 6 rutas activas                                | 2 activas                                         |

Lo que **sí** sigue siendo válido de ese documento: el flujo de pantallas (§15.1),
la forma del estado objetivo (§15.2), la idea de guards de ruta (§15.9) y el grafo
de capas (§15.10). Todo eso está ya recogido aquí o en `docs/contracts/`.
No hace falta volver a abrirlo. Ver [reference/TRIAJE.md](reference/TRIAJE.md).

Excepción a favor del documento: su §15.7 **acertaba** con la disposición de los
tres layouts, y son los `alt` del código los que están mal (deuda D2). Lo que sí
falla de esa sección es el canvas único de 600×1800: solo vale para `classic`.

## 9. Flujo definitivo

Fijado el 2026-07-26 conciliando el diseño con el código. Node IDs en
[design/FIGMA.md](design/FIGMA.md).

```
HomePage         /            ✅ implementada
   ↓
LayoutPage       /layout      ✅ implementada  (elige 1 de 3 · modal de origen)
   ↓
CameraPage       /camera   ──┐  4 fotos con cuenta atrás
UploadPage       /upload  ──┤  4 fotos desde archivo
                            ↓
SelectedPicturesPage /review   revisar el strip: seguir o repetir
   ↓
DecorationPage   /decoration   TRES pasos: frames → fondos → iconos
   ↓
FinalPage        /final        resultado + descargar + rehacer
```

**`/decoration` es una ruta con tres pasos internos**, no tres rutas. El paso vive en
`useState` local de la página: no va al estado global, no se persiste, y no aparece en
la URL. Por eso siguen siendo seis rutas y no ocho.

**Seis rutas.** `/review` es nueva respecto al plan original y entra en alcance.

**`Loading` no es una ruta: es un componente.** En Figma (`91:1283`) es un spinner
de 147×147 dentro de la envoltura estándar. Vive en `components/ui/Loading.tsx` y
lo usan las páginas que esperan (composición del canvas, lectura de archivos).

**`/review` y `/final` comparten componente.** En Figma las dos pantallas
(`91:1346` y `2074:52`) son estructuralmente idénticas — mismos textos, mismo
bloque de 4 huecos, solo cambian los botones. Un único `PhotoResult`
parametrizado por copy y acciones sirve a ambas. No son dos trabajos.

**Idioma: todo el texto de usuario en inglés**, incluidos los `alt`. Hoy la UI
está en inglés y los `alt` en español (deuda D4); se corrige al tocar cada página.

### El concepto que faltaba: marco

Un _marco_ es un conjunto temático de cuatro recortes — uno por hueco, distintos
entre sí pero de la misma temática. El usuario elige el tema; el reparto de las cuatro
máscaras es fijo. Eso añade un sexto campo al estado (`frame`) y una acción
(`SET_FRAME`), aplica las máscaras en `canvasUtils` y añade `constants/frames.ts` al
manifiesto de assets. No estaba en el plan original porque la pantalla que lo introduce
estaba sin nombrar en Figma. Ver [contracts/state.md](contracts/state.md) y
[../specs/decoration.md](../specs/decoration.md).
