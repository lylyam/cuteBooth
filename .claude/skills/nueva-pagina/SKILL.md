---
name: nueva-pagina
description: Crea una página nueva de CuteBooth con el patrón PageShell + WebAppOldStyle,
  su CSS Module, su guard de ruta y su alta en App.tsx. Úsala al implementar cualquiera
  de las pantallas pendientes (/camera, /upload, /review, /decoration, /final) o al
  añadir una nueva.
---

# Página nueva

Este procedimiento se repite cinco veces. Sigue el orden: cada paso depende del anterior.

## 0. Antes de tocar nada

Lee **el spec de la pantalla** en `specs/<pantalla>.md`. Contiene el copy literal de
Figma, el criterio de aceptación y — lo más importante — la sección **SUPUESTOS** con lo
que el diseño no dice. Si vas a decidir algo que no está ahí, añádelo a esa sección.

Lee también `src/pages/layoutPage/LayoutPage.tsx`: es la **implementación de referencia**
del patrón. No inventes una variante.

## 1. Los ficheros

```
src/pages/<nombre>Page/
├── <Nombre>Page.tsx
└── <Nombre>Page.module.css
```

Una carpeta por ruta, el CSS junto al TSX. Si la pantalla necesita piezas propias, van a
`src/components/<dominio>/` (por ejemplo `components/camera/`), **no** a `components/ui/`,
que es solo para lo genérico y reutilizable.

## 2. El esqueleto

```tsx
import { useNavigate } from 'react-router-dom';
import PageShell from '../../components/layouts/PageShell';
import WebAppOldStyle from '../../components/layouts/WebAppOldStyle';
import { usePhotoBooth } from '../../context/PhotoBoothContext';
import useRouteGuard from '../../hooks/useRouteGuard';
import styles from './<Nombre>Page.module.css';

function <Nombre>Page() {
  const navigate = useNavigate();
  const { state, dispatch } = usePhotoBooth();
  const redirect = useRouteGuard('/<ruta>');

  if (redirect) return redirect;          // el guard sale del return, nunca de un efecto

  return (
    <PageShell>
      <WebAppOldStyle className={styles.window} contentClassName={styles.windowContent}>
        {/* contenido */}
      </WebAppOldStyle>

      {/* los modales son HERMANOS de WebAppOldStyle, dentro de PageShell */}
    </PageShell>
  );
}

export default <Nombre>Page;
```

## 3. El guard

Toda ruta que no sea `/` ni `/layout` exige estado previo. La tabla está en
`docs/contracts/state.md` §Guards. Requisito incumplido → `<Navigate to="/" replace />`.
Con `replace`, o el botón atrás crea un bucle.

## 4. El CSS

- Los valores visuales **van por token** de `:root` (hay 21, catalogados en
  `docs/contracts/design-tokens.md`). Ni un color, radio o grosor de borde literal.
- Si la pantalla tiene nodo de Figma, **el CSS no es tuyo**: lo produce
  `figma-design-sync` en el lote D3-D7. Consume sus clases.
- Breakpoints: solo `640px`, `768px`, `900px`. `var()` no funciona en `@media`.

## 5. El alta de la ruta

`src/App.tsx` **lo toca solo el orquestador**. Es el registro de rutas y lo necesita cada
feature; centralizarlo elimina el único conflicto estructural del proyecto.

Al descomentar la ruta, **descomenta también su import**. No se dejan imports muertos ni
rutas apuntando a un fichero de 0 bytes.

## 6. Antes de decir que está hecho

- [ ] `npm run build` limpio — es la única puerta automática, no hay tests
- [ ] `npm run lint` limpio
- [ ] Entrar en frío a la ruta redirige a `/`
- [ ] Todo el texto de usuario en **inglés**, incluidos los `alt`
- [ ] Ni `getUserMedia`, ni `canvas.getContext`, ni `sessionStorage` en el componente:
      eso vive en `hooks/`, `utils/` o `services/`
- [ ] La checklist de aceptación del spec, marcada punto por punto
- [ ] Los supuestos nuevos, escritos en el spec

## Lo que esta skill no hace

No escribe hooks (son de `canvas-media`), ni CSS con origen en Figma (de
`figma-design-sync`), ni acciones del reducer (de `booth-state`). Si te falta una de esas
piezas, el nodo no está listo: dilo en lugar de improvisarla.
