// app/+html.tsx
// Plantilla HTML de la build web (Expo Router). Solo afecta a la web; las apps
// nativas iOS/Android ignoran este archivo.
//
// Google Tag Manager (GTM-WKH29VMH) con Google Consent Mode v2:
// - GTM se carga siempre (el verificador de Google lo detecta).
// - El consentimiento arranca en 'denied' → GA funciona sin cookies hasta que
//   el usuario acepte en el CookieBanner (RGPD: sin tracking previo al consentimiento).
// - Si el usuario ya aceptó en una visita anterior, se concede al cargar.
import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

const GTM_ID = 'GTM-WKH29VMH';

// Se ejecuta antes que GTM: define dataLayer/gtag y el consentimiento por defecto.
const consentInitScript = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  wait_for_update: 500
});
try {
  if (localStorage.getItem('cookie_consent') === 'accepted') {
    gtag('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted'
    });
  }
} catch (e) {}
`;

const gtmLoaderScript = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        {/* Google Consent Mode v2 — debe ir ANTES de cargar GTM */}
        <script dangerouslySetInnerHTML={{ __html: consentInitScript }} />
        {/* Google Tag Manager */}
        <script dangerouslySetInnerHTML={{ __html: gtmLoaderScript }} />
        {/* End Google Tag Manager */}

        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        {/*
          Disable body scrolling on web so the app behaves like a native app.
          Quitar si se quiere que <body> sea desplazable.
        */}
        <ScrollViewStyleReset />
      </head>
      <body>
        {/* Google Tag Manager (noscript) — justo después de <body> */}
        <noscript
          dangerouslySetInnerHTML={{
            __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
          }}
        />
        {/* End Google Tag Manager (noscript) */}

        {children}
      </body>
    </html>
  );
}
