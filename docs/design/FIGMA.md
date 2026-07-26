# Mapa del fichero de Figma

> Reinventariado el 2026-07-26 **después** de que se borrara la zona en sucio.
> Los node IDs `103:5xx`–`103:2xxx` de la versión anterior de este documento
> están muertos. Estos son los buenos.

## Acceso

```
fileKey : df7hAve66qYTKiNz0UXE1E
URL     : https://www.figma.com/design/df7hAve66qYTKiNz0UXE1E/cuteBooth--Copy-
página  : 0:1 "Wireframes"  (única del documento)
cuenta  : Ines · plan student (con rate limit)
```

Los tools MCP se invocan directamente, sin `@`. El `@` sirve para referenciar
**recursos** MCP (`skill://figma/…`), que es otro mecanismo.

## Pantallas

Todas 1440×1024. Ordenadas por posición en el lienzo.

| Pantalla | Node ID | Ruta | Nodo DAG |
|---|---|---|---|
| Home | `6:52` | `/` | ✅ implementada |
| Layout | `88:1676` | `/layout` | ✅ implementada |
| Modal (sobre Layout) | `90:740` | modal de `/layout` | ✅ implementado |
| Camera | `91:954` | `/camera` | D3 → U1 |
| **Upload · classic** | `91:1168` | `/upload` | D4 → U2 · **y geometría para S2** |
| **Upload · wide** | `91:1202` | `/upload` | D4 → U2 · **y geometría para S2** |
| **Upload · spotlight** | `91:1223` | `/upload` | D4 → U2 · **y geometría para S2** |
| Loading | `91:1283` | ❌ **no es ruta, es componente** | C7 |
| **Selected pictures** | `91:1346` | `/review` | D7 → U5 |
| **Decoration · paso 1 Frames** | `102:319` | `/decoration` | D5 → U3 · **canónico** |
| Decoration (duplicado exacto) | `103:382` | — | ⚠️ borrar, ver §3 |
| **Final** | `2074:52` | `/final` | D6 → U4 |

## 1. El diseño confirma la arquitectura de componentes

Las **doce** pantallas tienen exactamente la misma envoltura:

```
Frame 38  ┬─ Frame 36  → barra superior: logo LYM + botón cerrar   → WebAppOldStyle
          └─ Frame 35  → contenido de la pantalla
Frame 4                → About Lym · Privacy Policy · A Lym's proyect → AppFooter
```

Eso es `PageShell` + `WebAppOldStyle` + `AppFooter` tal cual están en el código.
El patrón de composición no hay que inventarlo ni negociarlo: ya coincide.

`Button` aparece como **instancia de componente** en todas las pantallas
(`85:1295`, `90:641`, `91:1119`, `102:609`…). Es el mejor candidato de Code
Connect (nodo D2) y el más rentable.

## 2. `Selected pictures` y `Final` son la misma pantalla

`91:1346` y `2074:52` son estructuralmente idénticas: mismos textos
("Here's your photo strip!", "Happy with it or want to try again?"), mismo
`Frame 8` con 4 huecos, misma disposición. Solo cambian los anchos de los dos
botones (140/150 frente a 98/81).

**Consecuencia de arquitectura:** un único componente `PhotoResult` sirve a las
dos páginas, parametrizado por copy y por acciones. No son dos trabajos.

⚠️ El copy de `2074:52` en Figma **sigue sin actualizar**: repite el de la pantalla
de revisión. El texto real de `/final` está decidido y **manda
[../../specs/final.md](../../specs/final.md)**, no Figma. Los botones sí son buenos:
`Download` y `Retake`.

Copy verificado por captura el 2026-07-26:

| Pantalla | `h1` | Subtítulo | Botones |
|---|---|---|---|
| `/review` `91:1346` | `Here's your photo strip!` | `Happy with it or want to try again?` | `Retake photos` · `Start decorating` |
| `/final` `2074:52` | *(desactualizado)* | *(desactualizado)* | `Download` · `Retake` |
| `/camera` `91:954` | — | — | `Start taking photos!!` |
| `/decoration` `102:319` | — | panel `Frames` | `← Previous step` · `Next step →` |
| `/upload` `91:1168` | — | — | **ninguno dibujado** |

## 3. Decoration: resuelto el 2026-07-26

El frame **existía sin nombrar**, y por eso el inventario anterior no lo encontraba.
Hoy `102:319` se llama **"Decorarion"** (con typo) y `103:382`, **"Decoration 2"**.

Los dos son **estructuralmente idénticos** — mismo panel, mismas 8 formas, mismo
preview, mismos botones. `103:382` es un duplicado: **el canónico es `102:319`**, y
borrar el otro evita que alguien lo tome por un segundo estado.

```
Frame 45 (943×543)
├─ Frame 29 (425×543)  panel: texto "Frames" + rejilla de 2 columnas con scroll
│                      8 formas de 172×121 (rounded-rect, Ellipse, Subtract, Union…)
└─ Frame 7  (217×637)  preview de la tira classic, 4 huecos
Frame 44 (1192×34)     [← Previous step]  ·········  [Next step →]
```

**No es una pantalla, es el paso 1 de tres.** `/decoration` es una sola ruta con
pasos internos: Frames → Backgrounds → Icons. Los pasos 2 y 3 **no están dibujados**
y se construyen con esta plantilla. Alcance y copy en
[../../specs/decoration.md](../../specs/decoration.md).

**El arte no hay que bajarlo de aquí.** Se subió al repo el 2026-07-26:
`src/assets/{frames,backgrounds,icons}`, 343 ficheros. Ver
[../contracts/assets.md](../contracts/assets.md). Es la razón por la que
`asset-pipeline` se queda sin herramientas de Figma.

## 4. Geometría de los layouts — fuente canónica

Las tres pantallas Upload no son tres estados: son **los tres layouts**. Es la
mejor fuente de geometría del fichero. Valores en px de wireframe, relativos al
frame contenedor. Detalle y reglas en [../contracts/layouts.md](../contracts/layouts.md).

⚠️ El ratio de Figma (468/419 = **1.12**) no coincide con el de los SVG de
`assets/draws/` (**1.33**). Los SVG son **iconos** de la tarjeta de selección;
para el canvas de salida manda Figma.

⚠️ `Selected pictures` (`92:42`) dibuja el strip classic con otros números
(278.99×621.36, huecos 175.2×133.6). Hay incoherencia entre pantallas. **Canónico:
las pantallas Upload.**

## 5. No hay variables de Figma

`get_variable_defs` → `{}`. El fichero es de **wireframes**, sin tokens.

**El código es la fuente de verdad de los tokens.** Las 21 custom properties de
`index.css` son el design system real. `figma-design-sync` mapea valores crudos
contra ellas y *propone* tokens nuevos solo cuando ninguno encaja — nunca los crea
en silencio.

Corolario: el CSS que salga de aquí es **estructura, no acabado**.
`booth-reviewer` no puede exigir fidelidad de píxel contra un wireframe, y menos
fuera de los 1440 px de ancho de los artboards. No hay diseño móvil: el responsive
es decisión del código (`clamp()`, `100dvh`), no del diseño.

## 6. Reglas de uso (obligatorias para `figma-design-sync`)

1. **Nunca** `get_metadata` sobre `0:1`. Usa los IDs de la tabla.
2. `get_metadata` del frame concreto **antes** de `get_design_context`.
3. Skill `figma-design-to-code` **obligatoria** antes de cada `get_design_context`.
4. Una sola sesión en lote para D3-D7. Ver [../orchestration/DAG.md](../orchestration/DAG.md) §6.
5. Cachear cada spec en `docs/design/<pantalla>.md` para que nadie la repida.
6. Valores crudos → tokens existentes de `index.css`.
