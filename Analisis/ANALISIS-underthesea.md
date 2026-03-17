# Análisis Profundo: Underwater Photobooth Web App

> **Autor del análisis:** GitHub Copilot (Claude Sonnet 4.6)  
> **Fecha:** Febrero 2026  
> **Objetivo:** Entender el proyecto profundamente para poder rehacerlo desde cero.

## Índice

1. [Visión Global del Proyecto](#1-visión-global-del-proyecto)
2. [Estructura de Carpetas y Archivos](#2-estructura-de-carpetas-y-archivos)
3. [Análisis Detallado por Módulos](#3-análisis-detallado-por-módulos)
4. [Flujo de Ejecución Paso a Paso](#4-flujo-de-ejecución-paso-a-paso)
5. [Conceptos Clave que Debes Entender](#5-conceptos-clave-que-debes-entender)
6. [Plan para Rehacerlo desde Cero](#6-plan-para-rehacerlo-desde-cero)
7. [Conceptos Desmenuzados al Nivel Básico](#7-conceptos-desmenuzados-al-nivel-básico)
8. [Modo Mentor — Preguntas Estratégicas](#8-modo-mentor--preguntas-estratégicas)

---

## 1. Visión Global del Proyecto

### ¿Qué hace este proyecto?

Es una **app de fotomatón temática submarina** que funciona completamente en el navegador. El usuario puede:

1. Entrar a la página de inicio animada.
2. Elegir entre tomar fotos con su cámara web o subir imágenes desde su dispositivo.
3. Tomar/subir **2 fotos** que se combinan en un "photo strip" vertical (como los fotomatones clásicos de los años 90).
4. Decorar ese strip con stickers arrastrables (peces, pulpos, algas, burbujas).
5. Descargar el resultado como imagen PNG.

### ¿Qué problema resuelve?

Simula la experiencia de un **fotomatón físico** pero en el navegador, sin necesidad de instalar apps, sin servidores, sin base de datos. Todo ocurre localmente en tu dispositivo.

### ¿Qué arquitectura usa?

Usa una arquitectura **Multi-Page Application (MPA) modular por página**. No es MVC, no es React, no es ningún framework. Es **Vanilla JS clásico con separación de responsabilidades por archivo**.

> **Analogía:** Piénsalo como un libro de recetas físico donde cada hoja es una "pantalla". Cuando terminas una tarea en una hoja, la doblas y pasas a la siguiente. No hay un "cerebro central" que coordine todo — cada página sabe lo que tiene que hacer por sí misma.

### ¿Cómo fluye la información?

El único mecanismo de comunicación entre páginas es `localStorage` del navegador. Es como una **pizarra compartida** en el cuarto de trabajo: `camera.js` escribe en ella, `final.js` la lee.

### Diagrama conceptual del flujo de datos

```
[Usuario abre index.html]
        │
        ▼
  home.js anima el UI
        │
  Click "Select"
        │
        ▼
  [menu.html]
  home.js maneja navegación
        │
        ├──── Click "Take Photos" ──────────────────────────────┐
        │                                                        │
        │                                                  [camera.html]
        │                                                  camera.js + bubbles.js
        │                                                  └─ getUserMedia (cámara)
        │                                                  └─ Canvas 2D API
        │                                                  └─ Dibuja 2 fotos en canvas
        │                                                  └─ Guarda en localStorage
        │                                                  └─ Navega a final.html
        │
        └──── Click "Upload Photos" ─────────────────────────────┐
                                                                  │
                                                           [upload.html]
                                                           upload.js + bubbles.js
                                                           └─ FileReader / input file
                                                           └─ Canvas 2D API
                                                           └─ Dibuja 2 fotos en canvas
                                                           └─ Guarda en localStorage
                                                           └─ Navega a final.html
                                                                  │
                                               ┌──────────────────┘
                                               ▼
                                         [final.html]
                                         final.js
                                         └─ Lee localStorage (Data URL del strip)
                                         └─ Dibuja en Canvas
                                         └─ Sistema de stickers (drag & drop)
                                         └─ Descarga como PNG
```

**El dato que viaja entre páginas:** un `dataURL` — una cadena de texto gigante que representa la imagen completa codificada en Base64. Es como adjuntar la foto directamente como texto en una nota.

---

## 2. Estructura de Carpetas y Archivos

```
photobooth-webapp/
│
├── index.html        ← Página de inicio
├── menu.html         ← Menú de selección
├── camera.html       ← Captura con cámara
├── upload.html       ← Subida de imágenes
├── final.html        ← Decoración y descarga
│
├── Javascripts/      ← Lógica de cada página
│   ├── home.js       ← Lógica de index.html y menu.html
│   ├── camera.js     ← Lógica de camera.html
│   ├── upload.js     ← Lógica de upload.html
│   ├── final.js      ← Lógica de final.html
│   └── bubbles.js    ← Módulo auxiliar compartido (animación de burbujas)
│
├── StyleSheets/      ← Estilos de cada página
│   ├── home.css      ← Estilos de index.html y menu.html
│   ├── camera.css    ← Estilos de camera.html y upload.html
│   └── final.css     ← Estilos de final.html
│
└── Assets/           ← Recursos estáticos (imágenes)
    └── fish-photobooth/
        ├── logo-new.png, favicon.png
        ├── camerapage/   ← Frame y burbujas animadas
        ├── finalpage/    ← Iconos de los botones de sticker
        ├── homepage/     ← Animaciones de la pantalla de inicio
        └── menupage/     ← Header decorativo del menú
```

### Árbol completo de Assets

```
Assets/
└── fish-photobooth/
    ├── favicon.png
    ├── logo-new.png
    │
    ├── camerapage/
    │   ├── frame.png                        ← marco decorativo sobre el strip
    │   ├── bubbles/
    │   │   ├── bubble1.png ... bubble5.png
    │   └── stickers/
    │       ├── fish.png, octopus.png, axolotl.png
    │       ├── seaweed1.png, seaweed2.png
    │       ├── bubble1.png, bubble2.png
    │       └── shell.png                    ← existe pero NO se usa en el código
    │
    ├── finalpage/
    │   ├── fishButton.png, octopusButton.png
    │   ├── seaweedButton.png, axolotlButton.png
    │   ├── bubbleButton.png, resetButton.png
    │
    ├── homepage/
    │   ├── goldfish.png
    │   ├── photostrip-straight.png
    │   ├── animated-bubbles-home/
    │   │   ├── bubble-1.png, bubble-2.png, bubble-3.png
    │   └── animated-photobooth-mock/
    │       └── 1.jpg ... 16.jpg             ← 16 frames de animación ping-pong
    │
    └── menupage/
        └── Header.png
```

### Tabla de relaciones entre archivos

| Página HTML | CSS usado | JS principal | JS auxiliar | ¿Es núcleo? |
|---|---|---|---|---|
| `index.html` | `home.css` | `home.js` | — | Auxiliar |
| `menu.html` | `home.css` | `home.js` | — | Auxiliar |
| `camera.html` | `camera.css` | `camera.js` | `bubbles.js` | **Núcleo** |
| `upload.html` | `camera.css` | `upload.js` | `bubbles.js` | **Núcleo** |
| `final.html` | `final.css` | `final.js` | — | **Núcleo** |

**Patrón detectado:** Hay una correspondencia 1-a-1 entre páginas HTML, archivos JS y archivos CSS. Cada "pantalla" tiene su propio JS y su propio CSS. Esto se llama **separación de responsabilidades por vista**.

---

## 3. Análisis Detallado por Módulos

### 📄 `home.js` — El animador de la portada

**¿Qué hace?** Controla todas las animaciones decorativas de `index.html` (peces, burbujas, photobooth animado, photostrip) y gestiona la navegación entre páginas. También se reutiliza en `menu.html` para los botones de navegación.

#### Funciones internas

| Función | Propósito | Analogía |
|---|---|---|
| `animateBubbles()` | Cicla 3 frames de burbuja en loop | Como un GIF manual: cambia la imagen cada X ms |
| `startBubbleAnimation()` | Activa la animación de burbujas | Pulsa "Play" |
| `stopBubbleAnimation()` | Detiene la animación | Pulsa "Pause" |
| `animatePhotobooth(timestamp)` | Reproduce 16 frames como una película ping-pong | Como un cineasta cambiando fotogramas |
| `animateFish(index)` | Cada pez oscila alternando rotación | Como un pez nadando |
| `startFishAnimation()` | Activa la animación de los 3 peces | — |
| `stopFishAnimation()` | Detiene y resetea la rotación | — |
| `animatePhotostrip()` | El strip se balancea | Como colgado de un hilo |
| `startPhotostripAnimation()` | Activa la oscilación del strip | — |
| `stopPhotostripAnimation()` | Detiene y resetea la rotación | — |
| `addSafeNavigation(btn, url, id)` | Click listener con delay de 100ms para navegar | Permite animaciones de salida antes de cambiar de página |

#### Técnica ping-pong en `animatePhotobooth`

```javascript
// En vez de ir 1, 2, 3 ... 16, 1, 2, 3 ...  (hay un "salto" visual al volver al inicio)
// Va:          1, 2, 3 ... 16, 15, 14 ... 1, 2, 3 ...  (animación suave, ida y vuelta)
```

#### ¿Por qué usa `timestamp` en `requestAnimationFrame`?

`requestAnimationFrame` llama a la función ~60 veces por segundo, pero queremos cambiar la imagen solo cada 200ms. Si no usamos `timestamp`, la animación iría a 60fps (demasiado rápida).

```javascript
function animatePhotobooth(timestamp) {
  if (timestamp - lastTime >= PHOTOBOOTH_FRAME_INTERVAL) { // Solo avanza si pasaron 200ms
    currentFrame = nextFrame;
    lastTime = timestamp;
  }
  requestAnimationFrame(animatePhotobooth); // Pide el siguiente frame
}
```

#### Posibles mejoras

- Usar CSS animations puras para los peces (más eficiente, sin JS).
- Usar un sprite sheet en vez de 16 JPEGs separados (menos peticiones HTTP).
- Separar `home.js` en `index.js` y `menu.js` para no cargar código innecesario.

---

### 📄 `camera.js` — El corazón del fotomatón

**¿Qué hace?** Accede a la cámara del dispositivo, muestra un preview en vivo, hace una cuenta regresiva de 3 segundos, captura 2 fotos y las compone en un canvas vertical de `1176×1470` px.

#### Constantes clave

```javascript
const WIDTH = 1176;   // Ancho total del photo strip
const HEIGHT = 1470;  // Alto total del photo strip
const HALF = HEIGHT / 2; // 735 — punto medio donde se divide foto 1 y foto 2
```

#### Funciones internas

| Función | Propósito |
|---|---|
| `moveVideoToHalf(i)` | Mueve el `<video>` a la mitad superior o inferior del contenedor |
| `startCountdown(callback)` | Muestra countdown de 3s y llama al callback al finalizar |
| `capturePhoto()` | Captura el frame del video, lo dibuja en canvas (con flip horizontal), avanza el stage |
| `finalizePhotoStrip()` | Dibuja frame.png encima del canvas, guarda en `localStorage` y navega a `final.html` |
| `downloadPhoto()` | Descarga el canvas como PNG |
| `setupCamera()` | Inicia `getUserMedia` con resolución ideal 2560×1440 |
| `setupEventListeners()` | Registra eventos de botones y resize |
| `initPhotoBooth()` | Punto de entrada: llama a `setupCamera` y `setupEventListeners` |

#### Flujo interno

```
setupCamera()
  └─ navigator.mediaDevices.getUserMedia({ video: { width: 2560, height: 1440 } })
       └─ stream → video.srcObject = stream
       └─ el preview de video aparece en pantalla

[Click "Capture"] → photoStage === 0
  └─ startCountdown(3)
       └─ 3... 2... 1...
       └─ capturePhoto()
            └─ Dibuja en la parte SUPERIOR del canvas (y: 0 a 735)
            └─ photoStage++ → ahora es 1

[Click "Capture"] → photoStage === 1
  └─ startCountdown(3)
       └─ capturePhoto()
            └─ Dibuja en la parte INFERIOR del canvas (y: 735 a 1470)
            └─ photoStage++ → ahora es 2
            └─ finalizePhotoStrip()

finalizePhotoStrip()
  └─ ctx.drawImage(frame.png) → marco encima de todo
  └─ canvas.toDataURL() → string base64 de la imagen
  └─ localStorage.setItem('photoStrip', dataURL)
  └─ window.location.href = 'final.html'
```

#### El flip horizontal explicado

```javascript
ctx.save();
ctx.scale(-1, 1);           // Invierte el eje X (espejo horizontal)
ctx.drawImage(video, -WIDTH, yOffset, WIDTH, HALF); // Dibuja en negativo
ctx.restore();              // Restaura la transformación al estado anterior
```

**¿Por qué?** Sin esto, el texto que aparezca en segundo plano se vería al revés. Además, el usuario espera verse como en un espejo: si levanta la mano derecha, la imagen debe mostrarla a la derecha.

#### La máquina de estados `photoStage`

```
photoStage = 0  →  [Click] → Foto 1 capturada → photoStage = 1
photoStage = 1  →  [Click] → Foto 2 capturada → photoStage = 2 → finalizePhotoStrip()
```

**¿Qué pasaría si el usuario hace click 3 veces?**  
Con el código actual, el botón se deshabilita tras la segunda captura o se muestra el botón "Ready", por lo que la tercera pulsación no tiene efecto. Si no hubiera ese control, se dibujaría encima de la segunda foto.

---

### 📄 `upload.js` — El gemelo de `camera.js`

**¿Qué hace?** Exactamente lo mismo que `camera.js` pero en vez de capturar desde cámara, el usuario elige archivos con `<input type="file">`.

#### Diferencia clave con `camera.js`

```javascript
// camera.js captura desde el stream de video:
ctx.drawImage(videoElement, 0, yOffset, WIDTH, HALF);

// upload.js carga una imagen desde el sistema de archivos:
const img = new Image();
img.src = URL.createObjectURL(file);  // URL temporal para el archivo local
img.onload = () => ctx.drawImage(img, ...);
```

> **`URL.createObjectURL` explicado:** Es como crear un acceso directo temporal a un archivo de tu disco duro sin copiarlo ni cargarlo completamente en memoria. El navegador lo gestiona por ti.

#### La función `drawPhoto(img)` — el "cover" manual

Hace lo que hace `background-size: cover` en CSS, pero en Canvas. Calcula la proporción de la imagen, recorta el centro y la escala para que llene exactamente la mitad del canvas sin deformarla.

```javascript
// Ejemplo de la lógica cover:
const scaleW = targetWidth / img.width;
const scaleH = targetHeight / img.height;
const scale  = Math.max(scaleW, scaleH); // Toma el mayor para que cubra todo

const drawW = img.width  * scale;
const drawH = img.height * scale;
const offsetX = (targetWidth  - drawW) / 2; // Centra horizontalmente
const offsetY = (targetHeight - drawH) / 2; // Centra verticalmente

ctx.drawImage(img, offsetX, yOffset + offsetY, drawW, drawH);
```

---

### 📄 `final.js` — El editor de stickers

**¿Qué hace?** Carga el strip del `localStorage`, lo dibuja en un `<canvas>`, permite añadir stickers como imágenes, arrastrarlos con mouse o touch, y finalmente descargar el resultado.

#### El estado de la aplicación

```javascript
let stickers = [];            // Array de objetos { img, x, y, width, height }
let selectedSticker = null;   // El sticker que se está arrastrando ahora mismo
let dragOffset = { x: 0, y: 0 }; // Diferencia entre donde se hizo click y el extremo del sticker
```

#### Ciclo de redibujado (Render Loop)

```
[Usuario mueve el dedo/mouse]
  └─ pointerMove(e)
       └─ selectedSticker.x = nuevaX - dragOffset.x
       └─ selectedSticker.y = nuevaY - dragOffset.y
       └─ drawCanvas()
            └─ ctx.clearRect(0, 0, W, H)       // Borra TODA la pantalla
            └─ ctx.drawImage(baseImage, ...)    // Redibuja la foto base
            └─ stickers.forEach(s =>
                 ctx.drawImage(s.img, s.x, s.y, s.w, s.h)
               )                               // Redibuja TODOS los stickers
```

> **Canvas vs DOM:** Canvas funciona como una pintura — no puedes mover objetos, solo puedes **borrar todo y volver a pintar desde cero** en cada frame. Esto es muy diferente al DOM, donde sí puedes mover un `<div>` cambiando su `style.left`.

#### Funciones internas

| Función | Propósito |
|---|---|
| `drawCanvas()` | Limpia y redibuja la imagen base + todos los stickers |
| `addSticker(src)` | Crea un `Image`, la posiciona en el centro del canvas y la añade al array `stickers` |
| `getPointerPos(e)` | Normaliza coordenadas de mouse/touch a espacio del canvas |
| `pointerDown(e)` | Detecta sobre qué sticker se hizo click/tap para arrastrarlo |
| `pointerMove(e)` | Actualiza posición del sticker seleccionado durante el drag |
| `pointerUp()` | Suelta el sticker seleccionado |

#### `getPointerPos` — la normalización de coordenadas

El canvas puede estar escalado visualmente (vía CSS `width: 30vw`) pero sus píxeles internos son siempre `1176×1470`. Esta función convierte "donde hizo click el usuario en la pantalla" a "qué píxel del canvas es ese".

```javascript
function getPointerPos(e) {
  const rect = canvas.getBoundingClientRect(); // Rectángulo del canvas en pantalla
  const scaleX = canvas.width  / rect.width;  // Factor de escala X
  const scaleY = canvas.height / rect.height; // Factor de escala Y

  // Si el canvas ocupa 300px en pantalla pero tiene 1176px internos,
  // y el usuario hace click en el pixel 150 de pantalla:
  // 150 * (1176 / 300) = pixel 588 del canvas
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top)  * scaleY
  };
}
```

#### El sistema de drag & drop: cómo funciona el `dragOffset`

> **Analogía:** Imagina que tienes una calcomanía en una foto. Cuando pones el dedo sobre ella, el programa recuerda "¿a cuántos mm del borde izquierdo pusiste el dedo?". Al mover, no toma el borde de la calcomanía a tu dedo, sino que mantiene esa distancia relativa. Sin esto, el sticker "saltaría" al punto donde hiciste click.

```javascript
function pointerDown(e) {
  const pos = getPointerPos(e);
  // Buscamos el sticker que fue tocado (el último que contiene el punto, por z-index)
  for (let i = stickers.length - 1; i >= 0; i--) {
    const s = stickers[i];
    if (pos.x >= s.x && pos.x <= s.x + s.width &&
        pos.y >= s.y && pos.y <= s.y + s.height) {
      selectedSticker = s;
      dragOffset.x = pos.x - s.x; // Distancia desde el click hasta el borde izquierdo
      dragOffset.y = pos.y - s.y; // Distancia desde el click hasta el borde superior
      break;
    }
  }
}
```

---

### 📄 `bubbles.js` — El decorador de fondo

**¿Qué hace?** Cada 400ms crea una burbuja visual que flota hacia arriba girando hasta desaparecer.

```javascript
const createBubble = () => {
  const bubble = document.createElement('img');
  bubble.src = bubbleImages[Math.random() * bubbleImages.length | 0]; // imagen aleatoria
  bubble.style.left = Math.random() * 100 + '%';                      // posición X aleatoria
  bubble.style.animationDuration = (Math.random() * 3 + 2) + 's';    // velocidad aleatoria (2-5s)
  bubble.classList.add('bubble');
  bubbleContainer.appendChild(bubble);
  bubble.addEventListener('animationend', () => bubble.remove()); // Auto-limpieza
};

setInterval(createBubble, 400); // Crea una burbuja cada 400ms
```

> **¿Por qué `bubble.remove()` en `animationend`?** Sin esto, se acumularían decenas de elementos `<img>` en el DOM sin ser visibles, consumiendo memoria innecesariamente. Es como tirar los vasos usados a la basura en vez de dejarlos acumular en la mesa.

#### ⚠️ Bug existente en las rutas

```javascript
// INCORRECTO (genera 404 cuando se carga desde la raíz del proyecto):
'../Assets/fish-photobooth/camerapage/bubbles/bubble1.png'

// CORRECTO:
'Assets/fish-photobooth/camerapage/bubbles/bubble1.png'
```

---

## 4. Flujo de Ejecución Paso a Paso

### Al abrir `index.html`

1. El navegador parsea el HTML → construye el DOM.
2. Carga `home.css` → aplica estilos. Los elementos decorativos son `<div>` con `background-image`.
3. Al final del `<body>`, ejecuta `home.js`.
4. `home.js` obtiene referencias al DOM (`getElementById`, `querySelector`).
5. Llama a `requestAnimationFrame(animatePhotobooth)` → empieza el loop de animación a 60fps.
6. `startBubbleAnimation()`, `startFishAnimation()`, `startPhotostripAnimation()` → activan animaciones.
7. Registra `click` en el botón "Select" con `addSafeNavigation`.
8. La página está viva, esperando interacción.

### Click en "Select" → `menu.html`

1. `addSafeNavigation` captura el click.
2. Espera 100ms (para animaciones de salida).
3. `window.location.href = 'menu.html'`.
4. El navegador descarga e inicializa la nueva página.

### Click en "Take Photos" → `camera.html`

1. `camera.js` se carga → `initPhotoBooth()`.
2. `setupCamera()` → `getUserMedia()` → el usuario da permiso a la cámara.
3. Stream de video → `video.srcObject = stream` → preview en pantalla.
4. `bubbles.js` → `setInterval(createBubble, 400)` → burbujas decorativas.
5. Click en "Capture" → `startCountdown()` → "3" → "2" → "1" → `capturePhoto()`.
6. **Foto 1:** `ctx.drawImage(video, ...)` en la mitad superior del canvas. `photoStage = 1`.
7. Click de nuevo → `startCountdown()` → `capturePhoto()`.
8. **Foto 2:** dibuja en la mitad inferior. `photoStage = 2` → `finalizePhotoStrip()`.
9. `ctx.drawImage(frame.png)` → marco encima de todo el canvas.
10. `canvas.toDataURL('image/jpeg', 0.85)` → genera el string base64 de la imagen completa.
11. `localStorage.setItem('photoStrip', dataURL)` → guarda en el almacenamiento local.
12. `window.location.href = 'final.html'`.

### En `final.html`

1. `final.js` (módulo ES6) se carga.
2. `localStorage.getItem('photoStrip')` → obtiene el dataURL.
3. `new Image(); img.src = dataURL;` → crea objeto imagen.
4. `img.onload = drawCanvas` → cuando carga, dibuja en el canvas.
5. Click en "Add Fish" → `addSticker('Assets/.../fish.png')`.
6. Crea `Image` → en `onload` → añade al array `stickers[]` centrada → `drawCanvas()`.
7. **Drag & Drop:**
   - `pointerDown` → identifica qué sticker fue tocado → `selectedSticker` + `dragOffset`.
   - `pointerMove` → actualiza `selectedSticker.x/y` → `drawCanvas()` redibuja todo.
   - `pointerUp` → `selectedSticker = null`.
8. Click "Download" → `canvas.toBlob()` → crea link temporal → descarga automática PNG.
9. Click "Home" → `window.location.href = 'index.html'`.

---

## 5. Conceptos Clave que Debes Entender

### Conceptos de JavaScript practicados

| Concepto | Dónde aparece |
|---|---|
| **Canvas 2D API** | `camera.js`, `upload.js`, `final.js` |
| **Async/Await y Promesas** | `getUserMedia` en `camera.js` |
| **Eventos de puntero** | `final.js` — `mousedown/move/up`, `touchstart/move/end` |
| **localStorage** | Comunicación entre páginas sin servidor |
| **requestAnimationFrame** | `home.js` — loops de animación eficientes |
| **setInterval / clearInterval** | `bubbles.js`, `home.js` — temporizadores |
| **URL.createObjectURL** | `upload.js` — manejo de archivos locales |
| **ES Modules** | `final.js` cargado como `type="module"` |
| **Closures** | Las funciones internas acceden a variables del scope externo |
| **Arrays como estado** | `stickers[]` en `final.js` — lista de objetos |
| **Context save/restore** | `camera.js` — transformaciones de canvas |

### Patrones de diseño detectados

| Patrón | Dónde | Descripción |
|---|---|---|
| **Module Pattern** (implícito) | Cada archivo JS | Cada archivo es un módulo independiente |
| **Observer Pattern** (básico) | Todos los JS | `addEventListener` para reaccionar a eventos |
| **State Machine** | `camera.js` | `photoStage` controla qué foto se está tomando |
| **Render Loop** | `final.js` | Redibuja todo en cada cambio de estado (como los videojuegos) |
| **Factory Function** | `bubbles.js` | `createBubble()` crea elementos DOM bajo demanda |

### ✅ Buenas prácticas usadas

- Separación de responsabilidades (un JS por página).
- `pointer-events: none` en el frame overlay para no interferir con clics.
- Auto-limpieza de elementos DOM (`bubble.remove()` en `animationend`).
- `canvas.toBlob()` en vez de `toDataURL()` para descargar (más eficiente en memoria).
- Variables `WIDTH` y `HEIGHT` como constantes, no números mágicos dispersos.
- `window.addEventListener('DOMContentLoaded', ...)` antes de manipular el DOM.

### ⚠️ Malas prácticas y bugs existentes

| Problema | Impacto | Solución |
|---|---|---|
| Bug de rutas en `bubbles.js` (`../Assets/...`) | Las burbujas no se ven en producción | Cambiar a `Assets/...` |
| `localStorage` con dataURL gigante (puede ser >2MB) | Puede fallar en móviles (límite ~5MB) | Usar IndexedDB para imágenes |
| Sin manejo de errores si el usuario niega la cámara | La app se rompe silenciosamente | `try/catch` alrededor de `getUserMedia` |
| `final.js` marcado como `type="module"` sin usar módulos | Confuso y potencialmente problemático | Eliminar `type="module"` o usar imports reales |
| `home.js` cargado en `menu.html` con código de `index.html` | Memoria desperdiciada con animaciones innecesarias | Separar en `index.js` y `menu.js` |

### 📚 Cosas que deberías investigar más

1. **Canvas 2D API completa** — `drawImage`, `save/restore`, transformaciones (`scale`, `translate`, `rotate`).
2. **`navigator.mediaDevices.getUserMedia`** — cómo acceder a la cámara web.
3. **`requestAnimationFrame`** — por qué es mejor que `setInterval` para animaciones.
4. **`localStorage` vs `sessionStorage` vs `IndexedDB`** — cuándo usar cada uno.
5. **Coordinate spaces en Canvas** — por qué las coordenadas CSS y las del canvas son distintas.
6. **Touch events vs Pointer events** — `touchstart/mousedown` vs la API unificada `pointerdown`.
7. **Base64 y dataURLs** — qué son, cuándo usarlos, cuándo no.

---

## 6. Plan para Rehacerlo desde Cero

### Fase 1 — Esqueleto sin JS (Día 1)

```
[ ] Crear index.html con estructura básica
[ ] Crear menu.html con estructura básica
[ ] Crear camera.html con <canvas> y <video>
[ ] Crear final.html con <canvas>
[ ] Crear upload.html con <input type="file">
[ ] Añadir CSS básico de layout (sin animaciones)
[ ] Verificar que la navegación con <a href=""> funciona
```

### Fase 2 — El núcleo funcional (Día 2-3)

```
[ ] En camera.js: pedir acceso a la cámara con getUserMedia
[ ] Mostrar el stream de video en un <video>
[ ] Crear un <canvas> del tamaño correcto (1176x1470)
[ ] Capturar UNA foto y dibujarla en la MITAD del canvas
[ ] Capturar la SEGUNDA foto en la otra mitad
[ ] Guardar el canvas en localStorage como dataURL
[ ] Navegar a final.html
[ ] En final.js: leer localStorage y mostrar la imagen en un <canvas>
```

### Fase 3 — Sistema de stickers (Día 4-5)

```
[ ] Añadir UN sticker fijo centrado en el canvas (sin drag aún)
[ ] Implementar drag con mouse (mousedown, mousemove, mouseup)
[ ] Implementar drag con touch (touchstart, touchmove, touchend)
[ ] Implementar botón Reset (vaciar el array de stickers)
[ ] Añadir más botones de stickers
[ ] Implementar la descarga (canvas.toBlob → link → click)
```

### Fase 4 — Upload como alternativa (Día 6)

```
[ ] Crear upload.js reutilizando la lógica de composición de camera.js
[ ] Implementar el input file y URL.createObjectURL
[ ] Implementar el drawPhoto con lógica "cover"
```

### Fase 5 — Pulido visual (Día 7-8)

```
[ ] Añadir animación de burbujas (bubbles.js)
[ ] Añadir la pantalla de inicio animada (home.js)
[ ] Implementar el sistema de navegación con delay
[ ] Aplicar la animación ping-pong del photobooth
[ ] Responsive design con media queries
```

### Orden de construcción resumido

```
1. index.html (solo estructura)
2. menu.html (solo estructura)
3. camera.html + camera.js (mínimo funcional)
4. final.html + final.js (leer storage + mostrar imagen)
5. Stickers drag & drop en final.js
6. upload.html + upload.js
7. Animaciones decorativas (home.js, bubbles.js)
8. CSS completo y responsive
```

### ❌ Errores que probablemente cometerás como principiante

| Error | Por qué ocurre | Cómo evitarlo |
|---|---|---|
| Intentar mover stickers como si fueran `<div>` | Confundir DOM y Canvas | Recuerda: en Canvas no hay elementos, solo píxeles |
| Coordenadas del canvas vs de la pantalla | El canvas tiene 1176px internos aunque ocupe 300px en pantalla | Usa siempre `getBoundingClientRect()` + factor de escala |
| Olvidar el flip horizontal en la cámara | El texto del fondo parece invertido | `ctx.scale(-1, 1)` antes de dibujar el video |
| `getUserMedia` no funciona sin HTTPS | El navegador bloquea el acceso en HTTP | Usa `localhost` o `https://` en producción |
| `clearRect` sin `ctx.restore()` | Las transformaciones se acumulan | Siempre `ctx.save()` antes y `ctx.restore()` después de transformar |
| Dibujar la imagen antes de que cargue | `image.src = ...` es asíncrono | Todo el código que usa la imagen debe estar DENTRO del `onload` |
| Crear bubbles sin limpiarlas | Se acumulan cientos de `<img>` en el DOM | `bubble.remove()` en el evento `animationend` |

### ✅ Cómo validar que lo estás haciendo bien

- ¿Se capturan las 2 fotos y aparecen en la mitad correcta del canvas?
- ¿La imagen en `final.html` es exactamente la que se capturó?
- ¿Los stickers se arrastran sin "saltar" al punto del cursor?
- ¿El archivo descargado contiene los stickers en su posición final?
- ¿Funciona en móvil con touch events?
- ¿Qué pasa si entras directamente a `final.html` sin pasar por `camera.html`?

---

## 7. Conceptos Desmenuzados al Nivel Básico

### ¿Qué es un `dataURL`?

Normalmente una imagen se referencia por su ruta: `<img src="foto.jpg">`. Pero un `dataURL` convierte la imagen completa en un string de texto:

```
data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA...miles de caracteres...
```

> **Analogía:** En vez de darte la dirección de una casa, te dan el plano completo de la casa en un mensaje de texto. Puedes usarlo directamente como `src` de una imagen o guardarlo en `localStorage`.

```javascript
// Crear un dataURL desde un canvas:
const dataURL = canvas.toDataURL('image/jpeg', 0.85);

// Usarlo directamente:
const img = new Image();
img.src = dataURL;
```

### ¿Qué es `requestAnimationFrame`?

Es una función del navegador que dice: "Ejecuta mi función justo antes del próximo repintado de pantalla". El navegador repinta ~60 veces por segundo.

```javascript
// MAL (no sincronizado con el monitor):
setInterval(() => dibujar(), 16); // 16ms ≈ 60fps

// BIEN (sincronizado con el monitor):
function loop() {
  dibujar();
  requestAnimationFrame(loop); // Se llama a sí misma para el siguiente frame
}
requestAnimationFrame(loop);
```

**Ventajas de `requestAnimationFrame`:**
- Se pausa automáticamente si la pestaña no está visible (ahorra batería).
- Está sincronizado con el monitor del usuario.
- El navegador puede optimizar la ejecución.

### ¿Qué es `localStorage`?

Es una "libreta de notas" del navegador, por dominio. Los datos persisten aunque cierres el navegador.

```javascript
// Guardar
localStorage.setItem('miClave', 'miValor');

// Leer
const valor = localStorage.getItem('miClave'); // null si no existe

// Borrar una clave
localStorage.removeItem('miClave');

// Borrar todo
localStorage.clear();
```

**Limitaciones:**
- Solo acepta strings (no puedes guardar objetos directamente — usa `JSON.stringify`).
- Límite de ~5MB por dominio.
- Solo accesible desde el mismo dominio.

### Canvas: el lienzo persistente

```javascript
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

// Dibujar una imagen:
ctx.drawImage(img, x, y, width, height);

// Aplicar transformaciones (siempre con save/restore):
ctx.save();
ctx.scale(-1, 1); // Espejo horizontal
ctx.drawImage(img, -width, 0, width, height); // ¡Importante: x negativo!
ctx.restore();

// Borrar todo:
ctx.clearRect(0, 0, canvas.width, canvas.height);

// Exportar como imagen:
const dataURL = canvas.toDataURL('image/jpeg', 0.85); // 85% de calidad
```

### `URL.createObjectURL` vs `dataURL`

```javascript
// dataURL: convierte el archivo en un string de texto (carga todo en memoria)
const reader = new FileReader();
reader.onload = (e) => img.src = e.target.result; // e.target.result es el dataURL
reader.readAsDataURL(file);

// createObjectURL: crea un "acceso directo" al archivo (más eficiente)
const url = URL.createObjectURL(file); // 'blob:http://localhost/abc-123'
img.src = url;
// IMPORTANTE: cuando ya no lo necesites, libera la memoria:
URL.revokeObjectURL(url);
```

---

## 8. Modo Mentor — Preguntas Estratégicas

Responde estas preguntas. Si puedes responderlas sin mirar el código, estás listo para rehacerlo.

### Nivel 1 — Comprensión básica

1. ¿Por qué no se usa `<a href="menu.html">` para navegar, sino `window.location.href` con un delay?

2. ¿Qué es `photoStage` en `camera.js` y por qué necesita existir como variable fuera de la función `capturePhoto`?

3. ¿Qué pasaría si el usuario pulsa "Capture" tres veces sin que el código lo prevenga?

### Nivel 2 — Comprensión del Canvas

4. ¿Por qué `getPointerPos` necesita multiplicar por `scaleX`? ¿Qué falla si no lo haces?

5. ¿Por qué en cada `pointerMove` se llama a `drawCanvas()` completo y no solo se mueve el sticker seleccionado?

6. ¿Qué ocurre en memoria si añades 50 stickers y no implementas el botón Reset?

### Nivel 3 — Comprensión del flujo

7. ¿Qué pasaría si el usuario entra directamente a `final.html` sin pasar por `camera.html` primero?

8. ¿Por qué `bubbles.js` elimina cada burbuja con `bubble.remove()` después de la animación? ¿Qué pasaría si no lo hiciera?

9. ¿Por qué `upload.js` tiene `localStorage.removeItem('photoStrip')` al inicio, dentro de `DOMContentLoaded`?

### Respuestas (¡no leer hasta haber pensado!)

<details>
<summary>🔓 Ver respuestas</summary>

1. El delay de 100ms permite ejecutar animaciones de salida (fade out, etc.) antes de que la página desaparezca. Con `<a href="">` la navegación es inmediata.

2. `photoStage` necesita estar fuera de `capturePhoto` porque su valor debe **persistir entre llamadas** a la función. Si estuviera dentro, se resetearía a `0` en cada llamada.

3. Sin protección, se dibujaría una tercera foto encima de la segunda. El canvas no sabe que "solo debería haber 2 fotos".

4. Sin `scaleX`, los clicks en la parte derecha del canvas visible (digamos pixel 300 de pantalla) se traducirían al pixel 300 del canvas interno, cuando en realidad corresponden al pixel `300 * (1176/300) = 1176`. Los stickers aparecerían en posiciones incorrectas.

5. Canvas no tiene "capas" ni "objetos" — solo píxeles. Una vez pintado, no puedes mover solo un sticker sin redibujar todo lo demás. Es como pintar al óleo: para mover algo, tienes que repintar todo el cuadro.

6. Los objetos `Image` y sus datos permanecerían en memoria. El array `stickers[]` crecería indefinidamente. En teoría, con suficientes stickers podrías afectar el rendimiento del navegador.

7. `localStorage.getItem('photoStrip')` devolvería `null`. El código intentaría crear una imagen con `src = null`, que fallaría silenciosamente o mostraría un canvas vacío.

8. Sin `bubble.remove()`, cada burbuja quedaría en el DOM después de terminar su animación, invisible pero ocupando memoria. Con el tiempo, habrían cientos de `<img>` en el DOM.

9. Limpia el storage por si el usuario viene de una sesión anterior. Así garantiza que el flujo "upload → final" siempre parte de un estado limpio, sin datos de una sesión de cámara anterior.

</details>

---

## Resumen de Tecnologías

| Tecnología | Para qué se usa |
|---|---|
| **HTML5 semántico** | Estructura de las 5 páginas |
| **CSS3 Custom Properties** | Variables de color y tamaño |
| **CSS `aspect-ratio`** | Proporciones del canvas responsivo |
| **CSS `@keyframes`** | Animación de burbujas flotantes |
| **JavaScript ES6+** | Toda la lógica (sin frameworks) |
| **Canvas 2D API** | Composición de fotos y stickers |
| **`getUserMedia` API** | Acceso a la cámara web |
| **`localStorage`** | Comunicación entre páginas |
| **`URL.createObjectURL`** | Carga eficiente de archivos locales |
| **`requestAnimationFrame`** | Animaciones de 60fps |

---

> **🔑 Clave maestra del proyecto:** Todo gira alrededor de `<canvas>`. Es el lienzo donde todo se compone (fotos, frames, stickers). Quien entiende Canvas, entiende el 70% de este proyecto. El resto es navegación entre páginas y gestión de eventos del usuario.



```
Pagina Home, un unico boton comenzar
        │
        ▼
Pagina Elegir tu layout, 3 opciones para elegir
        │
Botones subir o take la foto
        │
        │
        ├──── Click "Take Photos" ──────────────────────────────┐
        │                                                       │
        │                                                  Camara
        │                                                  └─ Camara, conectada al navegador
        │                                                  └─ cuenta atras y foto, esto 4 veces(4 fotos)
        │                                                  └─ pasamos a la siguiente pagina, decoracion
        │
        └──── Click "Upload Photos" ─────────────────────────────┐
                                                                 │
                                                           Subir archivos
                                                           └─ Subimos desde nuestro dispositivo 4 fotos
                                                           └─ pasamos a la siguiente pagina, decoracion
                                                                  │
                                               ┌──────────────────┘
                                               ▼
                                         Decoracion, hayas elegido camara o subir archivos
                                         └─ Se muestra el layout elegido y un menu para elegir fondo del layout y decoraciones
                                         └─ el usuario puede elegir las decoraciones y ponerlas sobre su layout de imagenes
                                         └─ Hay un boton de acabar
                                               │
                                               │
                                               ▼
                                         Pagina final
                                         └─ Te muestra las imagenes final con el layout elegido con las decoraciones y fondo elegidas
                                         └─ Boton para descargar y boton para rehacer(rehacer va a home, descargar solo descarga)
                                         
```
