# Contrato · Estado global

> Dueño: `booth-state` (nodos **S1** y **S3**).
> Consumidores: `ui-composer` (U1-U5), `canvas-media` (C4, C5, C6).
> `LayoutId` y la geometría **no** se definen aquí: ver [layouts.md](layouts.md).

## Forma del estado

```ts
// src/types/photobooth.ts
import type { LayoutId } from '../constants/layouts';
import type { FrameId } from '../constants/frames'; // X1
import type { StickerId } from '../constants/stickers'; // X1
import type { BackgroundId } from '../constants/backgrounds'; // X1

export type PhotoSource = 'camera' | 'upload';

export type Photo = {
  id: string; // crypto.randomUUID()
  dataUrl: string; // JPEG data URL
};

export type StickerInstance = {
  instanceId: string;
  assetId: StickerId;
  x: number; // px del canvas del layout activo, NO px CSS ni %
  y: number;
};

export type PhotoBoothState = {
  selectedLayout: LayoutId | null;
  source: PhotoSource | null;
  photos: Photo[]; // 0..4 · el índice ES el número de hueco
  frame: FrameId | null; // /decoration paso 1 · un marco, no 4 máscaras
  background: BackgroundId | null; // /decoration paso 2
  stickers: StickerInstance[]; // /decoration paso 3
};
```

**Por qué un reducer y no seis `useState`:** estos campos se escriben desde páginas y
pasos distintos y se leen juntos al componer el canvas. Sin reducer, cada pantalla
inventa su forma de mutarlos. **No** entra Zustand ni Redux: seis campos no lo pagan.

**`dataUrl` y no `Blob` ni object URL:** es serializable, así que C6 puede persistirlo
y no hay `revokeObjectURL` que olvidar. Cuesta ~33 % de tamaño y presiona la cuota de
`sessionStorage` — eso lo absorbe C6, no el estado.

**`frame` es UN id, no cuatro.** Verificado contra el arte real: un marco es **el dibujo
completo de la tira para un layout** — rectángulo exterior más los cuatro huecos, en un
solo SVG. Las formas raras (nube, orejas de gato) van dentro de ese mismo fichero.

**Y el id está acotado a su layout**: `'classic/Frame 7'`. No hay correspondencia entre
marcos de layouts distintos, y no hace falta — el layout se elige antes de decorar y no
hay vuelta atrás. Detalle en [assets.md](assets.md).

**Nada derivado vive en el estado.** La imagen compuesta no se guarda: la produce
`useCanvas` a demanda. **El paso actual de `/decoration` tampoco**: es `useState` local
de la página, no se persiste y no debe sobrevivir a un refresco.

**Si X1 aún no ha aterrizado** cuando corra S1, los tres alias de manifiesto se
declaran como `string` con un `TODO` que nombre X1, y X1 los estrecha al llegar. Lo que
**no** se hace es duplicar aquí las listas de IDs.

## Las once acciones

| Acción           | Payload                                        | Quién la dispara    | Efecto                                                                |
| ---------------- | ---------------------------------------------- | ------------------- | --------------------------------------------------------------------- |
| `SET_LAYOUT`     | `{ layout: LayoutId }`                         | `/layout`           |                                                                       |
| `SET_SOURCE`     | `{ source: PhotoSource }`                      | modal de `/layout`  | Lo necesitan los "repetir" de `/review` y `/final`                    |
| `ADD_PHOTO`      | `{ photo: Photo }`                             | `/camera`           | **No-op si ya hay 4**                                                 |
| `SET_PHOTOS`     | `{ photos: Photo[] }`                          | `/upload`           | Reemplaza el lote. Trunca a 4                                         |
| `CLEAR_PHOTOS`   | —                                              | `/review`, `/final` | Vacía `photos`. **Conserva todo lo demás**                            |
| `SET_FRAME`      | `{ frame: FrameId \| null }`                   | `/decoration` 1     | `null` = **sin elección** → se dibuja el rectangular del layout (C2b) |
| `SET_BACKGROUND` | `{ background: BackgroundId \| null }`         | `/decoration` 2     | `null` = sin fondo                                                    |
| `ADD_STICKER`    | `{ sticker: StickerInstance }`                 | `/decoration` 3     |                                                                       |
| `MOVE_STICKER`   | `{ instanceId: string; x: number; y: number }` | `/decoration` 3     | Posición absoluta, no delta                                           |
| `REMOVE_STICKER` | `{ instanceId: string }`                       | `/decoration` 3     |                                                                       |
| `RESET`          | —                                              | ninguno hoy         | Vuelve a `initialState`                                               |

**Dos acciones nuevas respecto al plan de nueve.** `SET_FRAME`, porque los frames no
estaban en el flujo cuando se escribió. Y `CLEAR_PHOTOS`, que exigen el "repetir" de
`/review` y el "Retake" de `/final`: el usuario quiere otras fotos, no otro layout ni
volver a decorar. `RESET` lo mandaría al principio; esto lo devuelve a `/camera` o
`/upload` según `source`, con layout, frame, fondo y stickers intactos.

`RESET` sigue en el contrato sin consumidor: es lo que necesitará el botón de cerrar de
`WebAppOldStyle` cuando se le cablee `onCloseClick`.

`PhotoBoothAction` es una unión discriminada por `type`. El `switch` del reducer es
exhaustivo y **sin `default`**, para que `tsc` avise cuando alguien añada una acción y
olvide manejarla.

## API del provider

```ts
const { state, dispatch } = usePhotoBooth();
```

Dos claves. Sin setters de conveniencia — cada uno sería una segunda forma de mutar lo
mismo. Los derivados se calculan en el consumidor: `state.photos.length === 4`.
`usePhotoBooth()` **sigue lanzando** fuera del provider: eso ya está en el código y se
mantiene.

## Guards de ruta · nodo S3

`hooks/useRouteGuard.ts`. Requisito incumplido → `<Navigate to="/" replace />`.

| Ruta                               | Requiere                                         |
| ---------------------------------- | ------------------------------------------------ |
| `/`, `/layout`                     | —                                                |
| `/camera`, `/upload`               | `selectedLayout !== null`                        |
| `/review`, `/decoration`, `/final` | `selectedLayout !== null && photos.length === 4` |

`/final` **no** exige `frame`, `background` ni `stickers`: decorar es opcional y se
puede cruzar `/decoration` sin elegir nada. El guard no es donde se fuerza el gusto.

Es un hook y no un componente envolvente: la página decide dónde llamarlo y no se añade
una capa al árbol. El `Navigate` sale del `return` de la página, nunca de un efecto.

## Persistencia · nodo C6

`services/storageService.ts`, `sessionStorage`, clave `cutebooth:v1`. `sessionStorage` y
no `localStorage`: una sesión de photobooth no sobrevive al cierre de la pestaña.

1. Se persiste el estado entero. `QuotaExceededError` **es lo esperado** con 4 fotos, no
   una excepción: al fallar, reintentar sin `photos` y guardar el resto.
2. Al montar: leer, validar la forma y, si no valida, **descartar en silencio**.
3. La versión va en la clave. Si cambia el contrato, cambia la clave: sin migraciones.

## Reglas

1. **Un solo contenedor de estado.** Lo que solo le importa a una página (modal abierto,
   índice de captura, paso de decoración) es `useState` local.
2. **`photos.length` nunca pasa de 4.** Lo garantiza el reducer, no la página.
3. **Las coordenadas de sticker son px del canvas** del layout activo. La conversión
   px-CSS ↔ px-canvas es de `useStickers` (C5) y no llega al estado.

   ⚠️ **La trampa que C4 dejó avisada, y cuesta cara.** El factor **no** es
   `canvas.width / rect.width`. `canvas.width` es el bitmap, que vale caja CSS × DPR;
   pero `sticker.x/y` y `getStickerBox()` están en **unidades del canvas del layout**
   (654×1911). El factor correcto es:

   ```
   LAYOUTS[layout].canvas.width / canvas.clientWidth      // sin DPR de por medio
   ```

   Con el bitmap, las pegatinas se colocan **al doble de distancia en cualquier pantalla
   retina** — y en el portátil del que programa se ve bien. Y `clientWidth`, nunca
   `getBoundingClientRect()`: la tira de `/review` y `/final` va rotada 7,28°, y el rect
   devuelve la caja envolvente (409 px donde `clientWidth` da 300).

4. **Un `frame` o un `background` desconocido al rehidratar se trata como `null`.**
   El manifiesto puede cambiar; el estado guardado no manda sobre él. Y los fondos son
   **por familia de layout**: el juego de `classic` no vale para `wide`/`spotlight`.
5. **`LayoutId` se define en `constants/layouts.ts`.** `PhotoBoothContext` deja de
   exportarlo: dos definiciones del mismo tipo es una divergencia esperando su turno.
6. **Excepción de propiedad.** S1 y S2 pueden editar `pages/layoutPage/LayoutPage.tsx`
   **solo** para migrar sus llamadas (`setSelectedLayout` → `dispatch`, `cardData` →
   `LAYOUT_LIST`). Cualquier otro cambio ahí es de `ui-composer`.

## Criterio de aceptación de S1

- [x] `types/photobooth.ts` exporta `Photo`, `StickerInstance`, `PhotoSource`,
      `PhotoBoothState` y `PhotoBoothAction`
- [x] El reducer maneja las **11** acciones, con `switch` exhaustivo y sin `default`
- [x] `ADD_PHOTO` con 4 fotos ya presentes no cambia el estado
- [x] `CLEAR_PHOTOS` deja intacto todo menos `photos`
- [x] `usePhotoBooth()` devuelve `{ state, dispatch }` y lanza fuera del provider
- [x] `LayoutPage` funciona igual que antes y ya no importa `LayoutId` del contexto
- [x] `npm run build` limpio

**Verificado por el orquestador**, no solo reportado: el `switch` no tiene `default` y el
tipo de retorno está anotado, así que `tsc` marca el fallthrough (TS2366) si alguien añade
una acción y olvida manejarla. `ADD_PHOTO` con 4 fotos devuelve el **mismo objeto**, no un
clon.

**Deuda D9, cerrada.** `types/photobooth.ts` ya no declara `FrameId`/`StickerId`/
`BackgroundId` como `string`: los reexporta (`import type` + `export type`) desde
`constants/{frames,stickers,backgrounds}.ts`, que son la fuente de verdad de X1. Una
sola definición de cada uno, como pide la regla 5. `state.frame`, `state.background` y
`StickerInstance.assetId` quedan con los tipos estrechos
(`` `${LayoutId}/${string}` ``, `` `${BackgroundFamily}/${string}` ``,
`` `${StickerStyle}/${string}` ``); asignar un literal fuera de esas plantillas ya no
compila. `import type` no deja huella en runtime: el JS de `dist/` no creció al cerrar
esto (verificado, mismo hash de chunk).

## Criterio de aceptación de S3

- [x] Entrar en frío a `/camera`, `/upload`, `/review`, `/decoration` o `/final`
      redirige a `/`
- [x] Con layout elegido, `/camera` y `/upload` se abren sin redirección
- [x] Con layout y 4 fotos, las tres últimas se abren sin redirección
- [x] La redirección usa `replace`: el botón atrás no crea un bucle

**Verificado por inspección, no por render.** Las cinco páginas siguen siendo ficheros de
0 bytes, así que no hay dónde montar el hook todavía. La comprobación de verdad —entrar en
frío a `/decoration` y acabar en `/`— se hace en la primera `U*` que lo consuma, y hasta
entonces esto es una promesa de tipos, no un hecho observado.

Firma, que es lo que copian las cinco pantallas:

```tsx
const redirect = useRouteGuard('layout'); // /camera, /upload
const redirect = useRouteGuard('layoutAndPhotos'); // /review, /decoration, /final
if (redirect) return redirect;
```

`/` y `/layout` no llaman al hook. Devuelve un `<Navigate to="/" replace />` construido con
`createElement` (el fichero es `.ts`, no `.tsx`) para que la página lo devuelva **desde su
render**, nunca desde un efecto.
