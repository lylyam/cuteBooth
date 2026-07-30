# Relevo de orquestación

> Escrito el **2026-07-29** por el orquestador saliente, al quedarse sin contexto.
> Esto es lo que **no está en ningún otro documento**: lo que aprendí trabajando, las
> decisiones que tomé yo y podrías revertir, y los errores que cometí.

## Qué es este documento, y qué no

| Documento      | Responde a                                     |
| -------------- | ---------------------------------------------- |
| `KICKOFF.md`   | ¿Qué es el proyecto y en qué estado está?      |
| `LECCIONES.md` | ¿Qué trampas técnicas ya costaron tiempo?      |
| **este**       | **¿Qué sabía el orquestador que no escribió?** |

Lo de aquí caduca. Cuando lo hayas leído y las decisiones sean tuyas, **este documento
deja de valer**: reescríbelo para el siguiente o bórralo. No lo dejes envejecer como
verdad.

## 1. Estado exacto al cerrar, verificado

- **59 commits.** Árbol limpio, `npm run build` verde.
- **`npm run lint` da 1 error**, el de `react-refresh` en `PhotoBoothContext.tsx`. Es
  preexistente (deuda **D8**), no lo arregles de paso.
- **25 commits llevan el trailer `Co-Authored-By`**, todos anteriores a que la propietaria
  lo prohibiera. Ninguno posterior. **No los limpié**: quitarlo obliga a reescribir el
  historial y cambia todos los hashes. Se lo ofrecí y no lo pidió — está ahí si algún día
  lo quiere.
- **Dejo un dev server vivo en `localhost:5173`.** Ella lo usa para mirar. Chrome cerrado.
- El scratchpad tiene capturas y arneses que **van a desaparecer**. Lo que valía la pena
  conservar está en §5.

## 2. Cómo trabaja la propietaria

Esto es lo más útil que te puedo pasar, y lo único que no puedes deducir del repo.

**Revisa mirando, y acierta.** Cada problema visual que ha reportado era real y estaba bien
diagnosticado: el marco que no cuadraba entre pantallas, la tira que debía ir a la derecha,
el trazo «con picos». En el último incluso señaló la causa correcta —la diagonal— cuando yo
había dado el tema por cerrado. **Si dice que algo se ve mal, se ve mal.**

**Necesita ver.** Estuvo una sesión entera sin poder abrir nada porque no había `.tsx`, y
lo dijo con razón: «no consigo ver nada de la página». Prioriza que haya algo mirable, y
**mándale capturas siempre**. Es su forma de revisar.

**Corta la palabrería.** Le saqué una duda sobre la forma de un objeto de acción y me
respondió «¿qué dices de un payload? Estás yéndote por las ramas». Tenía razón: era ruido.
Antes de preguntarle algo, comprueba que la respuesta **cambia lo que vas a hacer**.

**Pregunta cuando no entiende, en vez de asentir.** «¿Qué diferencias hay si el copy es del
hook o de la página? No entiendo». Explícale en concreto y sin jerga, y decidirá rápido y
bien.

**Delega decisiones técnicas cuando se lo ganas.** «Confío en ti con respecto al tamaño» y
«decide tú cuál es la mejor opción de las dos». Cuando lo haga, **decide y justifica**, no
le devuelvas la pregunta.

**Idioma:** habla en español, y el producto va **todo en inglés**, incluidos los `alt`.

## 3. Decisiones que tomé yo, y podrías revertir

Ninguna la pidió ella. Si alguna te parece mal, cámbiala — pero sabiendo el porqué.

| Decisión                                                           | Motivo                                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **X1 a `canvas-media`** en vez de crear `asset-pipeline`           | El agente no existía y quien consume los manifiestos es quien dibuja. Acertó: el nodo resultó ser ~30 líneas  |
| **Crear `ui-composer`**                                            | Era el único cuello entre «funciona por debajo» y «se abre en el navegador»                                   |
| **El copy de errores es de la página** (A6)                        | Ella me lo delegó. El copy vive donde ella lo lee y lo cambia, y 7 de los 8 mensajes del hook eran inventados |
| **El marco por defecto va en la capa de dibujo**, no en el reducer | El reducer no puede mantener la invariante: un id degradado volvería a `null` al dibujar                      |
| **Dar de alta 3 rutas sin pasar por `R*`**                         | No hay revisor. Lo marqué 🟡 en el DAG en vez de fingir que el paso se hizo                                   |
| **No limpiar el historial** de los 25 trailers                     | Reescribirlo cambia todos los hashes. Se lo ofrecí                                                            |

## 4. Errores que cometí — para que te calibres

Los pongo porque el patrón se repite y te va a pasar.

**Reporté (o casi) bugs que eran míos, dos veces.** Una foto que no entraba en `/upload`
—era mi script, que disparaba el clic y el evento del fichero en el mismo tick— y una
proporción de canvas descuadrada —era `getBoundingClientRect` sobre un elemento rotado—.
**Antes de acusar al código, sospecha de tu instrumento.**

**Apagué su dev server dos veces** con `pkill -f "npm run dev"`, que casa con la línea de
comando que lo ejecuta. Una tercera vez el comando entero murió a mitad. Usa PIDs exactos.

**Le dije que X1 era trabajo de volumen** —«343 rutas a mano, aburrido»— y era falso:
`import.meta.glob` lo resuelve en 30 líneas. Se lo corregí antes de que decidiera con el
dato malo, pero casi la hago crear un agente que no hacía falta.

**Le saqué una decisión trivial disfrazada de importante** (la forma del objeto de acción).
Me lo señaló. Filtra.

## 5. La receta de verificación, que si no la copias se pierde

No hay tests. Esto es lo que usé para recorrer la app real y es lo que detectó los bugs de
integración. Guárdalo o reescríbelo, pero **no verifiques solo con el build**.

```js
// node script.mjs — con Vite en 5173 y Chrome headless con --remote-debugging-port=9222
const CDP = 'http://127.0.0.1:9222';
const t = await (await fetch(`${CDP}/json/new?http://localhost:5173/`, { method: 'PUT' })).json();
//                                                    ^^^^ OJO: PUT, no GET (Chrome lo rechaza)
const ws = new WebSocket(t.webSocketDebuggerUrl); // node 24 trae WebSocket nativo
await new Promise((r) => (ws.onopen = r));
let id = 0;
const waits = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (waits.has(m.id)) {
    waits.get(m.id)(m);
    waits.delete(m.id);
  }
};
const send = (me, pa = {}) => {
  const i = ++id;
  ws.send(JSON.stringify({ id: i, method: me, params: pa }));
  return new Promise((r) => waits.set(i, r));
};
const ev = async (x) =>
  (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }))
    .result?.result?.value;
await send('Page.enable');
await send('Runtime.enable');

// capturar
const r = await send('Page.captureScreenshot', {});
fs.writeFileSync('shot.png', Buffer.from(r.result.data, 'base64'));

// subir un fichero sin diálogo: clic PRIMERO, esperar, y LUEGO el change
await ev(`document.querySelector('button[aria-label*="Add photo"]').click()`);
await sleep(500); // sin esta espera, React no ha aplicado el setState
await ev(`(async()=>{ const inp=document.querySelector('input[type=file]');
  const c=document.createElement('canvas'); c.width=600; c.height=420;
  /* …pintar algo… */
  const blob=await new Promise(r=>c.toBlob(r,'image/png'));
  const dt=new DataTransfer(); dt.items.add(new File([blob],'p.png',{type:'image/png'}));
  inp.files=dt.files; inp.dispatchEvent(new Event('change',{bubbles:true})); })()`);
```

Tres cosas que me costaron tiempo y están en el código de arriba: **`PUT` y no `GET`** en
`/json/new`; **separar el clic del `change`** o React lee un estado viejo; y si montas un
arnés propio, **importa `src/index.css`** o la captura sale sin estilos y parece rota.

Para juzgar nitidez, no mires: **mide**. Muestrea el píxel más oscuro a lo largo del trazo y
mira su desviación. Un trazo bueno da desviación < 1; uno abollado, > 15.

## 6. Cómo se comporta cada agente

| Agente              | Lo que aprendí trabajando con él                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `canvas-media`      | El mejor con diferencia. Mide de verdad, se autocorrige y encuentra bugs que no le pediste. Dale problemas duros y pídele números       |
| `figma-design-sync` | **No tiene `Bash`**: no puede compilar ni ver nada. Su build lo ejecutas tú, siempre. Una vez dio uno por bueno sin poder               |
| `ui-composer`       | Nuevo, cerró C7/U2/U4/U5 bien. Tiende a resolver por su cuenta lo que debería reportar: recuérdale que reportar es una respuesta válida |
| `booth-state`       | Poco usado últimamente; su trabajo está casi todo hecho. Razona bien cuando le pides que justifique                                     |

**El registro de agentes no se recarga en caliente.** Creé `ui-composer.md` y la sesión
siguió sin verlo hasta que ella reinició. Si creas uno, avisa de que hay que reiniciar.

**Dos agentes en paralelo no se ven.** Me pasó dos veces. Si un cambio tiene mitades en
ficheros de dueños distintos, **verifica la combinación tú**, y diseña los fallos para que
sean ruidosos.

## 7. Qué haría yo ahora

**Ola siguiente: C5 + D3b.** `C5` (arrastre de pegatinas) desbloquea `/decoration`, que es
la última pantalla del camino crítico. `D3b` no depende de nada y desbloquea `/camera`.
Después **U3 + U1**, y el producto está completo. `C6` cabe en cualquier hueco.

Para `C5`, dos cosas ya investigadas que le tienes que dar:

- El factor de conversión es `LAYOUTS[layout].canvas.width / canvas.clientWidth`,
  **sin DPR**. Con `canvas.width` las pegatinas se colocan al doble de distancia en
  retina — y en el portátil de quien lo programa se ve bien. Está en `state.md` regla 3.
- **`/decoration` NO rota su preview**, así que no hay que deshacer ninguna rotación.
  Verificado. Si algún día se inclina, la fórmula está en el código de `useCanvas`.

## 8. Hilos abiertos con ella

Cuatro, y ninguno bloquea todavía:

1. **`booth-reviewer` no existe.** Cinco pantallas construidas y ninguna revisada. Es el
   único agente que no se puede reasignar sin perder su sentido: juzga código que no ha
   escrito. **Pregúntaselo pronto**, porque cada pantalla nueva agranda la deuda.
2. **A3** — sin fondo elegido, la tira se descarga con transparencia. ¿Se queda o va en
   blanco?
3. **A5** — la sesión de cámara dura 14,4 s (4 cuentas atrás de 3 s + 3 pausas de 0,8 s).
   Los dos números los eligió un agente, no salen del diseño.
4. **A6** — decidí que el copy de errores es de la página, pero **el hook todavía trae sus
   ocho mensajes por defecto**. Hay que borrarlos al construir `/camera` o habrá dos copias
   del mismo texto.

Los tres últimos están en `DAG.md` §9 con más detalle.

## 9. Lo último, y es lo que más me costó aprender

**Los agentes cierran su nodo; nadie cierra las juntas.** Los dos bugs peores de esta
sesión —`SET_SOURCE` sin despachar, y la carrera de `startTransition`— eran invisibles
desde dentro de cualquier nodo, porque cada agente probaba su pantalla sembrando el estado
a mano.

Recorrer la app entera, con clics reales, después de cada ola. Eso es tuyo y no lo puedes
delegar.
