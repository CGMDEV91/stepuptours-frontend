// hooks/useIsHydrated.ts
// Devuelve `false` durante el primer render (igual que el HTML pre-renderizado en
// el build estático, donde no hay `window`) y `true` tras montar en el cliente.
//
// Úsalo para diferir cualquier decisión de render que dependa de APIs del navegador
// (p.ej. `useWindowDimensions`). Si el árbol del primer render del cliente difiere
// del HTML del servidor, React lanza errores de hidratación (#418/#422/#425) y
// descarta el HTML del servidor. El prerender no tiene ventana, así que renderiza
// el layout "móvil" (width pequeño); mantener ese mismo árbol en el primer paint
// del cliente evita el mismatch.

import { useEffect, useState } from 'react';

export function useIsHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
