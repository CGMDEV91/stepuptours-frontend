// lib/gtm.ts
// Inyección de Google Tag Manager en el cliente (solo web).
//
// La plantilla app/+html.tsx no se aplica de forma fiable con web.output:"single",
// así que GTM se carga en runtime desde aquí. Es idempotente: si +html.tsx ya
// hubiera cargado GTM, detecta el script existente y no lo duplica.
//
// Incluye Google Consent Mode v2: el consentimiento arranca denegado (RGPD) y
// se concede al aceptar el CookieBanner (ver lib/consent.ts).
const GTM_ID = 'GTM-WKH29VMH';

// Hosts donde sí queremos cargar GTM/GA. Cualquier otro (localhost, *.pages.dev
// de preview, túneles ngrok, etc.) queda excluido para no contaminar las
// métricas de producción con tráfico de desarrollo.
const GTM_ALLOWED_HOSTS = new Set(['stepuptours.com', 'www.stepuptours.com']);

export function initGtm(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  if (!GTM_ALLOWED_HOSTS.has(window.location.hostname)) return;

  const w = window as any;
  if (w.__gtmInit) return;
  w.__gtmInit = true;

  // Si +html.tsx ya inyectó GTM, no hacer nada.
  if (document.querySelector('script[src*="googletagmanager.com/gtm.js"]')) return;

  w.dataLayer = w.dataLayer || [];
  if (typeof w.gtag !== 'function') {
    w.gtag = function () {
      w.dataLayer.push(arguments);
    };
  }

  // Consent Mode v2 — denegado por defecto, antes de cargar GTM.
  w.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500,
  });

  // Si el usuario ya aceptó en una visita anterior, conceder de inmediato.
  try {
    if (localStorage.getItem('cookie_consent') === 'accepted') {
      w.gtag('consent', 'update', {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
        analytics_storage: 'granted',
      });
    }
  } catch (e) {
    // localStorage no disponible — se mantiene denegado.
  }

  w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM_ID;
  document.head.insertBefore(script, document.head.firstChild);
}
