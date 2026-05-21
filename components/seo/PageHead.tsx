// components/seo/PageHead.tsx
// Canonical + meta + OpenGraph head for simple public pages — web-only.

import { Platform } from 'react-native';
import Head from 'expo-router/head';
import { SUPPORTED_LANGS } from '../../lib/supported-langs';

const SITE = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://stepuptours.com';
const OG_IMAGE = `${SITE}/og-default.jpg`;

interface PageHeadProps {
  langcode: string;
  path: string;
  title: string;
  description?: string;
  /** Active language codes from the language store. Falls back to SUPPORTED_LANGS
   *  during static prerender (store is empty in Node). After hydration the
   *  client re-renders with the real list fetched from Drupal. */
  langs?: readonly string[];
}

export function PageHead({ langcode, path, title, description, langs }: PageHeadProps) {
  if (Platform.OS !== 'web') return null;
  const fullTitle = `${title} — StepUp Tours`;
  const canonical = `${SITE}/${langcode}/${path}`;
  const activeLangs = langs && langs.length > 0 ? langs : SUPPORTED_LANGS;

  return (
    <Head>
      <title>{fullTitle}</title>
      {description ? <meta name="description" content={description} /> : null}
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      {description ? (
        <meta property="og:description" content={description} />
      ) : null}
      <meta property="og:url" content={canonical} />
      <meta property="og:site_name" content="StepUp Tours" />
      <meta property="og:image" content={OG_IMAGE} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description ? (
        <meta name="twitter:description" content={description} />
      ) : null}
      <meta name="twitter:image" content={OG_IMAGE} />

      {activeLangs.map((lang) => (
        <link
          key={lang}
          rel="alternate"
          hrefLang={lang}
          href={`${SITE}/${lang}/${path}`}
        />
      ))}
      <link rel="alternate" hrefLang="x-default" href={`${SITE}/en/${path}`} />
    </Head>
  );
}
