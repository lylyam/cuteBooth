# 🗽 NYC Photobooth — Análisis Completo para Reconstruir desde Cero

> **Cómo usar este documento:** Léelo de arriba a abajo la primera vez. Después úsalo como guía mientras reconstruyes el proyecto. En cada sección encontrarás: qué hace el código, por qué está así, analogías simples, mini-ejemplos aislados y preguntas para verificar que lo entendiste.

---

## TABLA DE CONTENIDOS

1. [Visión Global del Proyecto](#1-visión-global-del-proyecto)
2. [Stack Tecnológico — Cada herramienta explicada](#2-stack-tecnológico)
3. [Estructura de Carpetas y Archivos](#3-estructura-de-carpetas-y-archivos)
4. [Análisis Detallado por Módulos](#4-análisis-detallado-por-módulos)
5. [Flujo de Ejecución Paso a Paso](#5-flujo-de-ejecución-paso-a-paso)
6. [Conceptos Clave que Debes Dominar](#6-conceptos-clave-que-debes-dominar)
7. [Plan para Reconstruirlo desde Cero](#7-plan-para-reconstruirlo-desde-cero)
8. [Errores Comunes y Cómo Evitarlos](#8-errores-comunes-y-cómo-evitarlos)
9. [Preguntas del Mentor](#9-preguntas-del-mentor)
10. [Glosario de Términos](#10-glosario-de-términos)

---

## 1. VISIÓN GLOBAL DEL PROYECTO

### ¿Qué es esto?

**NYC Photobooth** es una aplicación web que simula una cabina de fotos física, con estética urbana de Nueva York. El usuario puede:

1. Elegir cómo quiere que se compongan sus fotos (layout)
2. Sacarse 4 fotos automáticas con su webcam
3. Elegir un fondo (graffiti, metro, bodega, blanco, negro, neón)
4. Obtener una imagen final de alta resolución compuesta
5. Descargarla, compartirla por Twitter/Instagram, o escanear un QR para tenerla en el móvil

### ¿Qué problema real resuelve?

Las cabinas de fotos físicas (las que encuentras en discotecas, centros comerciales o eventos) son:
- Caras de alquilar y transportar
- Requieren hardware especializado
- No son fáciles de personalizar

Esta app reemplaza todo eso con una página web. Cualquier computadora con cámara sirve. El "hardware" es el navegador.

### ¿Qué tipo de arquitectura utiliza?

**Arquitectura Monolítica Full-Stack en un solo repositorio.**

Esto significa que el código del cliente (lo que el usuario ve) y el código del servidor (la lógica de negocio y almacenamiento) viven en la misma carpeta del proyecto.

```
MONOLÍTICA                    vs.    MICROSERVICIOS
──────────────────────────           ──────────────────────
┌──────────────────────┐             ┌──────┐  ┌──────┐
│  TODO EN UN SERVIDOR │             │API 1 │  │API 2 │
│                      │             └──────┘  └──────┘
│  ┌────────┐           │              ↑  ↑       ↑
│  │ React  │ ←→ │API│  │             ┌──────────────┐
│  └────────┘           │             │   Frontend   │
└──────────────────────┘             └──────────────┘
```

**¿Por qué monolítica para este proyecto?**
- Es más simple al principio
- No hay que configurar CORS entre servicios distintos
- Un solo deploy
- Perfecto para proyectos de una sola persona o equipo pequeño

### El flujo de información — de extremo a extremo

Piensa en este proyecto como una **fábrica de fotografías** con 5 estaciones:

```
ESTACIÓN 1          ESTACIÓN 2          ESTACIÓN 3
   App.tsx    →→→    Frame.tsx    →→→    Camera.tsx
(Pantalla inicio)  (Elige layout)   (Captura 4 fotos)
                                            ↓
ESTACIÓN 5                           ESTACIÓN 4
 Result.tsx   ←←←   Background.tsx
(Composición final)  (Elige el fondo)
     ↓
SERVIDOR (Express)
(Guarda la foto en disco)
     ↓
URL ÚNICA + QR
(El usuario la descarga desde su móvil)
```

### Diagrama de datos más detallado

```
WEBCAM (hardware del dispositivo)
  │
  │ Flujo de video en vivo (MediaStream)
  ▼
react-webcam (librería)
  │
  │ .getScreenshot() → string base64
  │ Ejemplo: "data:image/jpeg;base64,/9j/4AAQSkZJRgAB..."
  ▼
Array en memoria: selectedImages[] (4 elementos)
  │
  │ Viaja por React Router State (como una "mochila" de datos)
  ▼
Background.tsx
  │
  │ Canvas API — dibuja preview al 30% de escala
  │ Salida: URL de datos temporal para mostrar en <img>
  ▼
Result.tsx
  │
  │ Canvas API — dibuja a resolución completa (300 DPI)
  │ canvas.toDataURL('image/png') → otro string base64 (más grande)
  ▼
fetch('POST /api/photos')  ← llamada HTTP al servidor
  │
  │ Body: { imageData: "data:image/png;base64,..." }
  ▼
Express Server (src/server/main.ts)
  │
  │ 1. Genera ID único: crypto.randomBytes(8) → "a3f7b2c1d9e0f451"
  │ 2. Decodifica base64 → bytes binarios
  │ 3. Escribe archivo: public/photos/a3f7b2c1d9e0f451.png
  │ 4. Construye URL: https://tudominio.com/share/a3f7b2c1d9e0f451
  ▼
Respuesta: { photoId, shareUrl, downloadUrl }
  │
  ▼
QRCode.toDataURL(shareUrl) → imagen QR como base64
  │
  ▼
Se muestra en pantalla. Usuario escanea con el móvil.
  │
  ▼
Navegador del móvil → GET /share/a3f7b2c1d9e0f451
  │
  ▼
Express genera HTML con la imagen embebida + botón de descarga
  │
  ▼
FOTO EN EL CARRETE DEL MÓVIL ✅
```

---

## 2. STACK TECNOLÓGICO

Cada herramienta en este proyecto fue elegida por una razón. Aquí te explico qué hace cada una y por qué.

### Frontend

| Herramienta | Vers. | ¿Para qué sirve? | Analogía |
|---|---|---|---|
| **React** | 19 | Biblioteca para construir interfaces de usuario con componentes | Lego: cada pieza (componente) se puede combinar |
| **TypeScript** | 5.8 | JavaScript con tipos estáticos | El corrector de ortografía pero para código |
| **React Router** | 7 | Navegación entre "páginas" sin recargar | El GPS de la app |
| **react-webcam** | 7.2 | Acceso simplificado a la cámara del dispositivo | Un control remoto para la webcam |
| **Tailwind CSS** | 4 | Framework de CSS mediante clases utilitarias | Pintar una pared con sprays de colores predefinidos |
| **Vite** | 6 | Bundler y servidor de desarrollo ultra rápido | El horno que convierte ingredientes en pan |

### Backend

| Herramienta | Vers. | ¿Para qué sirve? | Analogía |
|---|---|---|---|
| **Express** | 5 | Framework web para Node.js — maneja peticiones HTTP | El recepcionista de un hotel |
| **vite-express** | * | Integra Vite y Express en un solo servidor | El pegamento que une frontend y backend |
| **multer** | 2 | Middleware para manejar subidas de archivos (no se usa aquí, se usa base64) | Una ventanilla de correos |
| **qrcode** | 1.5 | Genera imágenes de código QR | La máquina que imprime los códigos de barras |
| **tsx** | 4 | Ejecuta archivos TypeScript directamente en Node.js | Un traductor simultáneo |
| **nodemon** | 3 | Reinicia el servidor automáticamente al cambiar archivos | Un vigilante que toca la alarma si algo cambia |

### ¿Por qué `vite-express` es la pieza más importante del stack?

Sin `vite-express`, tendrías que:
1. Ejecutar Vite en el puerto 5173 (frontend)
2. Ejecutar Express en el puerto 3000 (backend)
3. Configurar CORS para que el frontend pueda hablar con el backend
4. En producción, compilar el frontend y configurar Express para servir los archivos

**Con `vite-express`**, todo eso desaparece:
- En desarrollo: Express delega las peticiones al servidor de Vite
- En producción: Express sirve los archivos compilados directamente

```javascript
// Así de simple es integrarlo:
import ViteExpress from "vite-express";
ViteExpress.listen(app, 3000, () => console.log("Servidor funcionando"));
// ↑ Esto hace TODO el trabajo de integración
```

---

## 3. ESTRUCTURA DE CARPETAS Y ARCHIVOS

### Árbol completo anotado

```
vite-express-project/
│
├── index.html                 ← 🔴 NÚCLEO: El esqueleto HTML. Punto de entrada.
├── package.json               ← 🔴 NÚCLEO: Dependencias y scripts del proyecto.
├── vite.config.ts             ← 🟡 IMPORTANTE: Configuración del bundler.
├── tsconfig.json              ← 🟡 IMPORTANTE: Reglas de TypeScript.
│
├── railway.json               ← ⚪ AUXILIAR: Config de deploy en Railway.
├── render.yaml                ← ⚪ AUXILIAR: Config de deploy en Render.
├── README.md                  ← ⚪ AUXILIAR: Instrucciones básicas.
├── README_DEPLOY.md           ← ⚪ AUXILIAR: Instrucciones de despliegue.
├── RENDER_DEPLOY.md           ← ⚪ AUXILIAR: Guía específica para Render.
├── SYSTEM_DESIGN.md           ← ⚪ AUXILIAR: Documentación de arquitectura.
├── FONTS_REFERENCE.md         ← ⚪ AUXILIAR: Referencia de fuentes tipográficas.
│
├── public/
│   └── vite.svg               ← Favicon por defecto (no personalizado)
│
└── src/
    │
    ├── server/
    │   └── main.ts            ← 🔴 NÚCLEO: TODO el backend en un archivo.
    │
    └── client/
        ├── main.tsx           ← 🔴 NÚCLEO: Punto de entrada de React + rutas.
        ├── App.tsx            ← 🔴 NÚCLEO: Pantalla de inicio (Landing).
        ├── App.css            ← 🟡 IMPORTANTE: Estilos globales + fuentes.
        ├── index.css          ← 🟡 IMPORTANTE: Reset CSS + estilos base.
        ├── tsconfig.json      ← ⚪ AUXILIAR: Config TypeScript solo del cliente.
        ├── vite-env.d.ts      ← ⚪ AUXILIAR: Tipos para variables de entorno Vite.
        │
        ├── assets/
        │   └── react.svg      ← ⚪ AUXILIAR: Icono de React (no se usa).
        │
        ├── font/              ← 🟡 IMPORTANTE: Todos los assets visuales del proyecto.
        │   ├── Coolvetica.otf           → Fuente principal (estética 90s)
        │   ├── Graffiti.ttf             → Fuente decorativa de graffiti
        │   ├── NetworkFreeVersion.ttf   → Fuente de pantalla de red
        │   ├── SpaceMono-Regular.ttf    → Fuente monoespaciada
        │   ├── Timegoing Regular.ttf    → Fuente vintage
        │   ├── WhoopieSunday-DEMO.otf   → Fuente Display para countdown
        │   ├── throwupz.ttf             → Fuente graffiti para títulos
        │   ├── bodega-cat.jpg           → Imagen layout especial
        │   ├── graffiti-wall.jpg        → Fondo "graffiti"
        │   ├── greenplate.png           → Decoración de plato verde
        │   ├── newyork-subway.jpg       → Fondo "subway"
        │   ├── newyorkbodega.jpg        → Fondo "bodega"
        │   ├── newyorkstreet.jpg        → Fondo pantalla de inicio
        │   ├── nycstreet.jpg            → Fondo alternativo
        │   ├── subway-wall.jpg          → Fondo alternativo subway
        │   ├── oneway.png               → Botón "START/CONTINUE" (señal calle NY)
        │   ├── stop.png                 → Botón "RETAKE" (señal de stop)
        │   └── yellowarrow.png          → Botón "START OVER" (flecha amarilla)
        │
        └── routes/
            ├── Frame.tsx      ← 🔴 NÚCLEO: Paso 1 — Selector de layout.
            ├── Camera.tsx     ← 🔴 NÚCLEO: Paso 2 — Motor de captura.
            ├── Selection.tsx  ← ⚠️ CÓDIGO MUERTO: Existe pero no se usa.
            ├── Background.tsx ← 🔴 NÚCLEO: Paso 3 — Compositor de preview.
            └── Result.tsx     ← 🔴 NÚCLEO: Paso 4 — Canvas final + API + QR.
```

### ¿Por qué los botones son imágenes de señales de tráfico?

El diseño tiene estética de **Nueva York urbana**. Las señales de tráfico (One Way, Stop, flechas amarillas) son iconos reconocibles de las calles neoyorkinas. En vez de botones HTML estándar, usan imágenes PNG de señales reales. Esto es una decisión puramente de **diseño e identidad visual**, no técnica.

### Relaciones entre archivos

```
index.html
    └── importa → src/client/main.tsx
                      ├── importa → App.tsx (ruta "/")
                      ├── importa → Frame.tsx (ruta "/frame")
                      ├── importa → Camera.tsx (ruta "/camera")
                      ├── importa → Selection.tsx (ruta "/select")
                      ├── importa → Background.tsx (ruta "/background")
                      └── importa → Result.tsx (ruta "/result")

App.tsx
    ├── importa → App.css (estilos)
    └── importa → font/newyorkstreet.jpg, font/oneway.png

index.css
    └── importa → font/Coolvetica.otf

App.css
    └── importa → font/Graffiti.ttf, Throwupz.ttf, SpaceMono.ttf, etc.

Camera.tsx
    └── navega a → /background (con selectedImages + frameLayout)

Background.tsx
    └── navega a → /result (con selectedImages + frameLayout + backgroundStyle)

Result.tsx
    └── llama HTTP POST → /api/photos (servidor)
    └── recibe → shareUrl → genera QR
```

---

## 4. ANÁLISIS DETALLADO POR MÓDULOS

---

### 📄 `index.html` — El esqueleto

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React + TS</title>
  </head>
  <body>
    <div id="root"></div>  <!-- ← React monta aquí TODA la app -->
    <script type="module" src="/src/client/main.tsx"></script> <!-- ← Punto de entrada JS -->
  </body>
</html>
```

**Lo más importante aquí:** El `<div id="root">` está vacío. React tomará ese div y lo llenará dinámicamente con todos los componentes. Sin JavaScript, la página está en blanco.

**¿Qué es `type="module"`?** Indica que el script usa ES Modules (import/export), la sintaxis moderna de JavaScript.

**Posible mejora:** Cambiar el `<title>` a algo descriptivo como "NYC Photobooth".

---

### 📄 `package.json` — El ADN del proyecto

```json
{
  "name": "vite-express-project",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev":   "nodemon -w src/server -x tsx src/server/main.ts",
    "build": "vite build",
    "start": "NODE_ENV=production tsx src/server/main.ts"
  }
}
```

**Diseccionando los scripts:**

```bash
# DEV (desarrollo local):
nodemon -w src/server -x tsx src/server/main.ts
#  │         │              │    └── Ejecuta este archivo
#  │         │              └── Con este comando
#  │         └── Observa cambios en esta carpeta
#  └── Reinicia automáticamente si hay cambios

# BUILD (compilar para producción):
vite build
# Vite compila React + TypeScript → archivos HTML/CSS/JS optimizados en /dist

# START (ejecutar en producción):
NODE_ENV=production tsx src/server/main.ts
# Activa el servidor con la variable de entorno "production"
# vite-express detecta NODE_ENV=production y sirve /dist en vez del servidor Vite
```

**`"type": "module"`:** Hace que todos los archivos .js del proyecto usen ES Modules por defecto (pueden usar `import/export` sin declararlo explícitamente).

---

### 📄 `vite.config.ts` — La fábrica configurada

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

**Extremadamente simple.** Vite necesita dos plugins:
1. `react()` — Habilita JSX y Fast Refresh (los cambios en código se ven en el navegador instantáneamente sin recargar)
2. `tailwindcss()` — Integra Tailwind CSS con Vite para procesar las clases utilitarias

**¿Qué es Vite realmente?** Un "bundler" — toma todos tus archivos TypeScript, JSX, CSS, imágenes y los empaqueta en archivos optimizados para el navegador. Es como una licuadora industrial que toma todos los ingredientes y produce un batido listo para servir.

---

### 📄 `src/server/main.ts` — El servidor completo

Este es el **único archivo backend** del proyecto. Tiene exactamente 3 responsabilidades y las hace bien.

#### Configuración inicial

```typescript
import express from "express";
import ViteExpress from "vite-express";
import { writeFile, mkdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

// En ES Modules, __dirname no existe automáticamente
// Estas dos líneas lo recrean manualmente:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

> **¿Por qué `__dirname` no existe?** En el sistema de módulos antiguo de Node.js (CommonJS), `__dirname` era una variable mágica que indicaba la carpeta del archivo actual. En ES Modules (el sistema moderno), esta "magia" fue eliminada por diseño. Ahora hay que calcularlo explícitamente.

```typescript
const app = express();
app.use(express.json({ limit: '50mb' })); // ← acepta bodies JSON de hasta 50MB
// (necesario porque las imágenes base64 son grandes)

app.use(express.static(path.join(__dirname, '../../public')));
// ← Sirve todo lo que está en /public como archivos estáticos
// Si alguien pide /photos/abc123.png, Express lo busca en el sistema de archivos
```

#### La lógica de la carpeta de fotos

```typescript
const renderDiskPath = '/opt/render/project/src/vite-express-project/public/photos';
const standardPath = path.join(__dirname, '../../public/photos');
const photosDir = existsSync(renderDiskPath) ? renderDiskPath : standardPath;

if (!existsSync(photosDir)) {
  mkdir(photosDir, { recursive: true }).catch(console.error);
}
```

**¿Por qué esta lógica?** Render.com (el servicio de hosting) usa un disco persistente montado en una ruta específica. Si el servidor corre en Render, las fotos deben guardarse ahí para persistir entre deploys. Si corre localmente, se guardan en `public/photos`.

> **Analogía:** Es como preguntar "¿estoy trabajando en casa o en la oficina?" y guardar los documentos en el lugar correcto según la respuesta.

#### `POST /api/photos` — Guardar una foto

```typescript
app.post("/api/photos", async (req, res) => {
  try {
    const { imageData, format = 'png' } = req.body;
    
    // Validación básica
    if (!imageData) return res.status(400).json({ error: 'No image data provided' });
    
    // Generar ID único criptográficamente seguro
    const photoId = crypto.randomBytes(8).toString('hex');
    // → "a3f7b2c1d9e0f451" (16 caracteres hexadecimales)
    
    // Limpiar el prefijo base64 y decodificar
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    // "data:image/png;base64,iVBORw0K..." → "iVBORw0K..."
    
    const buffer = Buffer.from(base64Data, 'base64');
    // Convierte el texto base64 en bytes binarios reales (la imagen)
    
    const extension = format === 'jpeg' ? 'jpg' : 'png';
    const filename = `${photoId}.${extension}`;
    const filepath = path.join(photosDir, filename);
    
    await writeFile(filepath, buffer);
    // Escribe los bytes en disco → ya existe el archivo
    
    const baseUrl = getBaseUrl(req);
    const shareUrl = `${baseUrl}/share/${photoId}`;
    
    res.json({ 
      photoId, 
      shareUrl,                                      // Para el QR
      downloadUrl: `${baseUrl}/api/photos/${photoId}` // Para descarga directa
    });
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});
```

**¿Qué es base64?**

```
IMAGEN NORMAL (bytes binarios):       IMAGEN EN BASE64 (texto):
FF D8 FF E0 00 10 4A 46 49 46...  →  /9j/4AAQSkZJRgABAQAAAQABAAD...
(números hexadecimales, no texto)     (texto que cualquier red puede transmitir)
```

**¿Por qué enviar base64 y no el archivo directamente?**
- Una petición `fetch` con JSON solo puede enviar texto
- Base64 convierte la imagen en texto seguro para viajar en JSON
- El lado negativo: base64 es ~33% más grande que el binario original

**Alternativa más eficiente:** `FormData` con `multipart/form-data` (que es lo que `multer` manejaría). Pero base64 es más simple de implementar.

#### `GET /api/photos/:id` — Descargar una foto

```typescript
app.get("/api/photos/:id", async (req, res) => {
  try {
    const { id } = req.params; // ← :id captura esta parte de la URL
    
    // Buscar el archivo (puede ser .png o .jpg)
    let filepath = path.join(photosDir, `${id}.png`);
    if (!existsSync(filepath)) filepath = path.join(photosDir, `${id}.jpg`);
    if (!existsSync(filepath)) return res.status(404).json({ error: 'Photo not found' });
    
    const file = await readFile(filepath);
    const extension = filepath.endsWith('.jpg') ? 'jpg' : 'png';
    
    // Headers que le dicen al navegador qué tipo de archivo es y cómo manejarlo
    res.setHeader('Content-Type', `image/${extension}`);
    res.setHeader('Content-Disposition', `attachment; filename="photobooth-${id}.${extension}"`);
    // ↑ "attachment" indica al navegador que descargue el archivo en vez de mostrarlo
    
    res.send(file);
  } catch (error) { ... }
});
```

#### `GET /share/:id` — Página de compartir para móviles

Este endpoint es el más complejo del servidor. Genera HTML completo en el servidor (renderizado del lado del servidor o SSR).

```typescript
app.get("/share/:id", async (req, res) => {
  // Leer la foto del disco
  const imageBuffer = await readFile(filepath);
  const imageBase64 = imageBuffer.toString('base64');
  const imageDataUrl = `data:image/${extension};base64,${imageBase64}`;
  
  // Devolver HTML completo con la imagen embebida
  res.send(`
    <!DOCTYPE html>
    <html>
      ...
      <img src="${imageDataUrl}" />
      <a href="${downloadUrl}" download>Download Photo</a>
      ...
      <script>
        // En iOS: intenta descarga automática después de 500ms
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS) {
          setTimeout(() => document.getElementById('downloadBtn').click(), 500);
        }
      </script>
    </html>
  `);
});
```

**¿Por qué esta página no es React?** Porque:
1. Necesita funcionar sin JavaScript de React cargado
2. Debe ser rápida para móviles (sin bundle de React)
3. Está diseñada específicamente para iOS/Android donde la descarga de archivos es difícil

**El truco de iOS:** Safari en iPhone no permite descargar archivos con `download` attribute directamente. La solución aquí es embeber la imagen como base64 en el HTML para que al "tocar largo" el usuario pueda "Guardar en Fotos".

---

### 📄 `src/client/main.tsx` — El router de la aplicación

```typescript
import "./index.css";     // ← Estilos globales aplicados ANTES de cualquier componente
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import App from "./App";
import Frame from "./routes/Frame";
// ... más imports

const router = createBrowserRouter([
  { path: "/",           element: <App /> },
  { path: "/frame",      element: <Frame /> },
  { path: "/camera",     element: <Camera /> },
  { path: "/select",     element: <Selection /> },  // ← Existe pero nunca se llega
  { path: "/background", element: <Background /> },
  { path: "/result",     element: <Result /> }
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
```

**¿Qué es `createBrowserRouter`?**

Es una función de React Router que crea un "mapa de rutas". Cuando la URL del navegador cambia, React Router busca en este mapa qué componente mostrar.

**¿Qué es `RouterProvider`?**

Es el componente que conecta ese "mapa de rutas" con la aplicación de React. Sin él, ningún componente podría usar hooks como `useNavigate` o `useLocation`.

**¿Qué es `React.StrictMode`?**

Un modo de desarrollo que detecta bugs potenciales. En desarrollo, ejecuta algunos efectos DOBLE para detectar efectos secundarios no deseados. **En producción no afecta el rendimiento.**

**¿Qué es `ReactDOM.createRoot`?**

Le dice a React: "toma el div con id 'root' del HTML y úsalo como contenedor para toda la aplicación". Desde aquí React controla todo lo que aparece en pantalla.

---

### 📄 `src/client/App.tsx` — La pantalla de inicio

```typescript
import "./App.css";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

function App() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer); // ← Función de limpieza
  }, []); // ← Array vacío = ejecutar UNA SOLA VEZ al montar
```

**El reloj en vivo — explicado línea a línea:**

```typescript
// 1. Crear estado para la hora actual
const [time, setTime] = useState(new Date());
//                                └── Valor inicial: la hora en que se cargó el componente

// 2. Al montar el componente (una sola vez):
useEffect(() => {
  
  // 3. Crear un intervalo que se ejecuta cada 1000ms (1 segundo)
  const timer = setInterval(() => {
    setTime(new Date()); // ← Actualizar el estado con la hora actual
    // ↑ Esto causa que React re-renderice el componente
    // ↑ El nuevo valor de `time` se muestra en pantalla
  }, 1000);
  
  // 4. LIMPIEZA: cuando se desmonta el componente, cancelar el intervalo
  return () => clearInterval(timer);
  
  // ¿Por qué limpiar? Si no limpias, cuando navegues a /frame y vuelvas a /,
  // habrá DOS intervalos corriendo. Luego TRES. Luego CUATRO. Fuga de memoria.

}, []); // ← Sin dependencias = solo al montar/desmontar
```

**El fondo dinámico con URL de assets:**

```typescript
backgroundImage: `url(${new URL('./font/newyorkstreet.jpg', import.meta.url).href})`
```

**¿Por qué no simplemente `backgroundImage: "url('./font/newyorkstreet.jpg')"`?**

Porque Vite necesita saber que este archivo es un asset para:
1. Incluirlo en el bundle de producción
2. Generar el hash correcto para cacheo
3. Resolverlo correctamente en cualquier entorno

`new URL('./font/newyorkstreet.jpg', import.meta.url).href` le dice a Vite: "este archivo es un asset que necesito, inclúyelo y dame su URL final".

---

### 📄 `src/client/routes/Frame.tsx` — El selector de layout

**¿Qué hace?** Muestra 3 tarjetas con los layouts disponibles. Al hacer click navega a la cámara.

```typescript
import { useNavigate } from "react-router-dom";

const navigate = useNavigate();
// navigate es una función que cambia la URL del navegador

const handleSelectFrame = (layout: string) => {
  navigate('/camera', { 
    state: { frameLayout: layout } 
    // ← Adjunta datos a la navegación
    // Es como ir a /camera pero llevando una "mochila" con datos
  });
};
```

**Los 3 layouts y lo que producen:**

| Nombre | ID | Dimensiones finales | Descripción |
|---|---|---|---|
| STRIP | `strip` | 600×1800px (2"×6" @ 300DPI) | 4 fotos apiladas verticalmente |
| GRID | `grid` | 2400×2400px (8"×8" @ 300DPI) | Cuadrícula 2×2 |
| SPECIAL | `bodega-cat` | 1800×1800px (6"×6" @ 300DPI) | 1 foto grande arriba + 3 pequeñas abajo |

**¿Por qué 300 DPI?** DPI (Dots Per Inch) es la resolución de impresión. 300 DPI es el estándar de calidad fotográfica. Una foto de 2"×6" necesita 600×1800 píxeles para verse bien impresa.

---

### 📄 `src/client/routes/Camera.tsx` — El motor de captura

Este es el componente más técnico del frontend. Vamos a diseccionarlo completamente.

#### Acceso a la webcam

```typescript
import Webcam from "react-webcam";

// En el JSX:
<Webcam
  audio={false}
  ref={webcamRef}
  screenshotFormat="image/jpeg"
  videoConstraints={{
    width: 1280,
    height: 720,
    facingMode: "user"  // "user" = cámara frontal, "environment" = trasera
  }}
/>
```

**¿Qué hace `react-webcam` internamente?**
1. Llama a `navigator.mediaDevices.getUserMedia({ video: true })`
2. El navegador pide permiso al usuario
3. Si se concede, vincula el stream de video a un elemento `<video>`
4. `getScreenshot()` captura un fotograma y lo convierte a base64

#### La referencia con `useRef`

```typescript
const webcamRef = useRef<Webcam>(null);
```

**¿Por qué `useRef` y no `useState`?**

```typescript
// Con useState — causaría re-render en cada actualización:
const [webcam, setWebcam] = useState(null); // ❌ Malo aquí

// Con useRef — no causa re-render, solo guarda la referencia:
const webcamRef = useRef(null); // ✅ Correcto para refs de DOM/componentes
```

`useRef` crea una caja (`{ current: null }`) cuyo contenido puede cambiar sin que React re-renderice el componente. Perfecto para referencias a elementos del DOM o instancias de componentes.

#### La secuencia de captura automática

```typescript
const startAutomatedCapture = async () => {
  setIsCapturing(true);
  const capturedImages: string[] = [];
  
  for (let i = 0; i < 4; i++) {
    // Cuenta regresiva: 5 → 4 → 3 → 2 → 1
    for (let count = 5; count > 0; count--) {
      setCountdown(count);
      await new Promise(resolve => setTimeout(resolve, 1000));
      // ↑ Pausa de 1 segundo (sin bloquear el hilo)
    }
    
    setCountdown(null);
    
    // Capturar el fotograma actual
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) break;
    
    capturedImages.push(imageSrc);
    setImages([...capturedImages]); // Actualiza el estado para mostrar miniatura
    
    // Flash blanco (feedback visual)
    setFlash(true);
    await new Promise(resolve => setTimeout(resolve, 200));
    setFlash(false);
    
    // Pausa para que el usuario vea la foto capturada
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  setIsCapturing(false);
  
  navigate('/background', {
    state: { selectedImages: capturedImages, frameLayout }
  });
};
```

**¿Qué es `async/await` con `setTimeout`?**

`setTimeout` es una función que ejecuta algo DESPUÉS de un delay. Pero por sí sola no puede "pausar" el código. Necesitamos convertirla en una Promise para poder usar `await`:

```typescript
// Sin await (NO pausa):
setTimeout(() => {}, 1000);
console.log("Aquí"); // Se ejecuta INMEDIATAMENTE

// Con await (SÍ pausa):
await new Promise(resolve => setTimeout(resolve, 1000));
console.log("Aquí"); // Se ejecuta DESPUÉS de 1 segundo
```

> **Analogía:** `setTimeout` es como poner una alarma. `await new Promise(resolve => setTimeout(resolve, 1000))` es como poner una alarma Y esperar a que suene antes de continuar.

#### El sonido de obturador (Web Audio API)

```typescript
const playShutterSound = () => {
  const audioCtx = new AudioContext();
  
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination); // ← Los altavoces del dispositivo
  
  oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
  // ↑ La frecuencia baja de 800Hz a 100Hz en 0.1 segundos → sonido de "clic"
  
  gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
  // ↑ El volumen baja rápidamente (fade out)
  
  oscillator.start(audioCtx.currentTime);
  oscillator.stop(audioCtx.currentTime + 0.1);
};
```

**¿Por qué Web Audio API en vez de un archivo .mp3?**
- No hay asset que cargar → más rápido
- El sonido se genera matemáticamente en tiempo real
- No hay dependencia de un archivo externo que podría fallar

> **Analogía:** Es como la diferencia entre reproducir una canción grabada (mp3) vs. tararearla tú mismo. La segunda no necesita ningún archivo.

---

### 📄 `src/client/routes/Background.tsx` — El compositor de preview

#### La arquitectura del canvas de preview

```typescript
useEffect(() => {
  const canvas = document.createElement('canvas');
  // Canvas INVISIBLE (nunca se añade al DOM)
  
  // Dimensiones al 30% de la resolución final
  if (frameLayout === 'strip') {
    canvas.width = 180;   // 600 * 0.3
    canvas.height = 540;  // 1800 * 0.3
  }
  
  const ctx = canvas.getContext('2d');
  
  // 1. Dibujar el fondo
  if (backgroundStyle === 'white') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (backgroundStyle === 'graffiti') {
    const bgImg = new Image();
    bgImg.onload = () => {
      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
      drawPhotos(); // Solo dibuja las fotos DESPUÉS de que el fondo cargó
    };
    bgImg.src = graffitiImageUrl; // URL del asset
  }
  
  // 2. Dibujar las 4 fotos según el layout
  const drawPhotos = () => {
    selectedImages.forEach((imageSrc, index) => {
      const img = new Image();
      img.onload = () => {
        // Calcular posición según el layout
        const x = calcularX(index, frameLayout, canvas.width);
        const y = calcularY(index, frameLayout, canvas.height);
        const w = calcularAncho(frameLayout, canvas.width);
        const h = calcularAlto(frameLayout, canvas.height);
        
        ctx.drawImage(img, x, y, w, h);
        
        // Si es la última foto, exportar como URL
        if (index === selectedImages.length - 1) {
          setPreviewUrl(canvas.toDataURL('image/jpeg', 0.85));
        }
      };
      img.src = imageSrc;
    });
  };
  
}, [backgroundStyle]); // ← Se re-ejecuta cada vez que cambia el fondo
```

**¿Por qué las imágenes tienen callbacks `onload`?**

Cargar una imagen es una operación **asíncrona** — lleva tiempo. Si intentas `ctx.drawImage(img, ...)` antes de que la imagen haya cargado, dibujarás un elemento vacío.

```typescript
// ❌ INCORRECTO — La imagen puede no estar cargada aún:
const img = new Image();
img.src = url;
ctx.drawImage(img, 0, 0); // Posible imagen en blanco

// ✅ CORRECTO — Esperar a que cargue:
const img = new Image();
img.onload = () => {
  ctx.drawImage(img, 0, 0); // La imagen ya está en memoria
};
img.src = url; // Esto INICIA la carga
```

> **Analogía:** Es como pedir una pizza (img.src = url) y esperar a que llegue (img.onload) antes de comerla (ctx.drawImage). No puedes comerla antes de que llegue.

#### Los 6 fondos disponibles

```typescript
type BackgroundStyle = 'graffiti' | 'subway' | 'bodega' | 'white' | 'black' | 'neon';

const backgrounds = {
  graffiti: { type: 'image', src: graffitiWallImage },
  subway:   { type: 'image', src: subwayWallImage },
  bodega:   { type: 'image', src: newyorkBodegaImage },
  white:    { type: 'solid', color: '#FFFFFF' },
  black:    { type: 'solid', color: '#000000' },
  neon: {
    type: 'gradient',
    // Gradiente de colores neón: morado → azul → verde → amarillo
    colors: ['#FF00FF', '#00FFFF', '#00FF00', '#FFFF00']
  }
};
```

---

### 📄 `src/client/routes/Result.tsx` — El componente final (799 líneas)

Este componente es el más complejo porque hace muchas cosas. Se podría dividir idealmente en varios módulos, pero funciona.

#### Fase 1: Renderizar el canvas a resolución completa

```typescript
useEffect(() => {
  const generateFinalImage = async () => {
    const canvas = document.createElement('canvas');
    
    // Resolución según el layout:
    const dimensions = {
      'strip':      { width: 600,  height: 1800 },
      'grid':       { width: 2400, height: 2400 },
      'bodega-cat': { width: 1800, height: 1800 }
    };
    
    canvas.width = dimensions[frameLayout].width;
    canvas.height = dimensions[frameLayout].height;
    
    const ctx = canvas.getContext('2d');
    
    // Dibujar fondo (igual que Background.tsx pero a resolución completa)
    await drawBackground(ctx, canvas, backgroundStyle);
    
    // Dibujar las 4 fotos
    await drawPhotos(ctx, canvas, selectedImages, frameLayout);
    
    // Si es bodega-cat: añadir el stamp
    if (frameLayout === 'bodega-cat') {
      ctx.font = 'bold 48px Arial';
      ctx.fillStyle = 'white';
      ctx.fillText('🐈 BODEGA CAT', canvas.width / 2, canvas.height - 30);
    }
    
    // Guardar referencia al canvas para después
    canvasRef.current = canvas;
    
    // Mostrar preview en pantalla (pequeño)
    setPreviewUrl(canvas.toDataURL('image/jpeg', 0.7));
    
    // Subir al servidor en segundo plano
    await uploadPhoto(canvas);
  };
  
  generateFinalImage();
}, []); // ← Solo al montar (la foto no cambia)
```

#### Fase 2: Subir al servidor

```typescript
const uploadPhoto = async (canvas: HTMLCanvasElement) => {
  setIsUploading(true);
  
  try {
    const imageData = canvas.toDataURL('image/png');
    // ↑ Exported como PNG de máxima calidad (sin compresión)
    
    const response = await fetch('/api/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData, format: 'png' })
    });
    
    const { photoId, shareUrl, downloadUrl } = await response.json();
    
    setPhotoId(photoId);
    setShareUrl(shareUrl);
    setDownloadUrl(downloadUrl);
    
    // Generar el QR
    const qrDataUrl = await QRCode.toDataURL(shareUrl, {
      width: 256,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' }
    });
    setQrCode(qrDataUrl);
    
  } catch (error) {
    console.error('Error uploading photo:', error);
    // Aquí podría mostrarse un mensaje de error al usuario
  } finally {
    setIsUploading(false);
  }
};
```

#### Fase 3: Diálogo de compartir con Progressive Enhancement

**¿Qué es Progressive Enhancement?** Una técnica donde primero ofreces la funcionalidad más básica, y luego "mejoras" con APIs más modernas si están disponibles.

```typescript
const shareOnTwitter = async () => {
  const text = "Just took a NYC photobooth photo! 📸 #NYCPhotobooth";
  
  try {
    // Intento 1: Clipboard API (copiar imagen al portapapeles)
    if (navigator.clipboard?.write) {
      const blob = await canvasToBlob(canvasRef.current);
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      // Si llegamos aquí, la imagen está en el portapapeles
    }
  } catch (e) {
    // Clipboard API falló o no está disponible
  }
  
  try {
    // Intento 2: Web Share API (menú nativo del sistema)
    if (navigator.share) {
      await navigator.share({ text, url: shareUrl });
      return; // Si funcionó, terminamos aquí
    }
  } catch (e) {
    // Web Share API falló (usuario canceló, etc.)
  }
  
  // Fallback final: descargar imagen + abrir Twitter
  downloadPhoto(); // Descarga la imagen localmente
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`);
  // El usuario tendrá que adjuntar manualmente la imagen descargada
};
```

| API | Disponibilidad | Lo que hace |
|---|---|---|
| `navigator.clipboard.write` | Chrome 76+, Firefox 87+, Safari 13.1+ (solo HTTPS) | Copia la imagen al portapapeles |
| `navigator.share` | Principalmente móviles (iOS Safari, Chrome Android) | Abre el menú de compartir nativo |
| Fallback | Universal | Descarga el archivo + abre la URL |

#### Los botones de acción con imágenes de señales

```typescript
// En lugar de:
<button onClick={goBack}>RETAKE</button>

// El proyecto usa:
<div
  style={{
    backgroundImage: `url(${stopSignImage})`,
    backgroundSize: 'contain',
    width: '80px',
    height: '80px',
    cursor: 'pointer'
  }}
  onClick={() => navigate('/frame')}
>
  <span className="sr-only">RETAKE</span>  {/* Accesibilidad: texto para lectores de pantalla */}
</div>
```

**`sr-only`** (screen reader only) es una clase de Tailwind que hace el texto invisible visualmente pero accesible para lectores de pantalla. Es una buena práctica de accesibilidad.

---

### 📄 `src/client/routes/Selection.tsx` — El componente "fantasma"

**¿Por qué existe pero no se usa?**

En algún momento del desarrollo, la app tenía este flujo:
```
Camera → fotografías en modo "ráfaga" → Selection → Background
```
El usuario tomaba más de 4 fotos y luego ELEGÍA cuáles 4 quería usar.

Luego se simplificó el flujo:
```
Camera → automáticamente 4 fotos → Background
```

`Selection.tsx` quedó como **deuda técnica** — código que existía, funcionaba, pero quedó obsoleto cuando cambiaron los requisitos.

**¿Qué hace si se usa?**
- Recibe `{ images, frameLayout }` vía router state
- Muestra todas las fotos en un grid de 3 columnas
- El usuario toca las fotos en orden (1, 2, 3, 4) para seleccionarlas
- Cuando hay exactamente 4 seleccionadas, activa el botón de continuar
- Navega a `/background` con las 4 fotos seleccionadas

**¿Deberías reintegrarlo al reconstruir?** Sería una mejora interesante: tomar 6-8 fotos y dejar al usuario elegir las 4 mejores.

---

## 5. FLUJO DE EJECUCIÓN PASO A PASO

### Inicio (carga de la página)

```
1. El navegador visita http://localhost:3000
2. Express recibe la petición GET /
3. vite-express no encuentra una ruta API para "/"
   → En desarrollo: delega a Vite → Vite sirve index.html
   → En producción: sirve /dist/index.html
4. El navegador carga index.html (esqueleto vacío)
5. El navegador ejecuta el script → carga main.tsx
6. ReactDOM.createRoot("#root") → React toma control del div
7. RouterProvider evalúa URL "/" → monta <App />
8. App.tsx ejecuta:
   a. useState(new Date()) → time = hora actual
   b. useEffect ([]): setInterval cada 1000ms
   c. React renderiza el JSX
9. El navegador muestra la pantalla de inicio con el fondo y el reloj
```

### El usuario hace click en START (la señal "One Way")

```
1. El usuario ve la imagen oneway.png
2. Hace click sobre ella
3. El componente <Link to="/frame"> intercepta el click
4. React Router cambia la URL a /frame (SIN recargar la página)
5. React Router desmonta <App />:
   a. El useEffect de App.tsx ejecuta su función de limpieza
   b. clearInterval(timer) → el reloj se detiene
6. React Router monta <Frame />:
   a. El componente se renderiza
   b. Tres tarjetas de layout aparecen
7. El usuario hace click en "STRIP"
8. handleSelectFrame('strip') se ejecuta
9. navigate('/camera', { state: { frameLayout: 'strip' } })
10. React Router desmonta <Frame />, monta <Camera />
```

### Camera.tsx — Desde el montaje hasta la captura

```
1. Camera.tsx se monta
2. Estado inicial:
   - images: []
   - isCapturing: false
   - countdown: null
   - flash: false
3. const { frameLayout } = useLocation().state → "strip"
4. react-webcam solicita acceso a la cámara
5. Navegador muestra diálogo de permisos
6. Usuario concede → video en vivo aparece
7. Usuario hace click en SHOOT
8. startAutomatedCapture() se ejecuta (función async)

   --- ITERACIÓN 1 de 4 ---
   9.  setCountdown(5) → React re-renderiza → "5" en pantalla
   10. await new Promise(setTimeout 1000ms) → ESPERA 1 segundo
   11. setCountdown(4) → re-renderiza → "4"
   12. ... (y así hasta 1)
   13. setCountdown(null) → el número desaparece
   14. webcamRef.current.getScreenshot() → captura el fotograma
       → devuelve "data:image/jpeg;base64,/9j/4AAQ..."
   15. capturedImages.push(foto)
   16. setImages([foto]) → la miniatura aparece en la barra inferior
   17. setFlash(true) → React re-renderiza → overlay blanco aparece
   18. await setTimeout(200ms)
   19. setFlash(false) → overlay desaparece
   20. await setTimeout(1000ms) → usuario puede ver la miniatura
   --- FIN ITERACIÓN 1 ---
   
   21. Se repiten los pasos 9-20 para las fotos 2, 3 y 4

22. setIsCapturing(false)
23. navigate('/background', { state: { selectedImages: [f1,f2,f3,f4], frameLayout: 'strip' } })
```

### Background.tsx — Preview y selección de fondo

```
1. Background.tsx se monta
2. const { selectedImages, frameLayout } = useLocation().state
3. Estado inicial: backgroundStyle = 'graffiti'
4. useEffect({ dep: [backgroundStyle] }) se ejecuta por primera vez:
   a. Crea canvas off-screen 180×540 (30% de 600×1800 para strip)
   b. Carga imagen graffiti-wall.jpg
   c. img.onload → dibuja fondo en canvas
   d. Dibuja las 4 fotos apiladas verticalmente
   e. canvas.toDataURL() → setPreviewUrl(url)
5. React renderiza: <img src={previewUrl} /> a la izquierda
   y los 6 botones de fondo a la derecha
6. Usuario hace click en "SUBWAY"
7. setBackgroundStyle('subway')
8. React re-renderiza
9. useEffect detecta que backgroundStyle cambió → vuelve al paso 4b
   pero esta vez carga subway-wall.jpg
10. El preview se actualiza con el nuevo fondo
11. Usuario presiona CONTINUE (oneway.png)
12. navigate('/result', { state: { selectedImages, frameLayout, backgroundStyle: 'subway' } })
```

### Result.tsx — Composición final

```
1. Result.tsx se monta
2. const { selectedImages, frameLayout, backgroundStyle } = useLocation().state
3. useEffect([]) — se ejecuta UNA VEZ:
   a. Crear canvas 600×1800 (strip a resolución completa)
   b. Dibujar fondo subway a resolución completa
   c. Dibujar las 4 fotos a resolución completa
   d. canvasRef.current = canvas (guardar referencia)
   e. setPreviewUrl(canvas.toDataURL('image/jpeg', 0.7))
      → preview en pantalla (calidad reducida para rapidez)
   f. uploadPhoto(canvas):
      i.  canvas.toDataURL('image/png') → string base64 grande (~3-5MB)
      ii. fetch('POST /api/photos', { body: imageData })
      iii. Express responde: { photoId: "a3f7...", shareUrl: "https://..." }
      iv.  setShareUrl(url)
      v.   QRCode.toDataURL(shareUrl) → imagen QR como base64
      vi.  setQrCode(qrDataUrl)
4. React re-renderiza mostrando:
   - La imagen final
   - El código QR
   - Los botones de acción
5. Usuario hace click en DOWNLOAD:
   a. const link = document.createElement('a')
   b. link.href = canvas.toDataURL('image/png') (o downloadUrl del servidor)
   c. link.download = 'photobooth.png'
   d. link.click() → el navegador descarga el archivo
```

---

## 6. CONCEPTOS CLAVE QUE DEBES DOMINAR

### 6.1 El ciclo de vida de React — `useEffect`

`useEffect` permite ejecutar código después de que React renderice el componente. Tiene 3 variantes:

```typescript
// Variante 1: Se ejecuta después de CADA render
useEffect(() => {
  console.log("Algo cambió");
}); // ← Sin segundo argumento

// Variante 2: Se ejecuta solo al MONTAR el componente
useEffect(() => {
  console.log("Componente montado");
  return () => console.log("Componente desmontado"); // limpieza
}, []); // ← Array vacío

// Variante 3: Se ejecuta cuando cambia una dependencia específica
useEffect(() => {
  console.log("backgroundStyle cambió a:", backgroundStyle);
  // Re-dibuja el canvas
}, [backgroundStyle]); // ← Solo cuando backgroundStyle cambia
```

**¿Qué significa "montar"?** Un componente se monta cuando React lo añade al DOM por primera vez. Se desmonta cuando React lo saca del DOM.

### 6.2 `useState` — El estado de React

```typescript
const [valor, setValor] = useState(valorInicial);
//     │         │
//     │         └── Función para actualizar el valor
//     └── El valor actual
```

**Regla de oro:** NUNCA modifiques el estado directamente. Siempre usa la función setter:

```typescript
// ❌ INCORRECTO:
images.push(nuevaFoto); // Esto no causa re-render

// ✅ CORRECTO:
setImages(prev => [...prev, nuevaFoto]); // Crea un nuevo array → re-render
// ↑ "prev" es el array anterior
// ↑ [...prev, nuevaFoto] es una copia con el nuevo elemento añadido
```

**¿Por qué no modificar directamente?** React compara el estado anterior con el nuevo para saber si debe re-renderizar. Si modificas el objeto/array original, React no detecta el cambio porque la referencia en memoria es la misma.

### 6.3 `useRef` — Referencias sin re-render

```typescript
const webcamRef = useRef<Webcam>(null);
// webcamRef.current = null inicialmente
// webcamRef.current = instancia de Webcam cuando se monta

// Para acceder al método getScreenshot():
const foto = webcamRef.current?.getScreenshot();
//                              ↑
//             "?." = optional chaining: si current es null, devuelve undefined
//             (evita el error "Cannot read property of null")
```

| | `useState` | `useRef` |
|---|---|---|
| ¿Causa re-render al cambiar? | ✅ Sí | ❌ No |
| ¿Persiste entre renders? | ✅ Sí | ✅ Sí |
| ¿Para qué sirve? | Datos que afectan la UI | Referencias a DOM/componentes, valores sin UI |

### 6.4 Canvas API — Dibujar en el navegador

```typescript
// Crear un canvas (puede ser en el DOM o invisible)
const canvas = document.createElement('canvas');
canvas.width = 600;
canvas.height = 1800;

// Obtener el contexto de dibujo 2D
const ctx = canvas.getContext('2d');

// Operaciones básicas:
ctx.fillStyle = 'red';
ctx.fillRect(0, 0, 100, 100);     // Rectángulo rojo en (0,0) de 100×100

ctx.drawImage(img, x, y, w, h);   // Dibujar imagen en posición (x,y) con tamaño (w,h)

ctx.fillStyle = 'white';
ctx.font = 'bold 48px Arial';
ctx.fillText('HOLA', 100, 200);   // Texto en posición (100, 200)

// Exportar como imagen:
const base64 = canvas.toDataURL('image/png');      // PNG sin pérdida
const base64 = canvas.toDataURL('image/jpeg', 0.9); // JPEG con 90% de calidad
```

> **Analogía:** El canvas es como una hoja de papel digital. `ctx` es tu lápiz/pincel. Cada operación (`fillRect`, `drawImage`, `fillText`) es un trazo que no puedes borrar individualmente — solo puedes pintar encima.

### 6.5 React Router — Navegación y paso de datos

```typescript
// En el componente que ENVÍA datos:
import { useNavigate } from "react-router-dom";
const navigate = useNavigate();

navigate('/ruta-destino', {
  state: { clave: 'valor', otrosDatos: [1, 2, 3] }
});

// En el componente que RECIBE datos:
import { useLocation } from "react-router-dom";
const location = useLocation();
const { clave, otrosDatos } = location.state;
// clave === 'valor'
// otrosDatos === [1, 2, 3]
```

**⚠️ Problema crítico con router state:**

Si el usuario **actualiza la página** (F5) estando en `/result`, `location.state` será `null` porque el estado del router se pierde al recargar. El proyecto NO maneja este caso — si presionas F5 en `/result`, la app crashea.

**¿Cómo solucionarlo?**
```typescript
// Opción 1: Redirigir si no hay state
const location = useLocation();
if (!location.state) { navigate('/'); return null; }

// Opción 2: Usar sessionStorage como backup
useEffect(() => {
  if (location.state) {
    sessionStorage.setItem('photoData', JSON.stringify(location.state));
  }
}, []);
```

### 6.6 Base64 — Imágenes como texto

```
IMAGEN BINARIA:              BASE64:
[FF, D8, FF, E0, ...]   →    /9j/4AAQSkZJRgABAQ...
(bytes, no legibles)         (texto, transmisible por JSON)
```

**¿Por qué 33% más grande?** Cada 3 bytes se convierten en 4 caracteres base64:
- 3 bytes = 24 bits
- Base64 usa 4 caracteres de 6 bits = 24 bits
- 4/3 = 1.333... → 33% más grande

**En código:**
```typescript
// Convertir imagen a base64:
canvas.toDataURL('image/png')
// → "data:image/png;base64,iVBORw0KGgo..."

// Quitar el prefijo:
imageData.replace(/^data:image\/\w+;base64,/, '')
// → "iVBORw0KGgo..."

// Convertir de vuelta a bytes:
Buffer.from(base64String, 'base64')
// → <Buffer 89 50 4e 47...>
```

### 6.7 fetch API — Peticiones HTTP desde el cliente

```typescript
// GET (obtener datos):
const response = await fetch('/api/photos/abc123');
const imageBlob = await response.blob();

// POST (enviar datos):
const response = await fetch('/api/photos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ imageData: base64String })
});

// Siempre verificar si fue exitoso:
if (!response.ok) {
  throw new Error(`HTTP error! status: ${response.status}`);
}

const data = await response.json();
// data = { photoId: "...", shareUrl: "...", downloadUrl: "..." }
```

**¿Por qué `await response.json()`?**

`fetch` devuelve primero los headers de la respuesta (muy rápido). Luego el body llega en partes (streaming). `response.json()` espera a que llegue todo el body y lo parsea como JSON.

---

## 7. PLAN PARA RECONSTRUIRLO DESDE CERO

### Fase 1 — El esqueleto básico (Días 1-2)

**Objetivo:** Una app que navega entre pantallas, sin funcionalidad real.

```bash
# 1. Crear el proyecto
npm create vite@latest mi-photobooth -- --template react-ts
cd mi-photobooth
npm install react-router-dom

# 2. Limpiar archivos innecesarios
rm src/assets/react.svg
# Vaciar App.css, index.css
```

```typescript
// src/main.tsx — Configurar el router
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";

const router = createBrowserRouter([
  { path: "/",      element: <App /> },
  { path: "/frame", element: <div>Frame</div> },
  { path: "/camera", element: <div>Camera</div> },
  { path: "/background", element: <div>Background</div> },
  { path: "/result", element: <div>Result</div> },
]);

// src/App.tsx — Landing básica
import { Link } from "react-router-dom";
export default function App() {
  return (
    <div>
      <h1>NYC Photobooth</h1>
      <Link to="/frame">START</Link>
    </div>
  );
}
```

**Validación:** Navegar entre pantallas con los links funciona ✅

### Fase 2 — La cámara (Días 3-5)

```bash
npm install react-webcam
```

```typescript
// src/routes/Camera.tsx
import Webcam from "react-webcam";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Camera() {
  const webcamRef = useRef(null);
  const [photos, setPhotos] = useState([]);
  const navigate = useNavigate();

  // Paso 1: Solo capturar UNA foto al hacer click
  const captureOne = () => {
    const photo = webcamRef.current?.getScreenshot();
    setPhotos([photo]);
  };

  // Paso 2 (después de que funcione): Capturar 4 con countdown
  // Paso 3 (después de que funcione): Navegar a /background

  return (
    <div>
      <Webcam ref={webcamRef} />
      <button onClick={captureOne}>CAPTURAR</button>
      {photos.map((p, i) => <img key={i} src={p} />)}
    </div>
  );
}
```

**Progresión recomendada:**
1. Webcam visible → OK ✅
2. Captura 1 foto → aparece debajo → OK ✅
3. Captura 4 fotos al hacer click 4 veces → OK ✅
4. Cuenta regresiva de 5 segundos antes de cada foto → OK ✅
5. Las 4 fotos se capturan automáticamente → OK ✅
6. Navegar a /background pasando las fotos → OK ✅

### Fase 3 — Canvas básico (Días 6-9)

```typescript
// Ejercicio previo AISLADO (practica esto antes de integrarlo):
const canvas = document.createElement('canvas');
canvas.width = 300; canvas.height = 900; // Strip pequeño

const ctx = canvas.getContext('2d');
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, 300, 900);

// Dibujar 4 fotos en columna (hardcodeadas primero):
const margin = 10;
const photoHeight = (900 - margin * 5) / 4; // Altura de cada foto
const photoWidth = 300 - margin * 2;

photos.forEach((photoSrc, i) => {
  const img = new Image();
  img.onload = () => {
    const y = margin + i * (photoHeight + margin);
    ctx.drawImage(img, margin, y, photoWidth, photoHeight);
  };
  img.src = photoSrc;
});
```

**Progresión:**
1. Canvas con fondo blanco → OK ✅
2. Una foto dibujada en el canvas → OK ✅
3. 4 fotos en layout strip → OK ✅
4. 4 fotos en layout grid (2×2) → OK ✅
5. Layout especial bodega-cat → OK ✅
6. Fondos de colores sólidos → OK ✅
7. Fondos con imagen → OK ✅

### Fase 4 — Descarga sin servidor (Día 10)

```typescript
const downloadPhoto = () => {
  const link = document.createElement('a');
  link.download = 'photobooth.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
};
```

**Validación:** Se descarga un PNG con las 4 fotos y el fondo ✅

### Fase 5 — El servidor Express (Días 11-14)

```bash
npm install express vite-express tsx
npm install -D @types/express nodemon
```

```typescript
// src/server/main.ts
import express from "express";
import ViteExpress from "vite-express";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import crypto from "crypto";

const app = express();
app.use(express.json({ limit: '50mb' }));

// Crear carpeta de fotos
if (!existsSync('./public/photos')) {
  mkdir('./public/photos', { recursive: true });
}

// Endpoint para guardar foto
app.post("/api/photos", async (req, res) => {
  const { imageData } = req.body;
  const photoId = crypto.randomBytes(8).toString('hex');
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  await writeFile(`./public/photos/${photoId}.png`, buffer);
  res.json({ photoId, shareUrl: `http://localhost:3000/share/${photoId}` });
});

ViteExpress.listen(app, 3000, () => console.log("Servidor en puerto 3000"));
```

**Progresión:**
1. Servidor arranca → OK ✅
2. POST /api/photos guarda el archivo en disco → OK ✅
3. El archivo existe en public/photos/ → OK ✅
4. El frontend llama al endpoint y recibe el photoId → OK ✅

### Fase 6 — QR code (Días 15-16)

```bash
npm install qrcode
npm install -D @types/qrcode
```

```typescript
import QRCode from 'qrcode';

const qrDataUrl = await QRCode.toDataURL('https://mi-url.com/share/abc123');
// qrDataUrl = "data:image/png;base64,..."
<img src={qrDataUrl} alt="QR Code" />
```

### Fase 7 — Página de compartir móvil (Días 17-18)

```typescript
app.get("/share/:id", async (req, res) => {
  const { id } = req.params;
  // Leer foto del disco, convertir a base64, devolver HTML
  res.send(`
    <html>
      <body>
        <img src="data:image/png;base64,${imageBase64}" />
        <a href="/api/photos/${id}" download>Descargar</a>
      </body>
    </html>
  `);
});
```

### Fase 8 — Diseño y polish (Días 19-21)

1. Añadir fuentes custom con `@font-face`
2. El fondo de pantalla de inicio
3. La animación flash blanco
4. El efecto grano de película (CSS)
5. El timestamp en la esquina
6. Los botones con imágenes de señales (oneway.png, stop.png)
7. Responsive design con Tailwind

---

## 8. ERRORES COMUNES Y CÓMO EVITARLOS

### Error 1 — Olvidar limpiar el `setInterval`

```typescript
// ❌ FUGA DE MEMORIA:
useEffect(() => {
  setInterval(() => setTime(new Date()), 1000);
  // Si el componente se desmonta y vuelve a montar:
  // → Se crea un nuevo intervalo SIN cancelar el anterior
  // → Con el tiempo hay decenas de intervalos corriendo
}, []);

// ✅ CORRECTO:
useEffect(() => {
  const timer = setInterval(() => setTime(new Date()), 1000);
  return () => clearInterval(timer); // ← Limpieza al desmontar
}, []);
```

### Error 2 — Leer `ref.current` antes de que esté listo

```typescript
// ❌ POSIBLE ERROR:
const file = webcamRef.current.getScreenshot(); // TypeError si current es null

// ✅ CON OPTIONAL CHAINING:
const file = webcamRef.current?.getScreenshot(); // undefined si null, no error
```

### Error 3 — Mutar el estado directamente

```typescript
// ❌ INCORRECTO — React no detecta el cambio:
const [images, setImages] = useState([]);
images.push(nuevaFoto); // Mutación directa

// ✅ CORRECTO — Nuevo array = React sí detecta el cambio:
setImages(prev => [...prev, nuevaFoto]);
```

### Error 4 — Canvas no se actualiza cuando cambia el fondo

```typescript
// ❌ El canvas solo dibuja una vez al montar:
useEffect(() => {
  renderCanvas();
}, []); // ← Sin dependencia de backgroundStyle

// ✅ Se re-dibuja cuando cambia el fondo:
useEffect(() => {
  renderCanvas();
}, [backgroundStyle]); // ← Dependencia correcta
```

### Error 5 — Las fotos están en espejo

`react-webcam` por defecto invierte horizontalmente la imagen (como un espejo, para que la selfie se vea natural). Pero esto puede hacer que el texto o elementos asimétricos aparezcan al revés en la foto final.

```typescript
// Para capturar sin espejo:
webcamRef.current?.getScreenshot({ mirrored: false });

// O invertir en el canvas al dibujar:
ctx.save();
ctx.scale(-1, 1); // Voltear horizontalmente
ctx.drawImage(img, -canvas.width, 0, canvas.width, canvas.height);
ctx.restore();
```

### Error 6 — Intentar `drawImage` antes de que cargue la imagen

```typescript
// ❌ INCORRECTO — La imagen puede no estar lista:
const img = new Image();
img.src = url;
ctx.drawImage(img, 0, 0); // Puede resultar en espacio en blanco

// ✅ CORRECTO — Esperar el evento 'load':
const img = new Image();
img.onload = () => ctx.drawImage(img, 0, 0); // Seguro
img.src = url; // Esto INICIA la carga
```

### Error 7 — Perder el estado al recargar la página (F5)

El router state no persiste entre recargas. Si el usuario está en `/result` y presiona F5, `location.state` será `null` y la app crasheará.

```typescript
// ✅ SOLUCIÓN — Guardar en sessionStorage como backup:
// En Camera.tsx al navegar:
sessionStorage.setItem('photoData', JSON.stringify({ selectedImages, frameLayout }));
navigate('/background', { state: { selectedImages, frameLayout } });

// En Background.tsx al leer:
const location = useLocation();
const state = location.state ?? JSON.parse(sessionStorage.getItem('photoData') ?? '{}');
```

### Error 8 — CORS en desarrollo

Si ejecutas el servidor Express en un puerto diferente al de Vite:

```typescript
// ❌ SIN vite-express, fetch falla:
// Vite en :5173, Express en :3000 → CORS error

// ✅ CON vite-express, todo en el mismo puerto — no hay CORS
// O configurar proxy en vite.config.ts:
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
});
```

---

## 9. PREGUNTAS DEL MENTOR

Estas preguntas están ordenadas de menor a mayor dificultad. Intenta responderlas sin mirar el código. Si no puedes, es la señal de qué estudiar a continuación.

### Nivel 1 — Básico

1. **¿Qué pasa cuando el usuario presiona F5 estando en `/result`?** ¿Por qué se pierden las fotos?

2. **¿Cuántas veces se ejecuta este `useEffect`?**
   ```typescript
   useEffect(() => {
     console.log("ejecutado");
   }, [backgroundStyle]);
   ```
   ¿En qué circunstancias se ejecuta?

3. **¿Cuál es la diferencia entre estas dos líneas?**
   ```typescript
   setImages([...images, nuevaFoto]);  // (A)
   images.push(nuevaFoto);              // (B)
   ```
   ¿Cuál es la correcta y por qué?

4. **¿Qué hace `?. ` en `webcamRef.current?.getScreenshot()`?**

5. **¿Por qué `index.html` tiene `<div id="root"></div>` vacío?** ¿Quién lo llena?

### Nivel 2 — Intermedio

6. **Explica qué hace esta línea:**
   ```typescript
   const photoId = crypto.randomBytes(8).toString('hex');
   ```
   ¿Por qué es mejor que `Math.random()`?

7. **¿Por qué el proyecto genera el canvas dos veces?** (una en Background.tsx y otra en Result.tsx)

8. **¿Qué pasaría si eliminases el `return () => clearInterval(timer)` del `useEffect` en App.tsx?** Explica el bug que ocurriría.

9. **¿Para qué sirve `NODE_ENV=production` en el script `start`?** ¿Qué cambia?

10. **¿Por qué la función `getBaseUrl` en el servidor reconstruye la URL del host en lugar de hardcodearla?**
    ```typescript
    const getBaseUrl = (req: express.Request): string => {
      return `${req.protocol}://${req.get('host')}`;
    };
    ```

### Nivel 3 — Avanzado

11. **El servidor guarda las fotos en el sistema de archivos. ¿Qué problemas tiene esto si la app escala a miles de usuarios?** ¿Qué alternativa usarías?

12. **Explica por qué este código puede tener un bug:**
    ```typescript
    useEffect(() => {
      selectedImages.forEach((src, i) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, i * 100, 100, 100);
          if (i === selectedImages.length - 1) {
            setPreviewUrl(canvas.toDataURL()); // ← ¿Cuándo se ejecuta esto?
          }
        };
        img.src = src;
      });
    }, [backgroundStyle]);
    ```
    *Pista: ¿En qué orden se ejecutan las funciones `onload`?*

13. **`Selection.tsx` existe pero no se usa. ¿Qué decisión tomarías tú?** ¿Borrarlo, reintegrarlo, mantenerlo? Justifica tu respuesta con argumentos técnicos.

14. **El proyecto no tiene autenticación. ¿Qué implicaciones de seguridad tiene?** Lista al menos 3 vectores de ataque.

15. **¿Cómo testearías matemáticamente que el canvas está dibujando las fotos en las posiciones correctas?** ¿Cómo escribirías un test unitario para la función de layout?

---

## 10. GLOSARIO DE TÉRMINOS

| Término | Definición simple |
|---|---|
| **Base64** | Codificación que convierte datos binarios (como imágenes) en texto ASCII seguro para transmitir |
| **Bundle** | El archivo(s) final(es) que Vite produce juntando todo el código |
| **Canvas API** | API del navegador para dibujar gráficos 2D programáticamente |
| **CORS** | Política del navegador que bloquea peticiones entre dominios distintos |
| **DPI** | Dots Per Inch — medida de resolución de impresión (300 DPI = calidad fotográfica) |
| **Express** | Framework web para Node.js que facilita crear servidores HTTP |
| **Full-Stack** | Una aplicación que incluye tanto frontend (cliente) como backend (servidor) |
| **Hook** | Funciones especiales de React que empiezan con `use` (useEffect, useState, etc.) |
| **Monolítico** | Arquitectura donde todo el código vive en un solo servicio/proceso |
| **Mounting** | Cuando React añade un componente al DOM por primera vez |
| **Node.js** | Entorno de ejecución que permite correr JavaScript en el servidor |
| **Progressive Enhancement** | Estrategia de desarrollar primero para el nivel más bajo de soporte y luego añadir mejoras |
| **Ref** | Referencia a un elemento del DOM o instancia de componente que no causa re-renders |
| **Router State** | Datos que se pueden adjuntar a una navegación de React Router |
| **SPA** | Single Page Application — app web que no recarga la página entre navegaciones |
| **SSR** | Server Side Rendering — generar HTML en el servidor en vez del cliente |
| **TypeScript** | JavaScript con sistema de tipos estáticos añadido |
| **Unmounting** | Cuando React elimina un componente del DOM |
| **Vite** | Bundler y servidor de desarrollo moderno, mucho más rápido que Webpack |
| **vite-express** | Librería que integra Vite (frontend) con Express (backend) en un solo servidor |
| **Web Audio API** | API del navegador para crear y manipular sonido programáticamente |
| **Web Share API** | API del navegador para abrir el menú nativo de compartir del sistema operativo |

---

## RESUMEN FINAL — LO QUE DEBES RECORDAR

| # | Lo más importante |
|---|---|
| 1 | La app es React (cliente) + Express (servidor) en el mismo repositorio, integrados con `vite-express` |
| 2 | Los datos viajan entre pantallas usando **React Router State** (como mochilas de datos en la navegación) |
| 3 | Las imágenes se procesan como **strings base64** en el cliente y se decodifican a binarios en el servidor |
| 4 | La composición visual se hace con **Canvas API** — dos veces: al 30% para preview y al 100% para el resultado final |
| 5 | El 80% de la complejidad está en **Camera.tsx** (async/timers) y **Result.tsx** (canvas + fetch + QR) |
| 6 | `Selection.tsx` es **código muerto** — un recordatorio de que los requisitos cambian durante el desarrollo |
| 7 | El servidor genera **páginas HTML completas** para compartir en móviles (SSR simple) |
| 8 | Sin `clearInterval` en el cleanup de `useEffect` → **fuga de memoria** clásica |
| 9 | `crypto.randomBytes(8)` para IDs únicos, no `Math.random()` — los IDs predecibles son un riesgo de seguridad |
| 10 | Progress: **Fase 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8** (no saltes pasos, cada uno depende del anterior) |

---

*Documento generado el 24/02/2026. Versión analizada: vite-express-project v0.0.0*
