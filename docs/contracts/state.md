# Contrato · Estado global

> Dueño: `booth-state` (nodos **S1** y **S3**).
> Consumidores: `ui-composer` (U1-U5), `canvas-media` (C4, C5, C6).
> `LayoutId` y la geometría **no** se definen aquí: ver [layouts.md](layouts.md).

## Por qué un reducer

`photos`, `background` y `stickers` se escriben desde **páginas distintas** y se
leen juntos al componer el canvas. Con `useState` sueltos cada página inventaría su
forma de mutarlos. Un reducer fija las transiciones válidas en un sitio. No entra
Zustand ni Redux: cinco campos y diez acciones no lo pagan.

## Forma del estado

```ts
// src/types/photobooth.ts
import type { LayoutId } from '../constants/layouts';
import type { StickerId } from '../constants/stickers';        // X1
import type { BackgroundId } from '../constants/backgrounds';  // X1

export type PhotoSource = 'camera' | 'upload';

export type Photo = {
  id: string;        // crypto.randomUUID()
  dataUrl: string;   // JPEG data URL — serializable, dibujable con new Image()
};

export type StickerInstance = {
  instanceId: string;   // crypto.randomUUID()
  assetId: StickerId;   // de constants/stickers.ts (X1)
  x: number;            // px del canvas del layout activo, NO px CSS ni %
  y: number;
};

export type PhotoBoothState = {
  selectedLayout: LayoutId | null;
  source: PhotoSource | null;
  photos: Photo[];                  // 0..4 · el índice ES el número de hueco
  background: BackgroundId | null;  // de constants/backgrounds.ts (X1)
  stickers: StickerInstance[];
};
```

**`dataUrl` y no `Blob` ni object URL**: es serializable, así que C6 puede
persistirlo y no hay `revokeObjectURL` que olvidar. Cuesta ~33 % de tamaño y presiona
la cuota de `sessionStorage` — eso lo absorbe C6, no el estado.

**Si X1 aún no ha aterrizado** cuando corra S1, `StickerId` y `BackgroundId` se
declaran en `types/photobooth.ts` como `string` con un `TODO` que nombre X1, y X1 los
estrecha al llegar. Lo que **no** se hace es duplicar aquí la lista de IDs.

**Nada derivado vive en el estado.** La imagen compuesta no se guarda: la produce
`useCanvas` a demanda desde `state`. Si algo se puede calcular, se calcula.

## Las diez acciones

| Acción | Payload | Quién la dispara | Efecto |
|---|---|---|---|
| `SET_LAYOUT` | `{ layout: LayoutId }` | `/layout` | Fija el layout |
| `SET_SOURCE` | `{ source: PhotoSource }` | modal de `/layout` | Recuerda el origen: lo necesita el "repetir" de `/review` |
| `ADD_PHOTO` | `{ photo: Photo }` | `/camera` | Añade una. **No-op si ya hay 4** |
| `SET_PHOTOS` | `{ photos: Photo[] }` | `/upload` | Reemplaza el lote. Trunca a 4 |
| `CLEAR_PHOTOS` | — | `/review` | Vacía `photos`. **Conserva `selectedLayout` y `source`** |
| `SET_BACKGROUND` | `{ background: BackgroundId \| null }` | `/decoration` | `null` = sin fondo |
| `ADD_STICKER` | `{ sticker: StickerInstance }` | `/decoration` | |
| `MOVE_STICKER` | `{ instanceId: string; x: number; y: number }` | `/decoration` | Posición absoluta, no delta |
| `REMOVE_STICKER` | `{ instanceId: string }` | `/decoration` | |
| `RESET` | — | `/final` | Vuelve a `initialState` |

**`CLEAR_PHOTOS` es la acción nueva respecto al plan de nueve.** La exige el
"repetir" de `/review`: el usuario quiere otras fotos, no otro layout ni volver a
elegir cámara o subida. `RESET` lo mandaría al principio; esto lo devuelve a
`/camera` o `/upload` según `source`, con todo lo demás intacto.

`PhotoBoothAction` es una unión discriminada por `type`. El `switch` del reducer no
lleva `default` que devuelva el estado: lleva un caso exhaustivo, para que `tsc`
avise cuando se añada una acción y alguien olvide manejarla.

## API del provider

```ts
const { state, dispatch } = usePhotoBooth();
```

Dos claves, nada más. Sin setters de conveniencia — cada uno sería una segunda forma
de mutar lo mismo. Los derivados se calculan en el consumidor: `state.photos.length === 4`.

`usePhotoBooth()` **sigue lanzando** fuera del provider. Es la decisión que ya está
en el código y se mantiene.

## Guards de ruta · nodo S3

`hooks/useRouteGuard.ts`. Requisito incumplido → `<Navigate to="/" replace />`.

| Ruta | Requiere |
|---|---|
| `/`, `/layout` | — |
| `/camera`, `/upload` | `selectedLayout !== null` |
| `/review`, `/decoration`, `/final` | `selectedLayout !== null && photos.length === 4` |

`/final` **no** exige `background` ni `stickers`: decorar es opcional, y así `/final`
es alcanzable mientras `/decoration` siga bloqueada.

El guard es un hook, no un componente envolvente: la página decide dónde llamarlo y
así no se añade una capa al árbol. Nunca redirige durante el render de otro
componente — el `Navigate` sale del `return` de la página.

## Persistencia · nodo C6

`services/storageService.ts`, `sessionStorage`, clave `cutebooth:v1`.
`sessionStorage` y no `localStorage`: una sesión de photobooth no sobrevive al cierre
de la pestaña por diseño.

1. Se persiste el estado entero, serializado tal cual.
2. `QuotaExceededError` **no es excepcional, es lo esperado** con 4 fotos: al fallar,
   reintentar sin `photos` y persistir el resto. La memoria sigue teniéndolas.
3. Al montar el provider: leer, validar la forma, y si no valida **descartar en
   silencio** y arrancar con `initialState`. Nunca confiar en la forma almacenada.
4. La versión va en la clave. Si cambia el contrato, cambia la clave: no hay
   migraciones.

## Reglas

1. **Un solo contenedor de estado.** No se crea un segundo contexto. Lo que solo le
   importa a una página (modal abierto, índice de captura) es `useState` local.
2. **`photos.length` nunca pasa de 4.** Lo garantiza el reducer, no la página.
3. **Las coordenadas de sticker son px del canvas** del layout activo. La conversión
   px-CSS ↔ px-canvas es de `useStickers` (C5) y no llega al estado.
4. **`LayoutId` se define en `constants/layouts.ts`.** `PhotoBoothContext` deja de
   exportarlo: dos definiciones del mismo tipo es una divergencia esperando su turno.
5. **Excepción de propiedad.** S1 y S2 pueden editar `pages/layoutPage/LayoutPage.tsx`
   **solo** para migrar sus llamadas (`setSelectedLayout` → `dispatch`, `cardData` →
   `LAYOUT_LIST`). Cualquier otro cambio ahí es de `ui-composer`.

## Criterio de aceptación de S1

- [ ] `types/photobooth.ts` exporta `Photo`, `StickerInstance`, `PhotoSource`,
      `PhotoBoothState`, `PhotoBoothAction`
- [ ] El reducer maneja las **10** acciones, con `switch` exhaustivo y sin `default`
- [ ] `ADD_PHOTO` con 4 fotos ya presentes no cambia el estado
- [ ] `CLEAR_PHOTOS` deja `selectedLayout` y `source` intactos
- [ ] `usePhotoBooth()` devuelve `{ state, dispatch }` y lanza fuera del provider
- [ ] `LayoutPage` funciona igual que antes y ya no importa `LayoutId` del contexto
- [ ] `npm run build` limpio

## Criterio de aceptación de S3

- [ ] Entrar en frío a `/decoration`, `/review` o `/final` redirige a `/`
- [ ] Entrar en frío a `/camera` o `/upload` redirige a `/`
- [ ] Con layout elegido, `/camera` y `/upload` se abren sin redirección
- [ ] La redirección usa `replace`: el botón atrás no crea un bucle
