# Spec · UploadPage `/upload`

> Nodo **U2** · `ui-composer`. Utilidades en **C1**, CSS en **D4**.

## Objetivo

El usuario rellena los 4 huecos de su layout con fotos que ya tiene en el dispositivo.

## Entra / Sale

- **Entra con** `selectedLayout !== null` y `source === 'upload'`. Si no, el guard (S3)
  redirige a `/`.
- **Sale a** `/review` al pulsar `Continue`, que está **siempre visible y deshabilitado
  hasta que los 4 huecos tienen foto**.

## Comportamiento — decidido, no está en el wireframe

El wireframe (`91:1168`) dibuja solo la tira vacía: ni botón, ni zona de arrastre, ni
texto. Lo que va aquí es decisión de producto tomada el 2026-07-26:

1. **Cada hueco es un botón.** Clic → selector de archivos del sistema. La foto elegida
   se pinta en **ese** hueco.
2. Volver a hacer clic en un hueco lleno lo **reemplaza**. Cambiar una foto no obliga a
   repetir las otras — es la razón de elegir esto y no un input múltiple.
3. Los huecos se rellenan en **cualquier orden**. El índice del hueco es el índice del
   slot en `layouts.ts`.
4. `Continue` se habilita con los 4 huecos llenos.

**La tira a medio llenar es estado LOCAL de la página** (`(Photo | null)[4]`), no
global: `state.photos` no puede representar huecos vacíos, porque su índice *es* el
número de hueco. Al pulsar `Continue` se hace un único `SET_PHOTOS` con los 4. Un
refresco a medio llenar pierde el borrador, y está bien: los archivos locales no se
pueden rehidratar de todas formas.

## Estado que lee / escribe

- **Lee** `state.selectedLayout` (cuántos huecos y con qué proporción).
- **Escribe** `SET_PHOTOS` una sola vez, al continuar.

## Dependencias

- **Utilidades:** `imageUtils` (C1) — redimensionar al tamaño del slot de `layouts.ts`,
  convertir a JPEG data URL. La página **no** toca `FileReader` ni `canvas` a mano.
- **Componentes:** `Loading` (C7) mientras se lee y redimensiona un archivo grande.
- **CSS:** `UploadPage.module.css` (D4). **Los tres nodos de Figma no son tres estados:
  son los tres layouts.**
- **Guard:** `useRouteGuard` (S3).

## Criterio de aceptación

- [ ] La tira dibujada es la del layout elegido, con sus 4 huecos en su posición
- [ ] Clic en un hueco abre el selector; la foto aparece en ese hueco y no en otro
- [ ] Clic en un hueco lleno reemplaza solo esa foto
- [ ] `Continue` está visible y deshabilitado desde el primer render, y se habilita
      exactamente con la cuarta foto
- [ ] Un archivo que no es imagen se rechaza con mensaje y **no** ocupa el hueco
- [ ] Una foto de 12 MP no congela la pestaña: se redimensiona antes de guardarla
- [ ] Entrar en frío a `/upload` redirige a `/`
- [ ] `npm run build` y `npm run lint` limpios

## Fuera de alcance

Arrastrar y soltar. Reordenar huecos ya llenos. Recortar o encuadrar. Rotar. HEIC de
iPhone (el navegador no lo decodifica; el mensaje de tipo no soportado lo cubre).
Subir más de 4. Cámara (es `/camera`).

## Supuestos — no están en el diseño

1. **Tipos aceptados:** `image/png`, `image/jpeg`, `image/webp`. El `accept` del input y
   la validación en código dicen lo mismo.
2. **Copy inventado**, en inglés: botón `Continue`; hueco vacío `+`; error de tipo
   `That file isn't a photo. Try a PNG, JPG or WEBP.`
3. **Sin límite de tamaño explícito.** Se redimensiona siempre, así que un archivo
   enorme cuesta tiempo pero no rompe nada. Si aparece un caso real, se pone límite.

## Nodo Figma

Los tres layouts, no tres estados:

| Layout | Node ID |
|---|---|
| `classic` | `91:1168` |
| `wide` | `91:1202` |
| `spotlight` | `91:1223` |

https://www.figma.com/design/df7hAve66qYTKiNz0UXE1E/cuteBooth--Copy-?node-id=91-1168
