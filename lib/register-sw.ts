// lib/register-sw.ts
// Registra el service worker del build web (public/sw.js). No-op fuera de web.

import { Platform } from 'react-native';

export function registerServiceWorker(): void {
  if (Platform.OS !== 'web') return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (typeof window === 'undefined') return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // No crítico: la app funciona igual sin caché del service worker.
    });
  });
}
