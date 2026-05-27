// lib/roles.ts
// Helpers de detección de rol. Reemplazan las verificaciones inline
// `user?.roles?.includes(...)` repetidas a lo largo del código.
//
// Mantén aquí la lista canónica de roles y sus combinaciones. Si añadimos un
// nuevo rol Drupal, basta con ajustar este archivo.

import type { User } from '../types';

export function isAdmin(user?: User | null): boolean {
  return !!user?.roles?.includes('administrator');
}

/**
 * Un "guía" en términos de UX es cualquier usuario con permiso para crear y
 * gestionar tours. Drupal usa históricamente dos roles equivalentes:
 * `guide` (el actual) y `professional` (legacy, aún presente en algunos
 * usuarios). Tratamos ambos como guía.
 */
export function isGuide(user?: User | null): boolean {
  const roles = user?.roles ?? [];
  return roles.includes('guide') || roles.includes('professional');
}

export function isBusiness(user?: User | null): boolean {
  return !!user?.roles?.includes('business');
}

/**
 * Usuario con acceso al back-office del guía (dashboard de tours, payouts,
 * suscripción). Hoy es simplemente "es guía"; lo mantenemos como helper aparte
 * por si en el futuro queremos diferenciar (p.ej. guía con plan inactivo).
 */
export function canAccessGuideDashboard(user?: User | null): boolean {
  return isGuide(user);
}
