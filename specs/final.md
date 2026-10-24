# Spec · FinalPage `/final`

> Nodo **U4** · `ui-composer`. CSS en **D6**. **Reutiliza `PhotoResult` de U5** — ver
> [review.md](review.md).

## Objetivo

El usuario ve su tira decorada, se la descarga, vuelve a retocar la decoración, o si no le
gusta repite las fotos.

## Entra / Sale

- **Entra con** `selectedLayout !== null` y `photos.length === 4`. Si no, guard (S3) → `/`.
  **No** exige frame, fondo ni stickers: decorar es opcional.
- **Sale a** `/layout` con `Retake`: se dispara `RESET`. Misma semántica que el
  `Retake photos` de `/review` — ver ese spec para el porqué del cambio del 2026-08-18.
- **Sale a** `/decoration` con `Back to decoration`: no dispara nada, la decoración se
  conserva (añadido el 2026-10-24).
- **No sale** con `Download`: descargar no navega.

## Copy — DECIDIDO, no es el de Figma

El nodo `2074:52` sigue con el copy de `/review` sin actualizar. **Manda este spec:**

| Elemento  | Texto                                           |
| --------- | ----------------------------------------------- |
| `h1`      | `Here's your decorated strip!`                  |
| Subtítulo | `Download it, or start over to make a new one.` |
| Botón 1   | `Download`                                      |
| Botón 2   | `Back to decoration`                            |
| Botón 3   | `Retake`                                        |

`Download` y `Retake` **sí** son literales de Figma. `Back to decoration` no está en Figma:
se pidió el 2026-10-24, con ese texto. Los dos textos son nuevos, para que el
usuario note que ha avanzado: en `/review` la tira está cruda, aquí está terminada.

✅ El subtítulo dice _"start over"_ y desde el 2026-08-18 eso es **literalmente** lo que
hace `Retake`: reiniciar. El aviso que había aquí —que el copy prometía más de lo que el
botón cumplía— queda resuelto sin tocar el copy.

## Estado que lee / escribe

- **Lee** el estado completo — es la única pantalla que necesita los seis campos.
- **Escribe** `RESET`, solo al pulsar `Retake`.

## Comportamiento

**`Download`** pide el blob a `useCanvas().exportAsBlob()`, crea un enlace temporal con
`download`, lo pulsa y **revoca el object URL**. Nombre de fichero:
`cutebooth-<layout>.png`. El PNG sale al tamaño de `layouts.ts` ya escalado
(`651×1911` para `classic`, `1404×1257` para `wide` y `spotlight`), con frame, fondo y
pegatinas incluidos.

**`Retake`** dispara `RESET` y navega a `/layout`. **No conserva nada**: ni layout, ni
fotos, ni marco, ni fondo, ni pegatinas. El usuario vuelve al principio del flujo y elige
otra vez layout y origen. Es la misma semántica que el `Retake photos` de `/review`, y por
eso comparten acción.

**`Back to decoration`** navega a `/decoration` sin despachar nada. Marco, fondo y pegatinas
siguen en el estado, así que la tira se abre como estaba. El paso interno de `/decoration`
es `useState` local: se entra por el paso 1 (marcos) y se pueden recorrer de nuevo. Como
no hay `dispatch`, no aplica la carrera de `startTransition` de `Retake`.

## Dependencias

- **Hooks:** `useCanvas` (C4) — `draw(state)` y `exportAsBlob()`.
- **Componentes:** `PhotoResult` (U5). Esta página **no** lo modifica: le pasa otro copy
  y otras acciones.
- **CSS:** `FinalPage.module.css` (D6), que reutiliza el bloque de resultado de D7.
- **Guard:** `useRouteGuard` (S3).

## Criterio de aceptación

- [x] Se ve la tira **con la decoración aplicada**, no la cruda
- [x] `Download` baja un PNG al tamaño de `layouts.ts`, no al tamaño en pantalla
- [x] El PNG incluye recorte de frame, fondo y pegatinas en su sitio
- [x] Descargar dos veces seguidas funciona y no fuga object URLs
- [x] `Retake` va a `/layout` y deja el estado a cero, decoración incluida
- [ ] `Back to decoration` vuelve a `/decoration` con marco, fondo y pegatinas intactos,
      en móvil y en escritorio — falta probarlo a mano
- [x] `PhotoResult` se reutiliza sin cambiarlo: solo cambian props
- [x] Entrar en frío redirige a `/`
- [x] `npm run build` y `npm run lint` limpios

## Fuera de alcance

Compartir en redes. Guardar en servidor — no hay backend. Imprimir. Elegir formato o
calidad. Galería de tiras anteriores.

## Supuestos — no están en el diseño

1. **Nombre de fichero** `cutebooth-<layout>.png`, sin fecha. Descargar dos veces deja
   que el navegador añada `(1)`, que es el comportamiento que la gente espera.
2. ⚠️ **Sin diálogo de confirmación en `Retake`** — supuesto que el cambio del 2026-08-18
   deja cojo, y que hay que volver a decidir. Se escribió cuando `Retake` solo perdía las 4
   fotos y la decoración se conservaba, así que el camino de vuelta era corto. Ahora **se
   pierde todo de un clic**, sin aviso y sin deshacer: fotos, layout, marco, fondo y
   pegatinas. **Abierto**: o se acepta a sabiendas, o `Retake` pide confirmación con el
   `Modal` que ya existe.

## Nodo Figma

`2074:52` — https://www.figma.com/design/df7hAve66qYTKiNz0UXE1E/cuteBooth--Copy-?node-id=2074-52

Estructuralmente idéntico a `91:1346` (`/review`): mismos textos, mismo bloque de 4
huecos; solo cambian los anchos de los botones (98/81 frente a 140/150). De ahí que
`PhotoResult` sea uno y no dos.

**Nodo U4 cerrado.** Verificado el 2026-07-28. `PhotoResult` se reutilizó **sin tocarlo**, que era el criterio que decidía si U5 hizo bien su trabajo.
