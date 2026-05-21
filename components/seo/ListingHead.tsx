// components/seo/ListingHead.tsx
// SEO head tags for the tour listing / home page — web-only.

import { Platform } from 'react-native';
import Head from 'expo-router/head';
import { useTranslation } from 'react-i18next';

import { SUPPORTED_LANGS } from '../../lib/supported-langs';

const SITE = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://stepuptours.com';
const OG_IMAGE = `${SITE}/og-default.jpg`;

interface ListingHeadProps {
  langcode: string;
  /** Active language codes from the language store. Falls back to SUPPORTED_LANGS
   *  during static prerender (store is empty in Node). After hydration the
   *  client re-renders with the real list fetched from Drupal. */
  langs?: readonly string[];
}

export function ListingHead({ langcode, langs }: ListingHeadProps) {
  if (Platform.OS !== 'web') return null;
  const activeLangs = langs && langs.length > 0 ? langs : SUPPORTED_LANGS;

  const { t } = useTranslation();
  const title = t(
    'seo.listingTitle',
    'Free tours & self-guided city walks worldwide | StepUp Tours',
  );
  const description = t(
    'seo.listingDescription',
    'Explore self-guided city tours worldwide. Walk at your own pace, discover hidden gems, and earn rewards.',
  );
  const canonical = `${SITE}/${langcode}`;

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:site_name" content="StepUp Tours" />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:image:width" content="1920" />
      <meta property="og:image:height" content="1080" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:image" content={OG_IMAGE} />

      {activeLangs.map((lang) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={`${SITE}/${lang}`} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={`${SITE}/en`} />
    </Head>
  );
}
