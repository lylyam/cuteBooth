# Spec · SelectedPicturesPage `/review`

> Nodo **U5** · `ui-composer`. CSS en **D7**. **Dueña del componente `PhotoResult`**,
> que `/final` reutiliza tal cual.

## Objetivo

El usuario ve su tira montada y decide: seguir a decorar, o repetir las fotos.

## Entra / Sale

- **Entra con** `selectedLayout !== null` y `photos.length === 4`. Si no, guard (S3) → `/`.
- **Sale a** `/decoration` con `Start decorating`.
- **Sale a** `/layout` con `Retake photos`: se dispara `RESET` y el usuario vuelve a elegir
  layout y origen. La decoración se pierde siempre.

  ⚠️ **Cambiado el 2026-08-18** (decisión 12 revisada por la propietaria). Antes volvía a
  `/camera` o `/upload` según `state.source`, conservando layout y decoración. El motivo del
  cambio: `Retake` era el único camino de vuelta que ofrecía la app, y no dejaba cambiar de
  layout — para eso había que tirar del botón atrás del navegador. La decoración no puede
  sobrevivir a un cambio de layout (los ids de marco están acotados al layout, decisión 15),
  así que se descarta siempre y no solo cuando el layout cambia: es más simple de explicar.

## Copy — literal de Figma `91:1346`

| Elemento        | Texto                                 |
| --------------- | ------------------------------------- |
| `h1`            | `Here's your photo strip!`            |
| Subtítulo       | `Happy with it or want to try again?` |
| Botón izquierdo | `Retake photos`                       |
| Botón derecho   | `Start decorating`                    |

## Estado que lee / escribe

- **Lee** `state.selectedLayout` y `state.photos`. Ya **no** lee `state.source`: desde el
  cambio del 2026-08-18 el destino de `Retake photos` es fijo.
- **Escribe** `RESET`, solo al repetir.

## `PhotoResult` — el componente compartido

`components/result/PhotoResult.tsx`. Esta página lo crea y `/final` (U4) lo consume sin
tocarlo: en Figma las dos pantallas son **estructuralmente idénticas** y solo cambian
copy y botones.

```tsx
type PhotoResultProps = {
  title: string;
  subtitle: string;
  actions: ReactNode; // los botones, que cada página decide
};
```

Dentro: el bloque de texto a la izquierda y el `<canvas>` de la tira a la derecha,
dibujado con `useCanvas` (C4). **Ningún copy ni ninguna acción va hardcodeada dentro** —
si algún día divergen las dos pantallas, divergen sus props, no el componente.

## Dependencias

- **Hooks:** `useCanvas` (C4) — `draw(state)` para pintar la tira.
- **CSS:** `PhotoResult.module.css` + `ReviewPage.module.css` (D7). El del bloque de
  resultado es **compartido con D6**: reutilizar, no rehacer.
- **Guard:** `useRouteGuard` (S3).

## Criterio de aceptación

- [x] Se ven las 4 fotos en el layout elegido, en el orden en que se capturaron
- [x] La tira se ve nítida en pantalla retina (`devicePixelRatio`), no borrosa
- [x] `Retake photos` va a `/layout`, sea cual sea `state.source`. Nunca a `/`
- [x] Tras `Retake photos` el estado queda a cero: sin layout, sin fotos, sin marco, sin
      fondo y sin pegatinas
- [x] `Start decorating` va a `/decoration`
- [x] `PhotoResult` no contiene ningún literal de copy de esta pantalla
- [x] Entrar en frío redirige a `/`
- [x] `npm run build` y `npm run lint` limpios

## Fuera de alcance

Repetir **una** foto suelta: se repiten las cuatro. Descargar (es `/final`). Decorar (es
`/decoration`). Reordenar las fotos. Cambiar de layout desde aquí.

## Supuestos — no están en el diseño

1. **La inclinación de la tira es CSS del preview, no del canvas.** El wireframe la
   dibuja girada ~12°; el PNG que se exporta va recto. Un `transform: rotate()` en la
   caja del canvas, nunca una rotación dentro del bitmap.
2. **El wireframe solo dibuja `classic`.** `wide` y `spotlight` usan la misma
   composición con el canvas de su geometría.

## Nodo Figma

`91:1346` — https://www.figma.com/design/df7hAve66qYTKiNz0UXE1E/cuteBooth--Copy-?node-id=91-1346

**Nodo U5 cerrado.** Verificado el 2026-07-28. Aquí salió el bug de la carrera de `startTransition` — ver [../docs/orchestration/LECCIONES.md](../docs/orchestration/LECCIONES.md) §4.
