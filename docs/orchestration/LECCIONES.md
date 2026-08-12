# Lecciones de operación

> Trampas que **ya costaron tiempo** en este proyecto. Ninguna se deduce leyendo el código,
> y varias se descubrieron reportando primero un bug que no existía.
> Escrito el 2026-07-29, al traspasar la orquestación. **§11 y §12 añadidas el 2026-08-11**, al
> cerrar C5 y al cablear S4: la antigua §11 pasa a ser §13.

Esto no es teoría de buenas prácticas: cada punto pasó, y se dice cuándo.

## 1. Verificar significa ejecutar y mirar

No hay runner de tests, así que `npm run build` es la única puerta automática — y solo
prueba que compila. **«Lo he verificado» tiene que significar que has ejecutado algo y has
visto el resultado.**

Los nodos que salieron bien lo hicieron porque midieron:

- **C2** rasterizó 8 composiciones a PNG y las miró. Ahí se vio que el recorte por forma
  funcionaba de verdad.
- **C3** probó la cámara con `--use-fake-device-for-media-stream` y encontró que un
  desmontaje a mitad de `getUserMedia` dejaba el stream vivo.
- **C4** inyectó latencia en las fotos y descubrió que dos `draw()` terminaban en orden
  inverso.
- **C4c** midió la desviación del trazo contra la recta **ideal** (calculada de
  `layouts.ts`), no contra una recta ajustada a los píxeles — porque un ajuste puede
  esconder el codo que buscas.

Y los que se cerraron flojos fue por dar por bueno lo no comprobado: **`figma-design-sync`
no tiene `Bash`** y una vez dio el build por válido «vía el hook `Stop`». No era suyo darlo.
Cuando un agente sin `Bash` cierra un nodo, **el build lo ejecuta el orquestador**.

## 2. Un arnés por pantalla no ve las juntas

Cada agente prueba su pantalla en un arnés aislado **sembrando el estado a mano**. Eso deja
un punto ciego enorme: las costuras entre pantallas.

Así se colaron dos bugs que solo aparecieron al recorrer la app real:

- **`SET_SOURCE` no lo despachaba nadie.** La acción existía desde S1 y el reducer la
  manejaba, pero ninguna página la disparaba. `state.source` era siempre `null`, y el
  `Retake` de `/review` caía siempre en `/upload`. No se notaba porque `/camera` no existe.
- **La carrera de `startTransition`** (§4), que solo se ve pulsando el botón.

**La integración se recorre en la app real, y es del orquestador.** Los agentes no pueden
hacerlo: cada uno solo ve su trozo.

## 3. Si montas un arnés, importa `index.css`

El agente de U5 montó `/review` en un arnés sin importar `src/index.css`. La captura salió
con **fuente serif, sin cromo de ventana y sin colores**: parecía una pantalla a medio
hacer, y estaba terminada. Casi se rehace por nada.

Sin `index.css` no hay reset, ni Fira Code, ni las 24 custom properties.

## 4. React Router v7 envuelve sus navegaciones en `startTransition`

Si una pantalla **despacha algo que invalida su propio guard** y navega en el mismo
manejador, el `dispatch` —al no ir en transición— tiene más prioridad. React renderiza un
commit intermedio donde el guard ya no se cumple, el `<Navigate to="/">` de la propia
página se dispara, y **gana la carrera** contra la navegación pendiente.

Síntoma real: `Retake photos` en `/review` acababa en `/` en vez de `/camera`, **el 100 % de
las veces**. Arreglo: dispatch y navigate en el **mismo** `startTransition`.

Aplica a `/review` y `/final`. **No** aplica a `/layout`, que no tiene guard — y ahí
envolverlo sería copiar el patrón sin el problema que lo motiva.

## 5. `getBoundingClientRect()` miente sobre lo rotado

La tira de `/review` y `/final` va inclinada. Con una caja real de 205×599, el rect devuelve
**279×620**: la envolvente. Dimensionar algo desde ahí aplasta el dibujo un tercio.

`useCanvas` mide con `clientWidth`/`clientHeight` precisamente por eso. **Yo mismo caí en
esto midiendo** y estuve a punto de reportar un fallo de proporción que no existía:
`203·cos 7,28° + 597·sin 7,28° = 277`, y ahí estaba la explicación.

## 6. Rotar un bitmap ya rasterizado abolla las líneas finas

El trazo del marco se veía «con picos». No era resolución —supermuestrear ×2 dio el mismo
resultado **byte a byte**— y no había propiedad CSS que lo arreglara: se probaron **ocho**
(`image-rendering` en sus tres variantes, `will-change`, `translateZ`,
`filter: blur(0)`, `contain`, `isolation`) y las ocho dieron idéntico.

La causa era **dónde** ocurría el giro: el canvas dibujaba recto y el CSS rotaba el bitmap
terminado. Rotando **dentro** del canvas, el pico del trazo pasó de 69 ± 18,5 a 33 ± 0,5.

Y un detalle que engaña al medir: **el contorno exterior sale limpio** aunque el interior
esté abollado, porque está pegado al borde del bitmap, donde el compositor clampa y le
regala tinta por fuera. Mide los bordes **interiores**.

## 7. Los huecos de los marcos vienen rellenos, y hay que neutralizarlos

Los 24 SVG traen sus 4 huecos como `<path>` cerrado con `fill="#222222"` — así se
distinguen del arte, que es solo trazo. **Pintar el SVG tal cual encima tapa las cuatro
fotos con bloques oscuros.**

Y `spotlight/Frame 18` trae los huecos **duplicados**, uno de ellos como `<rect>` y no como
`<path>`: deduplicar por el atributo `d` —que es lo que decía el contrato— **lo dejaba
pasar**. Hay que deduplicar por geometría.

## 8. `pkill -f` mata tu propio shell

`pkill -f "npm run dev"` casa también con la línea de comando que lo ejecuta. **Apagué el
servidor de la propietaria dos veces** de esta forma, y una tercera vez el comando entero
murió a mitad (código 144).

Usa PIDs exactos, o patrones que no puedan casar con tu propia invocación. Y si tienes que
levantar un Vite o un Chrome, **usa puertos distintos** de los que esté usando otro agente:
5199 y 9223 funcionan cuando 5173 y 9222 están ocupados.

## 9. Dos agentes en paralelo no ven lo que hace el otro

Pasó dos veces en la misma sesión:

- `canvas-media` puso el marco por defecto mientras `figma-design-sync` tocaba el CSS.
  Resultado: **dos bordes concéntricos**, porque el CSS tenía un anillo que compensaba la
  ausencia de marco.
- El arreglo de C4c necesitaba **quitar** el `transform` del CSS y **activar** la rotación
  en el TSX. Repartido entre dos agentes, y si solo entra una mitad la tira sale a 14,56° o
  recta con letterbox.

Cuando un cambio tiene dos mitades en ficheros de dueños distintos, **el orquestador
verifica la combinación**, no cada mitad. Y conviene diseñar los fallos para que sean
ruidosos: los dos de arriba se ven al instante.

## 10. Trampas de navegador ya documentadas en el código

Están escritas donde toca, pero conviene saber que existen:

- **`img.decode()` no resuelve mientras el documento está oculto.** Una composición
  iniciada en una pestaña de fondo no termina hasta que se muestra. Impacto hoy: nulo, pero
  deja `isDrawing` colgado. Sin nodo asignado.
- **`getContext('2d', { alpha: false })` rompe el «sin fondo»**: lo convierte en negro y
  le quita la transparencia al PNG.
- **Cambiar `canvas.width` borra el lienzo**, así que un resize obliga a repintar.
- **`no-inline` en `import.meta.glob` no es decorativo**: sin él Vite incrusta en base64
  todo lo que baje de 4 kB — eran 27 ficheros dentro del JS, 12 de ellos SVG de marco.

## 11. Probar al tamaño real puede no probar nada

Descubierto en **C5** (2026-08-11), y es la trampa más fina de todas las de esta lista.

La conversión px-CSS ↔ px-canvas tiene que usar `LAYOUTS[layout].canvas.width`, nunca
`canvas.width` (§ regla 3 de `state.md`). Pero al **tamaño real del preview** de
`/decoration` —217 px en `classic`, 468 en los otros— el suelo de resolución que puso C4b
fija el bitmap en 654×1934 y 1405×1257 **con DPR 1 y con DPR 2 por igual**. Y ahí la fórmula
mala da exactamente el mismo número que la buena.

O sea: **una prueba a DPR 2 y al tamaño real pasa con el código roto.** El bug solo asoma
donde el suelo deja de morder. Forzando el preview a 900 px:

| DPR | bitmap    | factor correcto | factor ingenuo | error       |
| --- | --------- | --------------- | -------------- | ----------- |
| 1   | 1404×1257 | 1,567           | 1,567          | 0           |
| 2   | 1792×1604 | 1,567           | **2,000**      | 26 unidades |

**La lección general:** cuando dos fórmulas coinciden en tu caso de prueba, no has probado
la fórmula, has probado la coincidencia. Busca el régimen donde difieren y prueba **ahí**.

Y un aviso que dejó el mismo nodo: esta conversión vale para un preview **sin rotar**.
`/review` y `/final` rotan **dentro** del lienzo (C4c), así que el elemento no lleva
`transform`, `offsetX` no deshace nada y la caja es la envolvente. Si algún día se arrastran
pegatinas sobre una tira inclinada, hace falta el ángulo. Hoy no hay ningún consumidor así.

## 12. Un agente puede borrar tu trabajo sin commitear, y el `git checkout` es suyo

Pasó el **2026-08-11**, y es el fallo más tonto de esta lista porque se evita con un commit.

El orquestador editó `specs/camera.md` —apuntando que la propietaria acababa de aprobar los
ocho mensajes de error— y **lo dejó en el árbol sin commitear** mientras un subagente
trabajaba. El agente ejecutó `npm run format`, vio que Prettier había reformateado de más
tres ficheros que no eran suyos, e hizo lo que parecía correcto: `git checkout --` sobre los
tres para dejar limpio lo que no le tocaba.

Uno de esos tres era `specs/camera.md`. **La aprobación de la propietaria se perdió**, y solo
se recuperó porque el agente lo declaró en sus SUPUESTOS. Si no lo hubiera dicho, el spec
habría seguido diciendo «copy sin aprobar» sobre un copy ya aprobado.

Dos reglas que salen de aquí:

1. **El orquestador commitea antes de despachar.** Un árbol sucio es un árbol que otro puede
   limpiar. No hay excepción: un cambio de una línea en un documento también.
2. **Un agente que revierte ficheros ajenos debe decirlo**, y este lo dijo. Ese hábito de
   declarar es lo que convirtió una pérdida silenciosa en un descuido de dos minutos.

El caso general: **`git checkout --` es destructivo y no distingue de quién es el cambio.**
Un agente que quiera dejar limpio lo que no es suyo está, sin saberlo, apostando a que nadie
más tenía trabajo ahí.

## 13. Los contratos se corrigen cuando el código los desmiente

Ha pasado varias veces, y siempre es mejor corregir el documento que forzar el código:

- `swatch: string` era imposible — recortar un SVG exige un `viewBox`. Pasó a ser un rect.
- «Los assets se sirven desde `public/`» no se podía cumplir: a `public/` no se le puede
  hacer glob. Se usa `import.meta.glob`.
- `frame: null` significaba «sin marco»; ahora significa «sin elección» y se dibuja el
  rectangular.

**Si el código y el contrato discrepan, gana el código y el contrato se corrige** — pero se
corrige, no se deja mintiendo.
