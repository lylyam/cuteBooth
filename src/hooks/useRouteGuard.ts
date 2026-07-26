/**
 * Route guards — see docs/contracts/state.md, "Guards de ruta · nodo S3".
 *
 * This is a hook, not a wrapping component: the page decides where to call it,
 * and no extra layer is added to the tree. It never navigates on its own — it
 * returns a `<Navigate />` element for the page to `return` directly, or
 * `null` when the page is free to render normally.
 *
 * ```tsx
 * function CameraPage() {
 *   const redirect = useRouteGuard('layout');
 *   if (redirect) return redirect;
 *
 *   return <PageShell>...</PageShell>;
 * }
 * ```
 *
 * | Route                               | Call                              |
 * | ------------------------------------ | ---------------------------------- |
 * | `/`, `/layout`                       | (don't call the hook)              |
 * | `/camera`, `/upload`                 | `useRouteGuard('layout')`          |
 * | `/review`, `/decoration`, `/final`   | `useRouteGuard('layoutAndPhotos')` |
 */
import { createElement } from 'react';
import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { usePhotoBooth } from '../context/PhotoBoothContext';

export type RouteGuardRequirement = 'layout' | 'layoutAndPhotos';

export function useRouteGuard(requirement: RouteGuardRequirement): ReactElement | null {
  const { state } = usePhotoBooth();

  const hasLayout = state.selectedLayout !== null;
  const hasFourPhotos = state.photos.length === 4;

  const isSatisfied = requirement === 'layout' ? hasLayout : hasLayout && hasFourPhotos;

  if (isSatisfied) {
    return null;
  }

  // `/final` deliberately does not require `frame`, `background` or
  // `stickers`: decorating is optional, and `/decoration` can be crossed
  // without picking anything. This guard is not where taste gets enforced.
  return createElement(Navigate, { to: '/', replace: true });
}
