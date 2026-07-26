# Design cache · Final (`/final`)

> Pulled 2026-07-26, nodo D6. Fuente: `get_design_context` sobre `2074:54`
> (Frame 35 de `2074:52`). Hecho **después** de D7 — es la misma estructura,
> solo cambian botones y copy (y el copy real no es el de Figma: manda
> `specs/final.md`).

## Estructura

Estructuralmente idéntica a `91:1348` (`/review`, ver `review.md`): mismo
`Frame 42` (texto + botones) + `Frame 8` (tira rotada 7.28°, mismos números
204.556×600.27 / radius 16.576-9.423, mismo razonamiento de escala ×0.9423
sobre la geometría canónica de `layouts.md`).

Única diferencia real: los botones dicen "Download" / "Retake" (98/81 de
ancho natural, por ser textos más cortos que los de `/review`) en vez de
"Retake photos" / "Start decorating". Ninguna diferencia de layout ni de
color ni de radio.

## Consecuencia

`FinalPage.module.css` **no repite** el bloque de resultado: reutiliza
`components/result/PhotoResult.module.css` completo (clases `layout`,
`textBlock`, `heading`, `title`, `subtitle`, `actions`, `stripWrapper`,
`strip`, `stripClassic/Wide/Spotlight`, `canvas`) y solo aporta su propio
`windowContent` (mismo padding lateral 50px que `/review`, mismo motivo).

Ningún token nuevo surge de este nodo — todos ya se propusieron al hacer D7
(`--font-size-lg`, y los de borde/radio ya existentes).
