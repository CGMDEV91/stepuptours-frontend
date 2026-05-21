// lib/supported-langs.ts
// Single source of truth for the supported language list.
//
// Used as:
//  1. Build-time fallback in generateStaticParams (if Drupal is unreachable).
//  2. Build-time fallback in generate-sitemap.ts (if Drupal is unreachable).
//  3. Client-side hreflang links in SEO Head components.
//
// When adding a new language:
//  • Enable it in Drupal → it will be picked up automatically on the next build
//    (generateStaticParams and generate-sitemap fetch from Drupal first).
//  • Add it here too → keeps the fallback and the hreflang components in sync.
//  • Add a locale file under i18n/locales/<code>.json.

export const SUPPORTED_LANGS = ['es', 'en', 'fr', 'de', 'it', 'el'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];
