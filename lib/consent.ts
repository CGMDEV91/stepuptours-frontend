// lib/consent.ts
// Actualiza el estado de Google Consent Mode v2 según la decisión del usuario
// en el CookieBanner. Solo tiene efecto en web (donde existe window.gtag);
// en nativo no hace nada.
export function updateAnalyticsConsent(granted: boolean): void {
  if (typeof window === 'undefined') return;
  const gtag = (window as any).gtag;
  if (typeof gtag !== 'function') return;

  const value = granted ? 'granted' : 'denied';
  gtag('consent', 'update', {
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value,
  });
}
