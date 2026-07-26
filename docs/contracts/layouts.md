# Contrato · Layouts

> Dueño: `booth-state` (nodo **S2**).
> Consumidores: `canvas-media` (C2, C4), `ui-composer` (U1-U5), `asset-pipeline`.
> **S2 es la raíz del camino crítico.** Cerrarlo desbloquea el 60 % del proyecto.

## Los tres layouts

**Decidido: `square` se renombra a `spotlight`.** El nombre viejo mentía — no es
cuadrado, es apaisado con una foto destacada. El renombrado se hace **aquí, en
S2**, antes de que nada más dependa de él.

```ts
export type LayoutId = 'classic' | 'wide' | 'spotlight';
```

Alcance del renombrado: `context/PhotoBoothContext.tsx`, `pages/layoutPage/LayoutPage.tsx`,
y este contrato. Nada más lo usa todavía — por eso es ahora y no después.

## Geometría — fuente canónica

De las tres pantallas Upload de Figma, que no son tres estados sino los tres
layouts. Px de wireframe, relativos al frame contenedor.

### `classic` — nodo `91:1168`, frame `91:1196` · 217.07 × 637

| # | x | y | w | h |
|---|---|---|---|---|
| 1 | 22.54 | 20 | 172 | 120.99 |
| 2 | 22.54 | 154.99 | 172 | 120.99 |
| 3 | 22.54 | 289.99 | 172 | 120.99 |
| 4 | 22.54 | 424.98 | 172 | 120.99 |

Tira vertical. Margen inferior grande (≈91 px) — es el pie del photostrip clásico.

### `wide` — nodo `91:1202`, frame `91:1244` · 468 × 419

| # | x | y | w | h |
|---|---|---|---|---|
| 1 | 24 | 20 | 203 | 143 |
| 2 | 241 | 20 | 203 | 143 |
| 3 | 24 | 177 | 203 | 143 |
| 4 | 241 | 177 | 203 | 143 |

### `spotlight` — nodo `91:1223`, frame `91:1277` · 468 × 419

| # | x | y | w | h |
|---|---|---|---|---|
| 1 | 20 | 20 | 428 | 246 |
| 2 | 20 | 286 | 134 | 95 |
| 3 | 167 | 286 | 134 | 95 |
| 4 | 314 | 286 | 134 | 95 |

## Escala de exportación

Los números de arriba son de wireframe: demasiado pequeños para un PNG
descargable. Se multiplican por un factor único y se redondean a entero.

```
EXPORT_SCALE = 3

classic   →  651 × 1911
wide      → 1404 × 1257
spotlight → 1404 × 1257
```

El factor va **explícito en el módulo**, no aplicado a mano en las tablas. Así se
cambia la resolución de salida en un sitio.

## Dos incoherencias, ya resueltas

**1. Ratio SVG vs. Figma.** Los iconos de `assets/draws/` dan 1.33 para
`wide`/`spotlight`; Figma da 468/419 = 1.12. **Manda Figma**: los SVG son iconos
de la tarjeta de selección, no el marco de salida. No los toques por esto.

**2. `Selected pictures` dibuja otro classic.** El nodo `92:42` usa 278.99×621.36
con huecos de 175.2×133.6. **Manda Upload**, que es donde están los tres layouts
juntos y por tanto donde son coherentes entre sí.

## Forma del módulo

```ts
// src/constants/layouts.ts
export type LayoutId = 'classic' | 'wide' | 'spotlight';

export type Slot = { x: number; y: number; width: number; height: number };

export type LayoutDef = {
  id: LayoutId;
  label: string;    // visible en UI — en inglés
  alt: string;      // describe la DISPOSICIÓN, no el marco — en inglés
  icon: string;     // import del SVG de assets/draws/
  canvas: { width: number; height: number };   // ya escalado
  slots: [Slot, Slot, Slot, Slot];             // exactamente 4, ya escalados
};

export const EXPORT_SCALE = 3;
export const LAYOUTS: Record<LayoutId, LayoutDef>;
export const LAYOUT_LIST: LayoutDef[];   // orden de presentación en LayoutPage
```

## Reglas

1. **Exactamente 4 slots.** La tupla lo fuerza en tipos: si algún día hay un
   layout de 2 o 6, es un cambio de contrato, no un descuido.
2. **Coordenadas absolutas en px** del canvas de *ese* layout, no porcentajes.
   `canvasUtils` dibuja directo, sin conversión.
3. **Todo el texto en inglés**, incluidos los `alt`. Los actuales están en español
   y además describen mal la disposición (deuda D2 y D4 de ARCHITECTURE).
4. `LayoutPage.tsx` consume `LAYOUT_LIST` y deja de declarar `cardData` en el
   cuerpo del componente (deuda D1).
5. **Nadie más define geometría.** Si `canvasUtils` necesita un número, sale de aquí.

## Criterio de aceptación de S2

- [ ] `LayoutId` es `'classic' | 'wide' | 'spotlight'`; `square` no aparece en `src/`
- [ ] `constants/layouts.ts` exporta `EXPORT_SCALE`, `LAYOUTS` y `LAYOUT_LIST` tipados
- [ ] Los 3 layouts tienen 4 slots y `canvas` propio, escalados por `EXPORT_SCALE`
- [ ] Los `alt` están en inglés y describen la disposición real
      (vertical strip of 4 / 2×2 grid / one large photo above three small)
- [ ] `LayoutPage.tsx` consume `LAYOUT_LIST`; `cardData` ya no existe
- [ ] `npm run build` limpio y `/layout` se ve igual que antes
