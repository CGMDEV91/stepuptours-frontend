// lib/mem-cache.ts
// Caché en memoria con TTL para respuestas idempotentes (listados, taxonomías).
// Reduce llamadas a la API repetidas dentro de la misma sesión sin tocar backend.
// Es efímera por diseño: se pierde al recargar la app.

interface Entry {
  value: unknown;
  expiresAt: number;
}

const _store = new Map<string, Entry>();

// Devuelve el valor cacheado si está vigente; si no, ejecuta `fn`, lo cachea y lo
// devuelve. Las llamadas concurrentes con la misma clave NO se deduplican aquí
// (se asume que los stores ya evitan peticiones solapadas).
export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = _store.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }
  const value = await fn();
  _store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

// Invalida entradas cuya clave empieza por `prefix` (o todo si se omite).
export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    _store.clear();
    return;
  }
  for (const k of [..._store.keys()]) {
    if (k.startsWith(prefix)) _store.delete(k);
  }
}
