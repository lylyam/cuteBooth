# Contrato · Layouts

> Dueño: `booth-state` (nodo **S2**).
> Consumidores: `canvas-media` (C2, C4), `ui-composer` (U1-U5), `asset-pipeline`.
> **S2 es la raíz del camino crítico.** Cerrarlo desbloquea el 60 % del proyecto.

## Los tres layouts

**Decidido: `square` se renombra a `spotlight`.** El nombre viejo mentía — no es
cuadrado, es apaisado con una foto destacada. El renombrado se hace **aquí, en S2**,
antes de que nada más dependa de él.

```ts
export type LayoutId = 'classic' | 'wide' | 'spotlight';
```

Alcance del renombrado: `context/PhotoBoothContext.tsx`,
`pages/layoutPage/LayoutPage.tsx`, `src/assets/frames/spotlight/` (renombrado en X1), y este
contrato. Nada más lo usa todavía — por eso es ahora y no después.

## Geometría — la fuente es el ARTE

**Decidido el 2026-07-26.** Los números salen de los SVG de marco del repo, no del
wireframe de Upload. Motivo: el marco se dibuja **encima** de las fotos, así que la única
geometría que puede estar bien es la del propio dibujo que las va a rodear. Ver §
_Cómo se leen_ y § _Qué cambió_.

Fuente por layout — el marco rectangular simple de cada carpeta:

| Layout      | Fichero                               | Canvas (viewBox) |
| ----------- | ------------------------------------- | ---------------- |
| `classic`   | `assets/frames/classic/Frame 7.svg`   | 218 × 637        |
| `wide`      | `assets/frames/wide/Frame 7.svg`      | 468 × 419        |
| `spotlight` | `assets/frames/spotlight/Frame 8.svg` | 468 × 419        |

### `classic` — tira vertical de 4

| #   | x   | y      | w   | h      |
| --- | --- | ------ | --- | ------ |
| 1   | 23  | 30     | 172 | 120.99 |
| 2   | 23  | 164.99 | 172 | 120.99 |
| 3   | 23  | 300    | 172 | 120.99 |
| 4   | 23  | 434.99 | 172 | 120.99 |

### `wide` — rejilla 2×2

| #   | x   | y   | w   | h   |
| --- | --- | --- | --- | --- |
| 1   | 23  | 30  | 203 | 143 |
| 2   | 242 | 30  | 203 | 143 |
| 3   | 23  | 189 | 203 | 143 |
| 4   | 242 | 189 | 203 | 143 |

### `spotlight` — una grande arriba, tres pequeñas debajo

| #   | x   | y   | w   | h   |
| --- | --- | --- | --- | --- |
| 1   | 23  | 30  | 422 | 246 |
| 2   | 23  | 294 | 134 | 95  |
| 3   | 167 | 294 | 134 | 95  |
| 4   | 311 | 294 | 134 | 95  |

### Cómo se leen del SVG, si hay que rehacerlo

1. Los `<rect>` del SVG son **líneas centrales** de un trazo de `1.94px`. El hueco real
   es `x-0.97`, `y-0.97`, `w+1.94`, `h+1.94`. Las tablas de arriba ya lo tienen aplicado.
2. **El primer `<rect>` es el borde exterior**, no un hueco. Se descarta.
3. **El orden de los `<rect>` en el fichero NO es el orden de los huecos.** En
   `classic/Frame 7.svg` van 30, 300, 165, 436. Hay que ordenar por `y` y luego por `x`.
4. El radio de esquina de los huecos es `rx="9.03"`; el del borde exterior, `16.62`.

## Escala de exportación

Los números de arriba están en unidades del viewBox: demasiado pequeños para un PNG
descargable. Se multiplican por un factor único y se redondean a entero.

```
EXPORT_SCALE = 3

classic   →  654 × 1911
wide      → 1404 × 1257
spotlight → 1404 × 1257
```

El factor va **explícito en el módulo**, no aplicado a mano en las tablas. Así se cambia
la resolución de salida en un sitio.

## Qué cambió respecto al wireframe, y por qué da igual

La versión anterior de este contrato sacaba la geometría de las pantallas Upload de
Figma. Coincidía en el tamaño de cada hueco y en el paso entre huecos, pero situaba el
primero **10 px más arriba** (`classic` y=20 frente a y=30) y bailaba hasta 6 px en
`spotlight`. Con esos números, las fotos habrían quedado descuadradas dentro de su propio
marco.

Dos señales de que manda el arte: los números del arte son **enteros limpios**, y son los
que el usuario ve superpuestos a sus fotos.

Los tres nodos de Upload (`91:1168`, `91:1202`, `91:1223`) siguen valiendo para el **CSS**
de esa pantalla (nodo D4). Para geometría de canvas, ya no.

## Forma del módulo

```ts
// src/constants/layouts.ts
export type LayoutId = 'classic' | 'wide' | 'spotlight';

export type Slot = { x: number; y: number; width: number; height: number };

export type LayoutDef = {
  id: LayoutId;
  label: string; // visible en UI — en inglés
  alt: string; // describe la DISPOSICIÓN, no el marco — en inglés
  icon: string; // import del SVG de assets/draws/
  canvas: { width: number; height: number }; // ya escalado
  slots: [Slot, Slot, Slot, Slot]; // exactamente 4, ya escalados
};

export const EXPORT_SCALE = 3;
export const LAYOUTS: Record<LayoutId, LayoutDef>;
export const LAYOUT_LIST: LayoutDef[]; // orden de presentación en LayoutPage
```

## Reglas

1. **Exactamente 4 slots.** La tupla lo fuerza en tipos: si algún día hay un layout de 2
   o 6, es un cambio de contrato, no un descuido.
2. **Coordenadas absolutas en px** del canvas de _ese_ layout, no porcentajes.
   `canvasUtils` dibuja directo, sin conversión.
3. **Todo el texto en inglés**, incluidos los `alt`
   (vertical strip of 4 / 2×2 grid / one large photo above three small).
4. `LayoutPage.tsx` consume `LAYOUT_LIST` y deja de declarar `cardData` en el cuerpo del
   componente (deuda D1).
5. **Nadie más define geometría.** Si `canvasUtils` necesita un número, sale de aquí.
6. **Las formas de recorte NO van aquí.** Este módulo dice **dónde** va cada hueco; el
   marco elegido dice **con qué forma** se recorta, y vive en `constants/frames.ts` (X1).
   Ver [assets.md](assets.md).
7. **El ratio de los SVG de `assets/draws/` no manda.** Dan 1.33 para `wide`/`spotlight`;
   el arte da 468/419 = 1.12. Son iconos de la tarjeta de selección, no el marco de
   salida. No los toques por esto.

## Criterio de aceptación de S2

- [ ] `LayoutId` es `'classic' | 'wide' | 'spotlight'`; `square` no aparece en `src/`
- [ ] `constants/layouts.ts` exporta `EXPORT_SCALE`, `LAYOUTS` y `LAYOUT_LIST` tipados
- [ ] Los 3 layouts tienen 4 slots y `canvas` propio, escalados por `EXPORT_SCALE`
- [ ] Las coordenadas coinciden con las tablas de arriba, **verificadas contra el SVG**
- [ ] Los `alt` están en inglés y describen la disposición real
- [ ] `LayoutPage.tsx` consume `LAYOUT_LIST`; `cardData` ya no existe
- [ ] `npm run build` limpio y `/layout` se ve igual que antes
