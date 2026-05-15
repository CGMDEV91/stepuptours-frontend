// components/seo/ListingHead.tsx
// SEO head tags for the tour listing / home page — web-only.

import { Platform } from 'react-native';
import Head from 'expo-router/head';
import { useTranslation } from 'react-i18next';

const SITE = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://stepuptours.com';
const SUPPORTED_LANGS = ['es', 'en', 'fr', 'de', 'it', 'el'];
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1920&q=80';

interface ListingHeadProps {
  langcode: string;
}

export function ListingHead({ langcode }: ListingHeadProps) {
  if (Platform.OS !== 'web') return null;

  const { t } = useTranslation();
  const title = 'StepUp Tours — Discover City Tours';
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
      <meta property="og:image" content={HERO_IMAGE} />
      <meta property="og:image:width" content="1920" />
      <meta property="og:image:height" content="1080" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:image" content={HERO_IMAGE} />

      {SUPPORTED_LANGS.map((lang) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={`${SITE}/${lang}`} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={`${SITE}/en`} />
    </Head>
  );
}
