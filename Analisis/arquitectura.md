# Arquitectura en React — Guía Completa para Entender el Tema en Profundidad

> **Nota para el lector:** Este documento está pensado para alguien que quiere entender cómo se organiza y estructura una aplicación React de forma profesional. Se explica desde lo básico hasta lo avanzado. Si en algún punto aparece un término técnico que pueda ser confuso, se explicará en el momento o justo después entre paréntesis.

---

## Índice

1. [¿Qué es la arquitectura de software?](#1-qué-es-la-arquitectura-de-software)
2. [¿Por qué importa la arquitectura en el frontend?](#2-por-qué-importa-la-arquitectura-en-el-frontend)
3. [El bloque fundamental: el componente](#3-el-bloque-fundamental-el-componente)
4. [Tipos de componentes en React](#4-tipos-de-componentes-en-react)
5. [Patrones de arquitectura de componentes](#5-patrones-de-arquitectura-de-componentes)
6. [Estructuras de carpetas y archivos](#6-estructuras-de-carpetas-y-archivos)
7. [Gestión del estado (State Management)](#7-gestión-del-estado-state-management)
8. [Comunicación entre componentes](#8-comunicación-entre-componentes)
9. [Capas de una aplicación React profesional](#9-capas-de-una-aplicación-react-profesional)
10. [Patrones de diseño más usados en React](#10-patrones-de-diseño-más-usados-en-react)
11. [Cuándo usar cada arquitectura](#11-cuándo-usar-cada-arquitectura)
12. [Ejemplo práctico completo: PhotoBooth App](#12-ejemplo-práctico-completo-photobooth-app)
13. [Errores comunes y cómo evitarlos](#13-errores-comunes-y-cómo-evitarlos)
14. [Resumen visual y checklists](#14-resumen-visual-y-checklists)

---

## 1. ¿Qué es la arquitectura de software?

La **arquitectura de software** es la forma en que decidimos organizar, separar y conectar las diferentes partes de una aplicación. Es como el plano de un edificio: antes de construir, hay que decidir dónde van las habitaciones, cómo se conectan, dónde van las instalaciones eléctricas, etc.

En el frontend (la parte visual de una aplicación web), la arquitectura responde preguntas como:

- ¿Dónde guardamos los archivos de cada tipo?
- ¿Quién es responsable de hacer cada cosa?
- ¿Cómo fluyen los datos de un lugar a otro?
- ¿Cómo separamos la lógica del diseño visual?
- ¿Cómo hacemos que la aplicación sea fácil de mantener y ampliar?

No existe **una única arquitectura correcta**. Depende del tamaño del proyecto, del equipo, del tiempo disponible y de los requisitos. El objetivo de este documento es que entiendas las opciones más comunes para poder elegir bien.

---

## 2. ¿Por qué importa la arquitectura en el frontend?

Cuando empiezas un proyecto pequeño, suele da igual cómo lo organizas. Pero a medida que crece, una mala organización genera lo que se llama **deuda técnica** (technical debt): código que funciona, pero que es difícil de leer, modificar o extender.

### Síntomas de mala arquitectura:
- Cuando añades una funcionalidad nueva, aparecen bugs en partes que no tocaste.
- Tienes archivos de 500, 1000 o más líneas que hacen demasiadas cosas.
- No sabes en qué archivo está el código que buscas.
- Cambiar el diseño de un botón implica tocar 10 archivos distintos.
- Reutilizar un componente es tan difícil que acabas copiando y pegando código.

### Beneficios de una buena arquitectura:
- **Escalabilidad**: el proyecto puede crecer sin volverse un caos.
- **Mantenibilidad**: es fácil encontrar, leer y modificar el código.
- **Reutilización**: los componentes y la lógica se pueden usar en múltiples sitios.
- **Testeabilidad**: es más fácil escribir pruebas automáticas (tests).
- **Colaboración**: varios desarrolladores pueden trabajar en paralelo sin pisarse.

---

## 3. El bloque fundamental: el componente

En React, todo gira alrededor del **componente**. Un componente es una función de JavaScript que devuelve HTML (en realidad JSX, que es una extensión de JavaScript que parece HTML).

```jsx
// Esto es un componente React mínimo
function MiBoton() {
  return <button>Haz clic aquí</button>;
}
```

Un componente puede:
- Recibir datos desde su "padre" a través de **props** (propiedades).
- Tener su propio estado interno con **useState**.
- Ejecutar lógica cuando ocurren eventos (clics, cambios, etc.).
- Mostrar otros componentes dentro de él (**composición**).

### La regla de oro del componente:
> **Un componente debería hacer una sola cosa, y hacerla bien.**

Esta regla se llama ***Single Responsibility Principle*** (Principio de Responsabilidad Única). Es uno de los principios más importantes en programación. En la práctica, significa que si un componente está haciendo demasiadas cosas, hay que dividirlo.

---

## 4. Tipos de componentes en React

Entender los distintos "roles" que puede tener un componente es fundamental para organizarlos bien.

### 4.1. Componentes de Presentación (Presentational / Dumb Components)

Su única responsabilidad es **mostrar datos**. No saben de dónde vienen los datos ni qué lógica de negocio hay detrás. Solo reciben props y renderizan (muestran) contenido.

```jsx
// Solo se preocupa de cómo se ve
function TarjetaFoto({ url, titulo, fecha }) {
  return (
    <div className="tarjeta">
      <img src={url} alt={titulo} />
      <h3>{titulo}</h3>
      <p>{fecha}</p>
    </div>
  );
}
```

**Características:**
- Solo reciben props
- No tienen lógica de negocio (no llaman a APIs, no calculan cosas complejas)
- Son muy fáciles de reutilizar
- Son muy fáciles de testear
- A veces se les llama "dumb components" (componentes tontos) porque no piensan, solo muestran

### 4.2. Componentes Contenedores (Container / Smart Components)

Su responsabilidad es **gestionar la lógica y los datos**. Obtienen datos (de una API, del estado global, etc.), los procesan y se los pasan a los componentes de presentación.

```jsx
// Se preocupa de obtener y gestionar los datos
function ListaDeFotos() {
  const [fotos, setFotos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch('/api/fotos')
      .then(res => res.json())
      .then(data => {
        setFotos(data);
        setCargando(false);
      });
  }, []);

  if (cargando) return <p>Cargando...</p>;

  return (
    <div>
      {fotos.map(foto => (
        <TarjetaFoto key={foto.id} url={foto.url} titulo={foto.titulo} fecha={foto.fecha} />
      ))}
    </div>
  );
}
```

**Características:**
- Manejan estado y lógica
- Llaman a APIs o leen de un estado global
- Le pasan datos a los componentes de presentación
- También se les llama "smart components" (componentes inteligentes)

### 4.3. Componentes de Layout (Diseño)

Se encargan de la **estructura visual** de la página: encabezados, barras laterales, pies de página, grids (cuadrículas), etc.

```jsx
function LayoutPrincipal({ children }) {
  return (
    <div className="layout">
      <Header />
      <main className="contenido-principal">
        {children}
      </main>
      <Footer />
    </div>
  );
}
```

> **`children`** es una prop especial en React. Cuando pones contenido entre las etiquetas de un componente, ese contenido es `children`. Es como un "hueco" donde el componente padre puede meter lo que quiera.

### 4.4. Componentes de Página (Pages / Views)

Representan una **pantalla completa** de la aplicación. Cada ruta de la URL suele tener un componente de página distinto.

```jsx
// src/pages/GaleriaPage.jsx
function GaleriaPage() {
  return (
    <LayoutPrincipal>
      <h1>Mi Galería</h1>
      <ListaDeFotos />
    </LayoutPrincipal>
  );
}
```

### 4.5. Componentes de UI (Interfaz de Usuario)

Son componentes muy pequeños y genéricos: botones, inputs, modales, tooltips... Son los "ladrillos" más básicos de la interfaz.

```jsx
function Boton({ texto, onClick, variante = 'primario' }) {
  return (
    <button className={`btn btn-${variante}`} onClick={onClick}>
      {texto}
    </button>
  );
}
```

---

## 5. Patrones de arquitectura de componentes

### 5.1. Atomic Design (Diseño Atómico)

Este es uno de los sistemas de organización más famosos, creado por Brad Frost. La idea es inspirarse en la química: los átomos forman moléculas, las moléculas forman organismos, etc.

```
Átomos → Moléculas → Organismos → Plantillas → Páginas
```

#### Átomos (Atoms)
Los componentes más pequeños e indivisibles. Un botón, un input, un label, un icono, un color, una tipografía.

```jsx
// atoms/Button.jsx
function Button({ label, onClick }) {
  return <button onClick={onClick}>{label}</button>;
}

// atoms/Input.jsx
function Input({ value, onChange, placeholder }) {
  return <input value={value} onChange={onChange} placeholder={placeholder} />;
}
```

#### Moléculas (Molecules)
Combinaciones simples de átomos que forman unidades con una función concreta.

```jsx
// molecules/SearchBar.jsx
function SearchBar({ onSearch }) {
  const [valor, setValor] = useState('');
  return (
    <div className="search-bar">
      <Input value={valor} onChange={e => setValor(e.target.value)} placeholder="Buscar..." />
      <Button label="Buscar" onClick={() => onSearch(valor)} />
    </div>
  );
}
```

#### Organismos (Organisms)
Secciones completas y complejas de la interfaz, formadas por moléculas y átomos.

```jsx
// organisms/Header.jsx
function Header() {
  return (
    <header>
      <Logo />
      <NavMenu />
      <SearchBar onSearch={manejarBusqueda} />
      <UserAvatar />
    </header>
  );
}
```

#### Plantillas (Templates)
La estructura de una página sin contenido real. Son como el esqueleto o el wireframe (boceto) de una pantalla.

```jsx
// templates/GaleriaTemplate.jsx
function GaleriaTemplate({ header, sidebar, galeria }) {
  return (
    <div className="galeria-layout">
      <div className="cabecera">{header}</div>
      <div className="cuerpo">
        <aside>{sidebar}</aside>
        <main>{galeria}</main>
      </div>
    </div>
  );
}
```

#### Páginas (Pages)
Las plantillas con contenido real conectadas a datos reales.

```jsx
// pages/GaleriaPage.jsx
function GaleriaPage() {
  return (
    <GaleriaTemplate
      header={<Header />}
      sidebar={<FiltrosFotos />}
      galeria={<ListaDeFotos />}
    />
  );
}
```

**¿Cuándo usar Atomic Design?**
- Proyectos medianos o grandes con equipos de diseño y desarrollo.
- Cuando se quiere construir un sistema de diseño (design system) consistente.
- Cuando hay muchos componentes reutilizables.

**Desventajas:**
- Para proyectos pequeños puede ser excesivo.
- A veces es difícil decidir si algo es un átomo o una molécula.

---

### 5.2. Feature-Based Architecture (Arquitectura basada en características)

En lugar de organizar por tipo de componente (átomos, moléculas...), se organiza por **funcionalidad o módulo**. Todo lo relacionado con una característica del producto está junto en la misma carpeta.

```
src/
  features/
    galeria/
      components/
        TarjetaFoto.jsx
        ListaDeFotos.jsx
      hooks/
        useGaleria.js
      services/
        galeriaApi.js
      store/
        galeriaSlice.js
      GaleriaPage.jsx
    camara/
      components/
        Visor.jsx
        BotonCaptura.jsx
      hooks/
        useCamara.js
      CamaraPage.jsx
    auth/
      components/
        LoginForm.jsx
      hooks/
        useAuth.js
      AuthPage.jsx
```

**¿Cuándo usar Feature-Based?**
- Proyectos grandes con múltiples funcionalidades independientes.
- Equipos grandes donde cada equipo trabaja en una feature distinta.
- Aplicaciones empresariales complejas.

**Ventajas:**
- Todo lo relacionado con una funcionalidad está en el mismo sitio.
- Es fácil borrar una funcionalidad completa (solo eliminas su carpeta).
- Los equipos pueden trabajar en paralelo con menos conflictos.

**Desventajas:**
- Puede haber duplicación de componentes entre features.
- Requiere una buena estrategia para los componentes compartidos.

---

### 5.3. Layer-Based Architecture (Arquitectura por Capas)

Se organiza el código en capas según su responsabilidad: presentación, lógica de negocio, acceso a datos...

```
src/
  components/    → Solo componentes de UI
  pages/         → Páginas completas
  hooks/         → Lógica reutilizable
  services/      → Llamadas a APIs
  store/         → Estado global
  utils/         → Funciones de utilidad
  constants/     → Valores constantes
  types/         → Tipos de datos (si usas TypeScript)
```

**¿Cuándo usar Layer-Based?**
- Proyectos pequeños o medianos.
- Cuando el equipo es pequeño y todo el mundo trabaja en todo.
- Como punto de partida antes de migrar a Feature-Based.

**Ventajas:**
- Fácil de entender al principio.
- Estructura predecible y sencilla.

**Desventajas:**
- A medida que el proyecto crece, las carpetas se vuelven muy grandes.
- El código relacionado está disperso en múltiples carpetas.

---

## 6. Estructuras de carpetas y archivos

### 6.1. Estructura mínima (proyectos pequeños)

Para una aplicación pequeña como un photobooth personal:

```
src/
  components/
    Camera/
      Camera.jsx
      Camera.css
    Gallery/
      Gallery.jsx
      Gallery.css
    UI/
      Button.jsx
      Modal.jsx
  pages/
    HomePage.jsx
    GalleryPage.jsx
  hooks/
    useCamera.js
    useGallery.js
  services/
    api.js
  utils/
    imageUtils.js
  App.jsx
  main.jsx
  index.css
```

### 6.2. Estructura media (proyectos medianos)

```
src/
  assets/
    images/
    icons/
    fonts/
  components/
    common/          ← Componentes muy genéricos (Button, Input, Modal...)
      Button/
        Button.jsx
        Button.module.css
        Button.test.jsx        ← Test del componente
        index.js               ← Archivo de exportación
    layout/          ← Componentes de estructura (Header, Footer, Sidebar...)
      Header/
      Footer/
      Layout/
  features/          ← Funcionalidades principales
    camera/
    gallery/
    filters/
  hooks/             ← Custom hooks compartidos
  pages/             ← Páginas de la aplicación
  services/          ← Lógica de comunicación con APIs
  store/             ← Estado global (si lo hay)
  utils/             ← Funciones utilitarias
  constants/         ← Valores que no cambian
  App.jsx
  main.jsx
  routes.jsx         ← Definición de rutas
```

### 6.3. Estructura de un componente individual

Cada componente puede tener su propia carpeta con todos los archivos que necesita:

```
Button/
  Button.jsx          ← El componente en sí
  Button.module.css   ← Estilos (con CSS Modules para que no se "contaminen")
  Button.test.jsx     ← Tests (pruebas automáticas)
  Button.stories.jsx  ← Storybook (documentación visual, opcional)
  index.js            ← Exportación limpia
```

El `index.js` permite importar el componente de forma más limpia:

```js
// index.js
export { default } from './Button';

// Sin index.js tendrías que escribir:
import Button from '../components/Button/Button';

// Con index.js puedes escribir:
import Button from '../components/Button';
```

### 6.4. Convenciones de nombres importantes

```
PascalCase    → Componentes React:     Button.jsx, UserCard.jsx
camelCase     → Hooks y utilidades:    useCamera.js, formatDate.js
kebab-case    → Archivos CSS globales: global-styles.css
SCREAMING     → Constantes:            MAX_FILE_SIZE, API_URL
```

> **PascalCase** = cada palabra empieza con mayúscula: `MiComponente`
> **camelCase** = la primera palabra en minúscula, el resto con mayúscula: `miVariable`
> **kebab-case** = palabras separadas por guiones: `mi-archivo`
> **SCREAMING_SNAKE_CASE** = todo en mayúsculas con guiones bajos: `MI_CONSTANTE`

---

## 7. Gestión del estado (State Management)

El **estado** (state) es la información que cambia con el tiempo en tu aplicación. Por ejemplo: si el usuario está logueado o no, qué fotos ha tomado, qué filtro tiene seleccionado, etc.

La gestión del estado es uno de los temas más importantes (y más complicados) en React. Hay diferentes estrategias, y elegir la correcta marca la diferencia.

### 7.1. Estado local (useState)

El más simple. El estado vive dentro de un componente y solo ese componente lo puede leer y modificar directamente.

```jsx
function Contador() {
  const [cuenta, setCuenta] = useState(0);

  return (
    <div>
      <p>Cuenta: {cuenta}</p>
      <button onClick={() => setCuenta(cuenta + 1)}>+1</button>
    </div>
  );
}
```

**Úsalo cuando:** el estado solo importa a un componente concreto.

### 7.2. Elevar el estado (Lifting State Up)

Cuando dos componentes necesitan compartir el mismo estado, se "sube" (eleva) el estado al componente padre común más cercano.

```jsx
// El estado vive en el padre
function PhotoBooth() {
  const [fotoCapturada, setFotoCapturada] = useState(null);

  return (
    <div>
      {/* La cámara puede capturar fotos → modifica el estado */}
      <Camera onCapture={setFotoCapturada} />

      {/* La vista previa necesita ver la foto → lee el estado */}
      <Preview foto={fotoCapturada} />
    </div>
  );
}
```

**Úsalo cuando:** dos o más componentes hermanos (al mismo nivel) necesitan el mismo dato.

### 7.3. Context API (Contexto de React)

Cuando el estado necesita llegar a componentes muy alejados en el árbol de componentes, pasarlo por props se vuelve tedioso. A esto se le llama **prop drilling** (taladrado de props) y es un problema común.

```
App
 └── LayoutPrincipal
      └── AreaContenido
           └── SeccionFotos
                └── TarjetaFoto  ← necesita el usuario, pero está muy abajo
```

El Context API crea un "almacén global" que cualquier componente puede leer sin que los intermediarios tengan que pasarlo.

```jsx
// 1. Crear el contexto
const UsuarioContext = createContext(null);

// 2. Proveedor: envuelve los componentes que necesitan acceso
function App() {
  const [usuario, setUsuario] = useState({ nombre: 'Ana', rol: 'admin' });

  return (
    <UsuarioContext.Provider value={{ usuario, setUsuario }}>
      <LayoutPrincipal />
    </UsuarioContext.Provider>
  );
}

// 3. Consumidor: cualquier componente dentro del Provider puede acceder
function TarjetaFoto() {
  const { usuario } = useContext(UsuarioContext);
  return <p>Foto de: {usuario.nombre}</p>;
}
```

**Úsalo cuando:** datos globales como usuario autenticado, tema (claro/oscuro), idioma, que muchos componentes necesitan.

**Cuidado:** el Context no es una solución de estado global completa. Cada vez que el valor del contexto cambia, todos los componentes que lo consumen se vuelven a renderizar (pintar). Puede causar problemas de rendimiento si se abusa.

### 7.4. Librerías de estado global

Para aplicaciones grandes con lógica de estado compleja, existen librerías especializadas:

#### Redux Toolkit
La opción más completa y estructurada. Tiene una curva de aprendizaje (es decir, cuesta aprenderla) pero es muy poderosa.

```
Concepto clave: Store → Slice → Action → Reducer → Selector
```

- **Store**: el almacén global de toda la aplicación.
- **Slice**: una "rebanada" del store para una funcionalidad (galeriaSlice, usuarioSlice...).
- **Action**: una descripción de qué ocurrió ("se capturó una foto", "se borró una foto").
- **Reducer**: la función que, dado el estado actual y una acción, calcula el nuevo estado.
- **Selector**: una función para leer (seleccionar) datos del store.

#### Zustand
Más sencillo que Redux. Muy popular hoy en día por su simpleza.

```jsx
// store.js
import { create } from 'zustand';

const useGaleriaStore = create((set) => ({
  fotos: [],
  agregarFoto: (foto) => set((state) => ({ fotos: [...state.fotos, foto] })),
  borrarFoto: (id) => set((state) => ({ fotos: state.fotos.filter(f => f.id !== id) })),
}));

// En cualquier componente:
function Galeria() {
  const { fotos, borrarFoto } = useGaleriaStore();
  return (
    <ul>
      {fotos.map(foto => (
        <li key={foto.id}>
          {foto.nombre}
          <button onClick={() => borrarFoto(foto.id)}>Borrar</button>
        </li>
      ))}
    </ul>
  );
}
```

#### Jotai / Recoil
Basados en "átomos" de estado. Más granulares (es decir, más pequeños y precisos) que Redux.

### 7.5. ¿Cuándo usar cada solución de estado?

```
Estado local (useState)
  └── Solo importa a un componente

Lifting State Up
  └── 2-3 componentes cercanos comparten datos

Context API
  └── Datos globales (usuario, tema, idioma)
  └── No cambia muy frecuentemente

Zustand / Jotai
  └── Estado global complejo
  └── Varios módulos comparten muchos datos
  └── Sin querer complejidad de Redux

Redux Toolkit
  └── Aplicaciones muy grandes
  └── Equipos grandes
  └── Lógica de estado muy compleja
  └── Necesitas debug tools avanzados
```

---

## 8. Comunicación entre componentes

Entender cómo fluyen los datos en React es esencial.

### 8.1. De padre a hijo: Props

La dirección natural en React. Los datos fluyen **hacia abajo** (top-down o unidirectional data flow).

```jsx
function Padre() {
  const mensaje = "Hola desde el padre";
  return <Hijo texto={mensaje} />;
}

function Hijo({ texto }) {
  return <p>{texto}</p>;
}
```

### 8.2. De hijo a padre: Callbacks

Para que un hijo pueda "comunicar" algo al padre, el padre le pasa una función como prop:

```jsx
function Padre() {
  const [foto, setFoto] = useState(null);

  // Esta función se la pasamos al hijo para que la llame cuando quiera
  const handleCaptura = (nuevaFoto) => {
    setFoto(nuevaFoto);
  };

  return <Camara onCaptura={handleCaptura} />;
}

function Camara({ onCaptura }) {
  const capturar = () => {
    const foto = tomarFoto(); // lógica de la cámara
    onCaptura(foto); // llamamos a la función del padre
  };

  return <button onClick={capturar}>Capturar</button>;
}
```

### 8.3. Entre componentes sin relación directa: Context o Estado Global

Si dos componentes no tienen relación padre-hijo directa, se usa Context API o una librería de estado global (como vimos en la sección anterior).

---

## 9. Capas de una aplicación React profesional

Una aplicación bien arquitecturada tiene varias capas con responsabilidades claras y separadas. A esto se le llama ***Separation of Concerns*** (Separación de Responsabilidades).

```
┌─────────────────────────────────────────┐
│              CAPA DE UI                 │  ← Componentes React (solo visual)
│     (Presentación / Componentes)        │
├─────────────────────────────────────────┤
│          CAPA DE LÓGICA                 │  ← Custom Hooks (lógica reutilizable)
│           (Custom Hooks)                │
├─────────────────────────────────────────┤
│          CAPA DE ESTADO                 │  ← Estado global (Context, Zustand...)
│        (State Management)              │
├─────────────────────────────────────────┤
│          CAPA DE SERVICIOS              │  ← Comunicación con APIs externas
│           (API / Services)             │
├─────────────────────────────────────────┤
│          CAPA BASE                      │  ← Utilidades, constantes, helpers
│        (Utils / Constants)              │
└─────────────────────────────────────────┘
```

### 9.1. Capa de UI

Solo componentes React. No hacen fetch (peticiones a APIs), no calculan lógica de negocio. Solo reciben datos y los muestran.

```jsx
// BIEN: componente de UI limpio
function FotoCard({ src, titulo, onBorrar }) {
  return (
    <div className="foto-card">
      <img src={src} alt={titulo} />
      <p>{titulo}</p>
      <button onClick={onBorrar}>Borrar</button>
    </div>
  );
}

// MAL: componente de UI haciendo fetch (mezclando responsabilidades)
function FotoCard({ fotoId }) {
  const [foto, setFoto] = useState(null);
  useEffect(() => {
    fetch(`/api/fotos/${fotoId}`).then(r => r.json()).then(setFoto);
  }, [fotoId]);
  // ...
}
```

### 9.2. Capa de Lógica: Custom Hooks

Los **Custom Hooks** (hooks personalizados) son funciones que empiezan por `use` y que encapsulan lógica reutilizable. Son una de las características más poderosas de React moderno.

```jsx
// hooks/useCamera.js
function useCamera() {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);

  const iniciarCamara = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError('No se pudo acceder a la cámara');
    }
  };

  const detenerCamara = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturarFoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL('image/png');
  };

  return { videoRef, stream, error, iniciarCamara, detenerCamara, capturarFoto };
}

// Uso en un componente (muy limpio):
function CamaraView() {
  const { videoRef, iniciarCamara, capturarFoto } = useCamera();

  return (
    <div>
      <video ref={videoRef} autoPlay />
      <button onClick={iniciarCamara}>Iniciar</button>
      <button onClick={capturarFoto}>Capturar</button>
    </div>
  );
}
```

Los Custom Hooks son la respuesta de React moderna al problema de "¿dónde pongo esta lógica compleja sin ensuciar mi componente?".

### 9.3. Capa de Servicios

Toda la comunicación con el exterior (APIs REST, bases de datos, almacenamiento local...) va en esta capa. Los componentes nunca deben hacer `fetch` directamente.

```js
// services/fotoService.js

const BASE_URL = '/api';

export const fotoService = {
  async getAll() {
    const res = await fetch(`${BASE_URL}/fotos`);
    if (!res.ok) throw new Error('Error al obtener fotos');
    return res.json();
  },

  async upload(fotoData) {
    const res = await fetch(`${BASE_URL}/fotos`, {
      method: 'POST',
      body: JSON.stringify(fotoData),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Error al subir foto');
    return res.json();
  },

  async delete(id) {
    const res = await fetch(`${BASE_URL}/fotos/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error al borrar foto');
  },
};
```

### 9.4. Capa de Utilidades (Utils)

Funciones auxiliares puras (sin efectos secundarios, sin estado) que pueden usarse en cualquier parte:

```js
// utils/imageUtils.js

export function formatearFecha(fecha) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric'
  }).format(new Date(fecha));
}

export function redimensionarImagen(dataUrl, maxWidth, maxHeight) {
  // lógica de redimensionado...
}

export function generarNombreUnico(prefijo = 'foto') {
  return `${prefijo}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

---

## 10. Patrones de diseño más usados en React

Los **patrones de diseño** son soluciones probadas a problemas recurrentes. En React hay varios muy populares.

### 10.1. Patrón Compound Components (Componentes Compuestos)

Permite crear componentes que trabajen juntos de forma cohesionada, como HTML nativo (`<select>` y `<option>`).

```jsx
// Ejemplo: un componente Tabs (pestañas)
function Tabs({ children, defaultTab }) {
  const [tabActiva, setTabActiva] = useState(defaultTab);

  return (
    <TabsContext.Provider value={{ tabActiva, setTabActiva }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
}

Tabs.List = function TabList({ children }) {
  return <div className="tab-list">{children}</div>;
};

Tabs.Tab = function Tab({ id, children }) {
  const { tabActiva, setTabActiva } = useContext(TabsContext);
  return (
    <button
      className={tabActiva === id ? 'activo' : ''}
      onClick={() => setTabActiva(id)}
    >
      {children}
    </button>
  );
};

Tabs.Panel = function TabPanel({ id, children }) {
  const { tabActiva } = useContext(TabsContext);
  if (tabActiva !== id) return null;
  return <div className="tab-panel">{children}</div>;
};

// Uso
function App() {
  return (
    <Tabs defaultTab="camara">
      <Tabs.List>
        <Tabs.Tab id="camara">Cámara</Tabs.Tab>
        <Tabs.Tab id="galeria">Galería</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel id="camara"><CamaraView /></Tabs.Panel>
      <Tabs.Panel id="galeria"><GaleriaView /></Tabs.Panel>
    </Tabs>
  );
}
```

### 10.2. Patrón Render Props

Un componente recibe una función como prop que le dice qué renderizar. Permite reutilizar lógica con flexibilidad total en la presentación.

```jsx
// Este componente gestiona la lógica de la cámara
// pero deja al "usuario" del componente decidir qué mostrar
function CamaraProvider({ render }) {
  const camaraData = useCamera(); // contiene toda la lógica
  return render(camaraData);     // el padre decide qué pintar
}

// Uso
function App() {
  return (
    <CamaraProvider
      render={({ videoRef, iniciarCamara, capturarFoto, error }) => (
        <div>
          {error && <p className="error">{error}</p>}
          <video ref={videoRef} />
          <button onClick={iniciarCamara}>Iniciar cámara</button>
          <button onClick={capturarFoto}>📸 Capturar</button>
        </div>
      )}
    />
  );
}
```

> **Nota**: Hoy en día, los Custom Hooks han reemplazado en gran medida a los Render Props, pero es importante conocer el patrón porque lo verás en código existente.

### 10.3. Patrón Higher-Order Component (HOC)

Una función que recibe un componente y devuelve un componente nuevo con capacidades adicionales. Es como un "envoltorio" que añade funcionalidad.

```jsx
// withAuth: un HOC que protege rutas
function withAuth(ComponenteProtegido) {
  return function ComponenteConAuth(props) {
    const { usuario } = useContext(UsuarioContext);

    if (!usuario) {
      return <Navigate to="/login" />;
    }

    return <ComponenteProtegido {...props} />;
  };
}

// Uso
const GaleriaProtegida = withAuth(GaleriaPage);
```

> **Nota**: Al igual que Render Props, los Custom Hooks son preferibles hoy en día para la mayoría de casos, pero los HOCs siguen siendo comunes en librerías.

### 10.4. Patrón Container/Presenter (ya visto en sección 4)

Separar la lógica (Container) de la presentación (Presenter). Es uno de los más fundamentales.

---

## 11. Cuándo usar cada arquitectura

```
┌─────────────────────┬──────────────────────────────────────────────────────┐
│ Tamaño del proyecto │ Arquitectura recomendada                             │
├─────────────────────┼──────────────────────────────────────────────────────┤
│ Muy pequeño         │ Flat (plano): todo en /components, sin subcarpetas  │
│ (1-5 pantallas)     │ Estado: solo useState + lifting state                │
├─────────────────────┼──────────────────────────────────────────────────────┤
│ Pequeño-Mediano     │ Layer-Based: /components, /pages, /hooks, /services │
│ (5-15 pantallas)    │ Estado: useState + Context API                       │
│                     │ Ejemplo: este photobooth                             │
├─────────────────────┼──────────────────────────────────────────────────────┤
│ Mediano-Grande      │ Feature-Based o Atomic Design                        │
│ (15-50 pantallas)   │ Estado: Zustand o Context bien estructurado         │
│                     │ Testing: Jest + React Testing Library                │
├─────────────────────┼──────────────────────────────────────────────────────┤
│ Grande / Enterprise │ Feature-Based + Atomic Design para UI                │
│ (+50 pantallas)     │ Estado: Redux Toolkit o Zustand                      │
│                     │ Testing completo, CI/CD, Storybook                   │
└─────────────────────┴──────────────────────────────────────────────────────┘
```

---

## 12. Ejemplo práctico completo: PhotoBooth App

Aplicando todo lo anterior a este proyecto concreto, aquí está cómo estructuraría la aplicación:

```
src/
│
├── assets/                    ← Imágenes, iconos, fuentes estáticas
│   ├── icons/
│   └── images/
│
├── components/
│   ├── ui/                    ← Átomos/Moléculas: componentes pequeños y genéricos
│   │   ├── Button/
│   │   │   ├── Button.jsx
│   │   │   ├── Button.module.css
│   │   │   └── index.js
│   │   ├── Modal/
│   │   ├── Spinner/
│   │   └── Badge/
│   │
│   ├── layout/                ← Estructura: cómo se organiza la pantalla
│   │   ├── AppLayout.jsx      ← Layout principal (nav + contenido)
│   │   └── CenteredLayout.jsx
│   │
│   ├── camera/                ← Todo lo relacionado con la cámara
│   │   ├── CameraView.jsx     ← Presentación: el visor de la cámara
│   │   ├── CaptureButton.jsx  ← Presentación: botón de captura
│   │   ├── FilterSelector.jsx ← Presentación: selector de filtros
│   │   └── CameraContainer.jsx ← Contenedor: une todo + lógica
│   │
│   ├── gallery/               ← Todo lo relacionado con la galería
│   │   ├── PhotoCard.jsx      ← Presentación: tarjeta de foto
│   │   ├── PhotoGrid.jsx      ← Presentación: cuadrícula de fotos
│   │   ├── PhotoModal.jsx     ← Presentación: modal de foto ampliada
│   │   └── GalleryContainer.jsx ← Contenedor: gestiona estado de galería
│   │
│   └── filters/               ← Componentes de filtros de imagen
│       ├── FilterPreview.jsx
│       └── FilterPanel.jsx
│
├── hooks/                     ← Custom Hooks
│   ├── useCamera.js           ← Lógica de acceso a la cámara
│   ├── useCapture.js          ← Lógica de captura y procesamiento
│   ├── useGallery.js          ← Lógica de la galería (CRUD de fotos)
│   ├── useFilters.js          ← Lógica de aplicación de filtros
│   └── useLocalStorage.js     ← Hook genérico para localStorage
│
├── services/                  ← Comunicación externa
│   ├── storageService.js      ← Guardar/leer fotos en localStorage o IndexedDB
│   └── exportService.js       ← Exportar fotos (download, compartir...)
│
├── utils/                     ← Funciones de utilidad puras
│   ├── imageUtils.js          ← Manipulación de imágenes (canvas, resize...)
│   ├── dateUtils.js           ← Formateo de fechas
│   └── fileUtils.js           ← Manejo de archivos
│
├── constants/                 ← Valores constantes
│   ├── filters.js             ← Lista de filtros disponibles
│   └── config.js              ← Configuración general (tamaños, calidad...)
│
├── context/                   ← Context API (estado global)
│   └── AppContext.jsx         ← Contexto principal (fotos, filtro activo...)
│
├── pages/                     ← Pantallas de la aplicación
│   ├── HomePage.jsx           ← Página principal (cámara)
│   └── GalleryPage.jsx        ← Página de galería
│
├── App.jsx                    ← Componente raíz + rutas
├── main.jsx                   ← Punto de entrada
└── index.css                  ← Estilos globales
```

### Ejemplo de cómo conectaría todo:

```jsx
// context/AppContext.jsx
export const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [fotos, setFotos] = useState([]);
  const [filtroActivo, setFiltroActivo] = useState('ninguno');

  const agregarFoto = (nuevaFoto) => {
    const foto = {
      id: Date.now(),
      url: nuevaFoto,
      fecha: new Date().toISOString(),
      filtro: filtroActivo,
    };
    setFotos(prev => [foto, ...prev]);
  };

  const borrarFoto = (id) => {
    setFotos(prev => prev.filter(f => f.id !== id));
  };

  return (
    <AppContext.Provider value={{ fotos, filtroActivo, setFiltroActivo, agregarFoto, borrarFoto }}>
      {children}
    </AppContext.Provider>
  );
}

// hooks/useCamera.js  (custom hook)
export function useCamera() {
  const videoRef = useRef(null);
  const [activa, setActiva] = useState(false);

  const iniciar = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoRef.current.srcObject = stream;
    setActiva(true);
  };

  const capturar = () => {
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL('image/png');
  };

  return { videoRef, activa, iniciar, capturar };
}

// components/camera/CameraContainer.jsx  (contenedor: lógica)
export function CameraContainer() {
  const { videoRef, activa, iniciar, capturar } = useCamera();
  const { agregarFoto, filtroActivo } = useContext(AppContext);

  const handleCaptura = () => {
    const foto = capturar();
    agregarFoto(foto);
  };

  return (
    <CameraView
      videoRef={videoRef}
      activa={activa}
      filtroActivo={filtroActivo}
      onIniciar={iniciar}
      onCapturar={handleCaptura}
    />
  );
}

// components/camera/CameraView.jsx  (presentación: solo visual)
function CameraView({ videoRef, activa, filtroActivo, onIniciar, onCapturar }) {
  return (
    <div className="camera-view">
      <div className={`video-wrapper filtro-${filtroActivo}`}>
        <video ref={videoRef} autoPlay playsInline />
      </div>
      {!activa
        ? <Button onClick={onIniciar}>Iniciar cámara</Button>
        : <Button onClick={onCapturar} variante="primary">📸 Capturar</Button>
      }
    </div>
  );
}
```

---

## 13. Errores comunes y cómo evitarlos

### ❌ Error 1: Componentes gigantes (God Components)

Un componente que hace todo: fetch de datos, lógica de negocio, gestión de estado compleja y presentación.

**Solución**: Divide en capas. Extrae la lógica a Custom Hooks, la comunicación con APIs a Services, y deja el componente solo con la presentación.

### ❌ Error 2: Prop Drilling excesivo

Pasar una prop por 4 o 5 niveles de componentes intermedios que no la necesitan.

```jsx
// MAL
<App usuario={usuario}>
  <Layout usuario={usuario}>    ← Layout no usa usuario, solo lo pasa
    <Sidebar usuario={usuario}> ← Sidebar no usa usuario, solo lo pasa
      <UserMenu usuario={usuario} /> ← Aquí sí se usa
    </Sidebar>
  </Layout>
</App>
```

**Solución**: Context API o estado global para datos que muchos componentes necesitan.

### ❌ Error 3: Lógica asíncrona directamente en componentes

```jsx
// MAL: el componente hace demasiado
function FotosList() {
  const [fotos, setFotos] = useState([]);
  useEffect(() => {
    fetch('/api/fotos')
      .then(r => r.json())
      .then(data => setFotos(data))
      .catch(err => console.log(err)); // manejo de errores olvidado
  }, []);
  // ...
}
```

**Solución**: Extrae a un Custom Hook y un Service.

```jsx
// BIEN
function FotosList() {
  const { fotos, cargando, error } = useFotos(); // lógica en el hook
  if (cargando) return <Spinner />;
  if (error) return <ErrorMessage mensaje={error} />;
  return <PhotoGrid fotos={fotos} />;
}
```

### ❌ Error 4: No gestionar los estados de carga y error

```jsx
// MAL: no se manejan los estados intermedios
function FotosList() {
  const [fotos, setFotos] = useState([]);
  // ¿Qué mostramos mientras carga? ¿Si hay un error?
}
```

**Solución**: Siempre considera al menos tres estados: **cargando**, **error**, **éxito**.

### ❌ Error 5: Mutar el estado directamente

```jsx
// MAL: mutando el estado directamente
const agregarFoto = (foto) => {
  fotos.push(foto); // ❌ ERROR: nunca mutes el estado directamente
  setFotos(fotos);
};

// BIEN: crear un nuevo array
const agregarFoto = (foto) => {
  setFotos(prev => [...prev, foto]); // ✅ nuevo array con la foto añadida
};
```

### ❌ Error 6: Omitir las keys en listas

```jsx
// MAL
fotos.map(foto => <FotoCard foto={foto} />)

// BIEN: siempre key única y estable
fotos.map(foto => <FotoCard key={foto.id} foto={foto} />)
```

---

## 14. Resumen visual y checklists

### Checklist de un componente bien hecho

- [ ] Tiene una sola responsabilidad
- [ ] Tiene un nombre descriptivo en PascalCase
- [ ] Sus props están bien nombradas y documentadas
- [ ] No hace fetch de datos directamente (usa un hook o un contenedor)
- [ ] Maneja los estados de carga y error si aplica
- [ ] No tiene más de 150-200 líneas (si tiene más, considera dividirlo)
- [ ] Es reutilizable (no tiene lógica muy específica del contexto donde se usa)

### Checklist de estructura de proyecto

- [ ] Los componentes de UI genéricos están en `components/ui/`
- [ ] Cada componente tiene su propia carpeta si tiene CSS o tests asociados
- [ ] La lógica reutilizable está en Custom Hooks en `hooks/`
- [ ] Las llamadas a APIs están en `services/`
- [ ] Las funciones de utilidad están en `utils/`
- [ ] Los valores constantes están en `constants/`
- [ ] Las páginas completas están en `pages/`

### Flujo de datos: la regla de oro

```
API / Datos externos
       ↓
   Services
       ↓
  Custom Hooks
       ↓
 Componentes Contenedores
       ↓
 Componentes de Presentación
       ↓
     Usuario
```

Los datos fluyen **siempre hacia abajo**. Las acciones del usuario (clics, inputs) fluyen **hacia arriba** a través de callbacks (funciones pasadas como props).

---

## Glosario rápido

| Término | Significado simple |
|---|---|
| **Props** | Datos que un componente padre pasa a su hijo |
| **State** | Datos internos de un componente que pueden cambiar |
| **Hook** | Función especial de React que empieza por `use` |
| **Custom Hook** | Hook que tú creas para encapsular lógica reutilizable |
| **Render** | El proceso de React de convertir JSX en HTML visible |
| **Prop Drilling** | Pasar props por muchos niveles intermedios |
| **Side Effect** | Algo que un componente hace "fuera de sí mismo" (fetch, localStorage...) |
| **Callback** | Una función que se pasa como argumento para ser llamada más tarde |
| **Composición** | Construir componentes complejos combinando componentes simples |
| **HOC** | Higher-Order Component: función que recibe y devuelve un componente |
| **Context** | Mecanismo de React para compartir datos sin pasar props manualmente |
| **Lifting State** | Mover el estado al componente padre para compartirlo entre hijos |
| **Refactor** | Reorganizar el código sin cambiar lo que hace, para mejorarlo |
| **Deuda técnica** | Código que funciona pero que es difícil de mantener a largo plazo |
| **Escalabilidad** | La capacidad de un sistema de crecer sin volverse inmanejable |

---

*Documento escrito para el proyecto cuteBooth — Febrero 2026*

---

## 15. Arquitectura Específica de CuteBooth

Esta sección aplica todo lo visto en el documento al proyecto real: **CuteBooth**, un photobooth web construido con React + Vite.

---

### 15.1. Flujo de Pantallas

```
┌─────────────────────────────────────────────────────────┐
│                    HomePage  /                          │
│              Un único botón: "Comenzar"                 │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  LayoutPage  /layout                    │
│     Elige uno de los 3 layouts disponibles              │
│     (disposición de las 4 fotos en el photostrip)       │
└───────────────────────┬─────────────────────────────────┘
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
┌─────────────────┐       ┌──────────────────┐
│  CameraPage     │       │  UploadPage      │
│  /camera        │       │  /upload         │
│                 │       │                  │
│  Cámara web     │       │  Input de        │
│  Cuenta atrás   │       │  archivos        │
│  4 fotos        │       │  4 fotos         │
└────────┬────────┘       └────────┬─────────┘
         │                         │
         └───────────┬─────────────┘
                     ▼
┌─────────────────────────────────────────────────────────┐
│                 DecorationPage  /decoration             │
│  Layout elegido + menú de fondos + menú de stickers     │
│  El usuario arrastra stickers sobre las fotos           │
│  Botón "Finalizar"                                      │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                   FinalPage  /final                     │
│  Resultado final con layout + fotos + fondo + stickers  │
│  Botón "Descargar"  |  Botón "Rehacer" → HomePage       │
└─────────────────────────────────────────────────────────┘
```

---

### 15.2. Estado Global Necesario

La aplicación necesita compartir datos entre páginas que no tienen relación padre-hijo directa. Se usará **Context API + useReducer**.

#### ¿Qué datos viven en el estado global?

```
photoBoothState = {
  selectedLayout: null,      // 'classic' | 'wide' | 'square'
  photos: [],                // Array de 4 dataURLs o Blob URLs
  background: null,          // string con el id del fondo elegido
  stickers: [],              // Array de { id, src, x, y, width, height }
  source: null,              // 'camera' | 'upload' — de dónde vienen las fotos
}
```

#### ¿Por qué `useReducer` en vez de `useState`?

Porque el estado tiene varias partes que se actualizan juntas de forma relacionada. `useReducer` centraliza todas las transformaciones del estado en un único lugar y lo hace más predecible.

```jsx
// context/PhotoBoothContext.jsx

const initialState = {
  selectedLayout: null,
  photos: [],
  background: null,
  stickers: [],
  source: null,
};

function photoBoothReducer(state, action) {
  switch (action.type) {
    case 'SET_LAYOUT':
      return { ...state, selectedLayout: action.payload };
    case 'SET_SOURCE':
      return { ...state, source: action.payload };
    case 'ADD_PHOTO':
      return { ...state, photos: [...state.photos, action.payload] };
    case 'SET_PHOTOS':
      return { ...state, photos: action.payload };
    case 'SET_BACKGROUND':
      return { ...state, background: action.payload };
    case 'ADD_STICKER':
      return { ...state, stickers: [...state.stickers, action.payload] };
    case 'MOVE_STICKER':
      return {
        ...state,
        stickers: state.stickers.map(s =>
          s.id === action.payload.id ? { ...s, ...action.payload } : s
        ),
      };
    case 'REMOVE_STICKER':
      return { ...state, stickers: state.stickers.filter(s => s.id !== action.payload) };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export const PhotoBoothContext = createContext(null);

export function PhotoBoothProvider({ children }) {
  const [state, dispatch] = useReducer(photoBoothReducer, initialState);
  return (
    <PhotoBoothContext.Provider value={{ state, dispatch }}>
      {children}
    </PhotoBoothContext.Provider>
  );
}

// Hook de conveniencia para no repetir useContext(PhotoBoothContext) en cada componente
export function usePhotoBooth() {
  return useContext(PhotoBoothContext);
}
```

---

### 15.3. Rutas con React Router

```jsx
// App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <PhotoBoothProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"           element={<HomePage />} />
          <Route path="/layout"     element={<LayoutPage />} />
          <Route path="/camera"     element={<CameraPage />} />
          <Route path="/upload"     element={<UploadPage />} />
          <Route path="/decoration" element={<DecorationPage />} />
          <Route path="/final"      element={<FinalPage />} />
        </Routes>
      </BrowserRouter>
    </PhotoBoothProvider>
  );
}
```

> **Guard de ruta**: Si el usuario entra directamente a `/decoration` sin haber elegido layout ni fotos, hay que redirigirle al inicio. Se implementa comprobando `state.selectedLayout` y `state.photos.length` al montar el componente.

---

### 15.4. Estructura de Carpetas

```
src/
│
├── pages/                    ← Una carpeta/archivo por pantalla
│   ├── HomePage.jsx
│   ├── LayoutPage.jsx
│   ├── CameraPage.jsx
│   ├── UploadPage.jsx
│   ├── DecorationPage.jsx
│   └── FinalPage.jsx
│
├── components/               ← Componentes reutilizables organizados por dominio
│   ├── ui/                   ← Átomos y moléculas genéricas
│   │   ├── Button.jsx
│   │   ├── CountdownTimer.jsx
│   │   └── ProgressDots.jsx
│   │
│   ├── layout/               ← Todo lo relacionado con la elección de layout
│   │   ├── LayoutCard.jsx    ← Tarjeta individual de cada layout
│   │   └── LayoutGrid.jsx    ← Los 3 layouts en cuadrícula
│   │
│   ├── camera/               ← Componentes de la página de cámara
│   │   ├── VideoPreview.jsx  ← El <video> con el stream
│   │   ├── PhotoCounter.jsx  ← "Foto 1 de 4"
│   │   └── CaptureButton.jsx
│   │
│   ├── upload/               ← Componentes de la página de subida
│   │   ├── FileDropZone.jsx
│   │   └── PhotoThumbnail.jsx
│   │
│   ├── decoration/           ← Componentes del editor de decoración
│   │   ├── DecorationCanvas.jsx  ← El <canvas> principal
│   │   ├── StickerPanel.jsx      ← Panel lateral de stickers
│   │   └── BackgroundPanel.jsx   ← Panel lateral de fondos
│   │
│   └── final/                ← Componentes de la pantalla final
│       └── PhotoResult.jsx   ← Muestra la imagen final renderizada
│
├── hooks/                    ← Custom Hooks: lógica reutilizable
│   ├── usePhotoBooth.js      ← Re-exporta el hook del contexto (conveniente)
│   ├── useCamera.js          ← getUserMedia, countdown, captura
│   ├── useCanvas.js          ← Composición de fotos + layout en el canvas
│   └── useStickers.js        ← Lógica de drag & drop de stickers
│
├── context/
│   └── PhotoBoothContext.jsx ← Estado global (reducer + provider + hook)
│
├── services/
│   └── storageService.js     ← Abstracción de IndexedDB / sessionStorage
│
├── utils/
│   ├── canvasUtils.js        ← drawPhotoStrip, applyLayout, composeFinal
│   └── imageUtils.js        ← redimensionar, convertir formatos
│
├── constants/
│   ├── layouts.js            ← Definición de los 3 layouts (coordenadas, proporciones)
│   ├── stickers.js           ← Lista de stickers disponibles
│   └── backgrounds.js        ← Lista de fondos disponibles
│
└── assets/
    ├── stickers/
    ├── backgrounds/
    └── frames/
```
```
PascalCase    → Componentes React:     Button.jsx, UserCard.jsx
camelCase     → Hooks y utilidades:    useCamera.js, formatDate.js
kebab-case    → Archivos CSS globales: global-styles.css
SCREAMING     → Constantes:            MAX_FILE_SIZE, API_URL
```

---

### 15.5. Custom Hooks Principales

#### `useCamera.js`

Encapsula toda la interacción con la cámara del navegador.

```js
// hooks/useCamera.js
export function useCamera() {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [countdown, setCountdown] = useState(null);  // null | 3 | 2 | 1

  const start = async () => {
    const s = await navigator.mediaDevices.getUserMedia({ video: true });
    videoRef.current.srcObject = s;
    setStream(s);
  };

  const stop = () => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
  };

  const captureWithCountdown = (onCapture) => {
    // Lanza cuenta atrás 3→2→1, luego llama onCapture con el dataURL
  };

  return { videoRef, stream, countdown, start, stop, captureWithCountdown };
}
```

#### `useCanvas.js`

Encapsula la composición final del canvas (layout + fotos + fondo + stickers).

```js
// hooks/useCanvas.js
export function useCanvas(canvasRef) {
  const draw = useCallback(({ photos, layout, background, stickers }) => {
    const ctx = canvasRef.current.getContext('2d');
    // 1. Dibuja el fondo
    // 2. Dibuja las fotos según el layout
    // 3. Dibuja los stickers encima
  }, [canvasRef]);

  const exportAsBlob = () => new Promise(resolve => canvasRef.current.toBlob(resolve, 'image/png'));

  return { draw, exportAsBlob };
}
```

#### `useStickers.js`

Encapsula el drag & drop de stickers sobre el canvas.

```js
// hooks/useStickers.js
export function useStickers(canvasRef) {
  const { state, dispatch } = usePhotoBooth();
  const dragRef = useRef({ active: false, stickerId: null, offsetX: 0, offsetY: 0 });

  const getScaledPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const onPointerDown = (e) => { /* identifica sticker tocado y guarda offset */ };
  const onPointerMove = (e) => { /* mueve el sticker y dispara MOVE_STICKER */ };
  const onPointerUp  = ()  => { /* limpia dragRef */ };

  return { onPointerDown, onPointerMove, onPointerUp };
}
```

---

### 15.6. Flujo de Datos entre Páginas

```
HomePage
  └─ onClick "Comenzar" → navigate('/layout')

LayoutPage
  └─ onClick en un layout → dispatch({ type: 'SET_LAYOUT', payload: 'classic' })
                          → navigate('/camera') o navigate('/upload')

CameraPage
  └─ useCamera() → captureWithCountdown() → dispatch({ type: 'ADD_PHOTO', payload: dataURL })
  └─ cuando photos.length === 4 → navigate('/decoration')

UploadPage
  └─ input onChange → FileReader / createObjectURL
                    → dispatch({ type: 'SET_PHOTOS', payload: [url1, url2, url3, url4] })
  └─ cuando 4 fotos seleccionadas → navigate('/decoration')

DecorationPage
  └─ lee state.photos + state.selectedLayout desde el contexto
  └─ dispatch SET_BACKGROUND cuando el usuario elige fondo
  └─ dispatch ADD_STICKER / MOVE_STICKER al interactuar con el canvas
  └─ onClick "Finalizar" → navigate('/final')

FinalPage
  └─ useCanvas() → draw(state) → renderiza el resultado final
  └─ onClick "Descargar" → exportAsBlob() → descarga automática
  └─ onClick "Rehacer" → dispatch({ type: 'RESET' }) → navigate('/')
```

---

### 15.7. Definición de los Layouts (constants/layouts.js)

Cada layout define cómo se posicionan las 4 fotos dentro del canvas final. Las coordenadas son relativas al tamaño del canvas (p.ej. 600×1800px).

```js
// constants/layouts.js

export const CANVAS_WIDTH  = 600;
export const CANVAS_HEIGHT = 1800;

export const LAYOUTS = {
  classic: {
    label: 'Clásico',
    // 4 fotos apiladas verticalmente, con bordes blancos
    slots: [
      { x: 30, y: 30,   width: 540, height: 400 },
      { x: 30, y: 460,  width: 540, height: 400 },
      { x: 30, y: 890,  width: 540, height: 400 },
      { x: 30, y: 1320, width: 540, height: 400 },
    ],
  },
  wide: {
    label: 'Panorámico',
    // 2 fotos arriba (lado a lado) + 2 fotos abajo (lado a lado)
    slots: [
      { x: 15,  y: 30,   width: 270, height: 380 },
      { x: 315, y: 30,   width: 270, height: 380 },
      { x: 15,  y: 440,  width: 270, height: 380 },
      { x: 315, y: 440,  width: 270, height: 380 },
    ],
  },
  square: {
    label: 'Cuadrado',
    // 1 foto grande arriba + 3 fotos pequeñas abajo
    slots: [
      { x: 30, y: 30,   width: 540, height: 540 },
      { x: 30, y: 600,  width: 170, height: 170 },
      { x: 215, y: 600, width: 170, height: 170 },
      { x: 400, y: 600, width: 170, height: 170 },
    ],
  },
};
```

---

### 15.8. Resumen: Qué Herramienta para Qué Problema

| Problema | Solución elegida | Alternativa descartada |
|---|---|---|
| Compartir `photos`, `layout`, `stickers` entre páginas | Context API + useReducer | Props drilling (impracticable entre rutas) |
| Navegar entre pantallas | React Router v6 | `window.location.href` (recargaría la app) |
| Acceso a la cámara | Custom Hook `useCamera` | Lógica inline en `CameraPage` (imposible reutilizar) |
| Composición del canvas | Custom Hook `useCanvas` | Inline en `DecorationPage` (mezclaría UI y lógica) |
| Drag & drop de stickers | Custom Hook `useStickers` | Librería externa (innecesaria, añade peso) |
| Guardado temporal de imágenes | `sessionStorage` (o IndexedDB si son muchas) | `localStorage` (límite 5MB, puede fallar) |
| Configuración de layouts | Objeto constante en `constants/layouts.js` | Hardcoded en el componente (difícil de cambiar) |

---

### 15.9. Guard de Rutas: Proteger Pantallas

Si el usuario entra directamente a `/decoration` o `/final` sin seguir el flujo, hay que redirigirle.

```jsx
// Ejemplo en DecorationPage.jsx
import { useNavigate } from 'react-router-dom';
import { usePhotoBooth } from '../context/PhotoBoothContext';

function DecorationPage() {
  const { state } = usePhotoBooth();
  const navigate = useNavigate();

  useEffect(() => {
    // Guard: si no hay layout elegido o no hay 4 fotos, volver al inicio
    if (!state.selectedLayout || state.photos.length < 4) {
      navigate('/', { replace: true });
    }
  }, []);

  // ... resto del componente
}
```

---

### 15.10. Diagrama de Dependencias entre Capas

```
┌──────────────────────────────────────────────────────────┐
│  PÁGINAS (pages/)                                        │
│  HomePage · LayoutPage · CameraPage · UploadPage         │
│  DecorationPage · FinalPage                              │
│        │ usan                                            │
├────────▼─────────────────────────────────────────────────┤
│  COMPONENTES (components/)                               │
│  ui/ · layout/ · camera/ · upload/ · decoration/ · final/│
│        │ usan                                            │
├────────▼─────────────────────────────────────────────────┤
│  HOOKS (hooks/)                                          │
│  useCamera · useCanvas · useStickers                     │
│        │ usan                                            │
├────────▼───────────────┬─────────────────────────────────┤
│  CONTEXTO (context/)   │  SERVICIOS (services/)           │
│  PhotoBoothContext     │  storageService                  │
│        │ usa           │         │ usa                   │
├────────▼───────────────▼─────────▼───────────────────────┤
│  BASE: utils/ · constants/ · assets/                     │
│  canvasUtils · imageUtils · layouts · stickers · bgr     │
└──────────────────────────────────────────────────────────┘
```

La regla es siempre la misma: **las capas superiores dependen de las inferiores, nunca al revés**.
