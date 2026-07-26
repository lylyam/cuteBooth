# Spec · FinalPage `/final`

> Nodo **U4** · `ui-composer`. CSS en **D6**. **Reutiliza `PhotoResult` de U5** — ver
> [review.md](review.md).

## Objetivo

El usuario ve su tira decorada, se la descarga, y si no le gusta repite las fotos.

## Entra / Sale

- **Entra con** `selectedLayout !== null` y `photos.length === 4`. Si no, guard (S3) → `/`.
  **No** exige frame, fondo ni stickers: decorar es opcional.
- **Sale a** `/camera` o `/upload` con `Retake`, según `state.source`.
- **No sale** con `Download`: descargar no navega.

## Copy — DECIDIDO, no es el de Figma

El nodo `2074:52` sigue con el copy de `/review` sin actualizar. **Manda este spec:**

| Elemento | Texto |
|---|---|
| `h1` | `Here's your decorated strip!` |
| Subtítulo | `Download it, or start over to make a new one.` |
| Botón izquierdo | `Download` |
| Botón derecho | `Retake` |

Los dos botones **sí** son literales de Figma. Los dos textos son nuevos, para que el
usuario note que ha avanzado: en `/review` la tira está cruda, aquí está terminada.

⚠️ El subtítulo dice *"start over"* pero `Retake` conserva la decoración (ver abajo). Si
se prefiere `Download it, or retake your photos.`, es un cambio de una línea.

## Estado que lee / escribe

- **Lee** el estado completo — es la única pantalla que necesita los seis campos.
- **Escribe** `CLEAR_PHOTOS`, solo al pulsar `Retake`.

## Comportamiento

**`Download`** pide el blob a `useCanvas().exportAsBlob()`, crea un enlace temporal con
`download`, lo pulsa y **revoca el object URL**. Nombre de fichero:
`cutebooth-<layout>.png`. El PNG sale al tamaño de `layouts.ts` ya escalado
(`651×1911` para `classic`, `1404×1257` para `wide` y `spotlight`), con frame, fondo y
pegatinas incluidos.

**`Retake`** dispara `CLEAR_PHOTOS` y navega al origen. Conserva layout, frame set, fondo
y stickers: el usuario quería otras cuatro fotos, no volver a decorar. Es la misma
semántica que el `Retake photos` de `/review`, y por eso comparten acción.

## Dependencias

- **Hooks:** `useCanvas` (C4) — `draw(state)` y `exportAsBlob()`.
- **Componentes:** `PhotoResult` (U5). Esta página **no** lo modifica: le pasa otro copy
  y otras acciones.
- **CSS:** `FinalPage.module.css` (D6), que reutiliza el bloque de resultado de D7.
- **Guard:** `useRouteGuard` (S3).

## Criterio de aceptación

- [ ] Se ve la tira **con la decoración aplicada**, no la cruda
- [ ] `Download` baja un PNG al tamaño de `layouts.ts`, no al tamaño en pantalla
- [ ] El PNG incluye recorte de frame, fondo y pegatinas en su sitio
- [ ] Descargar dos veces seguidas funciona y no fuga object URLs
- [ ] `Retake` vuelve al origen correcto según `source` y **mantiene** la decoración
- [ ] `PhotoResult` se reutiliza sin cambiarlo: solo cambian props
- [ ] Entrar en frío redirige a `/`
- [ ] `npm run build` y `npm run lint` limpios

## Fuera de alcance

Compartir en redes. Guardar en servidor — no hay backend. Imprimir. Elegir formato o
calidad. Volver a `/decoration` a retocar. Galería de tiras anteriores.

## Supuestos — no están en el diseño

1. **Nombre de fichero** `cutebooth-<layout>.png`, sin fecha. Descargar dos veces deja
   que el navegador añada `(1)`, que es el comportamiento que la gente espera.
2. **Sin diálogo de confirmación en `Retake`.** Se pierden 4 fotos, pero la decoración se
   conserva y el camino de vuelta es corto.

## Nodo Figma

`2074:52` — https://www.figma.com/design/df7hAve66qYTKiNz0UXE1E/cuteBooth--Copy-?node-id=2074-52

Estructuralmente idéntico a `91:1346` (`/review`): mismos textos, mismo bloque de 4
huecos; solo cambian los anchos de los botones (98/81 frente a 140/150). De ahí que
`PhotoResult` sea uno y no dos.
