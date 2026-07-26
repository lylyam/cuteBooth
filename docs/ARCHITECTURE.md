# Arquitectura real de CuteBooth

> Este documento describe **lo que hay**, no lo que se planeó. Verificado contra
> `src/` el 2026-07-25. Si el código y este documento discrepan, el código gana y
> este documento se corrige.

## 1. Qué es

Photobooth en navegador, 100 % cliente. Sin backend, sin base de datos, sin auth.
El usuario elige un layout, consigue 4 fotos (cámara o subida), las decora con
fondo y stickers, y descarga una imagen compuesta.

## 2. Stack y restricciones

- **React 19.2** + **TypeScript 5.9** (estricto, project references)
- **Vite 8** (bundler Rolldown) — el React Compiler está cableado a mano como
  preset de Babel en `vite.config.ts` vía `@rolldown/plugin-babel`. **No migrar** a
  la integración estándar sin comprobar que sigue funcionando con Rolldown.
- **React Router v7**, `BrowserRouter`, rutas declaradas en `src/App.tsx`
- **CSS Modules** (`X.module.css` junto a `X.tsx`) + custom properties en `:root`.
  Sin Tailwind, sin styled-components, sin librería de UI.
- **Sin librería de estado global.** Context API.
- **Sin runner de tests.** No hay Vitest, ni Jest, ni Testing Library.
- **Sin Prettier.** El formateo es inconsistente (ver §7).

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
├── App.tsx                    ← registro de rutas (2 activas, 4 comentadas)
├── main.tsx
├── index.css                  ← reset + 21 custom properties en :root
├── assets/
│   ├── draws/                 ← layoutIcon1..3.svg, en uso
│   ├── backgrounds/           ← VACÍA
│   └── icons/{feltIcons,handDrawIcons}/  ← VACÍAS
├── components/
│   ├── ui/                    ← Button, Card, Modal
│   └── layouts/               ← PageShell, WebAppOldStyle, AppFooter
├── context/
│   └── PhotoBoothContext.tsx  ← useState, SOLO selectedLayout
├── pages/
│   ├── homePage/              ← implementada
│   ├── layoutPage/            ← implementada (referencia del patrón)
│   └── {camera,upload,decoration,final}Page/  ← .tsx VACÍOS (0 bytes)
├── hooks/                     ← VACÍA
├── services/                  ← VACÍA
├── utils/                     ← VACÍA
└── constants/                 ← VACÍA
```

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

### Actual

```ts
// context/PhotoBoothContext.tsx
type PhotoBoothContextValue = {
  selectedLayout: LayoutId | null;
  setSelectedLayout: (layout: LayoutId) => void;
};
type LayoutId = 'classic' | 'wide' | 'square';   // 'square' se renombra en S2
```

Un `useState`. Nada más. `usePhotoBooth()` lanza si se usa fuera del provider
(buena decisión, mantenerla).

### Objetivo

Dos cambios, ambos propiedad de `booth-state`:

1. **`square` → `spotlight`** (nodo S2). El nombre actual miente: ese layout es
   apaisado con una foto destacada, no cuadrado. Se renombra **antes** de que nada
   más dependa de él. Ver [contracts/layouts.md](contracts/layouts.md).
2. **`useState` → `useReducer`** con los campos del flujo completo (nodo S1). El
   contrato exacto está en [contracts/state.md](contracts/state.md). Motivo: `photos`, `stickers`
   y `background` se actualizan de forma relacionada y desde páginas distintas;
   con `useState` sueltos, cada página inventaría su forma de mutarlos.

**No** introducir Zustand ni Redux. Cinco campos y diez acciones no lo justifican.
Contrato completo — forma, acciones, guards, persistencia — en
[contracts/state.md](contracts/state.md).

## 7. Deuda conocida

Estado a 2026-07-25. Cada punto es candidato a nodo del DAG.

| # | Deuda | Ubicación | Impacto |
|---|---|---|---|
| D1 | `cardData` se reconstruye en cada render y contiene datos de dominio | `pages/layoutPage/LayoutPage.tsx:26` | Debe vivir en `constants/layouts.ts` |
| D2 | **Resuelto.** Los `alt` describen mal los layouts y `square` no es cuadrado (es 4:3 apaisado con rejilla 1+3) | `LayoutPage.tsx:30-42` | Ver [contracts/layouts.md](contracts/layouts.md) |
| D3 | `Modal` sin focus trap, sin restaurar foco al cerrar, sin `aria-labelledby` | `components/ui/Modal.tsx:34` | Accesibilidad |
| D4 | Idioma mezclado: UI en inglés, `alt` en español | `HomePage.tsx`, `LayoutPage.tsx` | El `alt` es texto de usuario; hay que elegir uno |
| D5 | Indentación con tabs en un fichero, 2 espacios en el resto | `components/layouts/WebAppOldStyle.tsx` | Se resuelve con Prettier, no a mano |
| D6 | 4 páginas son ficheros de 0 bytes con imports comentados | `pages/*`, `App.tsx:5` | Es el trabajo pendiente |
| D7 | Sin runner de tests | — | La única puerta de calidad es `npm run build` + revisión |

## 8. Divergencias con `Analisis/arquitectura.md`

Ese documento **no describe este repositorio**. Diferencias verificadas:

| `arquitectura.md` §15 | Realidad |
|---|---|
| `.jsx` sin tipos | `.tsx` con TypeScript estricto |
| Context + `useReducer` ya implementado | `useState` con un solo campo |
| `pages/HomePage.jsx` plano | `pages/homePage/HomePage.tsx`, carpeta por página |
| `components/{camera,upload,decoration,final}/` | Solo `ui/` y `layouts/` |
| No menciona `PageShell` ni `WebAppOldStyle` | Son el patrón de composición real |
| `constants/layouts.js` existe | `constants/` está vacía |
| `hooks/`, `services/`, `utils/` con contenido | Vacías |
| 6 rutas activas | 2 activas |

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
DecorationPage   /decoration   fondo + stickers
   ↓
FinalPage        /final        resultado + descargar + rehacer
```

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

### Lo que sigue sin resolver

**No hay pantalla Decoration diseñada.** Los nodos `102:319` y `103:382` se
llaman "Selected pictures" pero contienen un panel "Frames" con 8 formas, que es
un selector de decoración. Y no hay panel de fondos ni de stickers en ninguna
parte del fichero. Registrado en [orchestration/KICKOFF.md](orchestration/KICKOFF.md) §6.
