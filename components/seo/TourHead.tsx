// components/seo/TourHead.tsx
// SEO head tags for tour detail pages — web-only, no-op on native.

import { Platform } from 'react-native';
import Head from 'expo-router/head';
import { buildTourSlug } from '../../lib/tour-slug';
import { buildTourJsonLd } from '../../lib/tour-jsonld';
import type { Tour } from '../../types';

const SITE = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://stepuptours.com';
const SUPPORTED_LANGS = ['es', 'en', 'fr', 'de', 'it', 'el'];

interface TourHeadProps {
  tour: Tour;
  langcode: string;
}

export function TourHead({ tour, langcode }: TourHeadProps) {
  if (Platform.OS !== 'web') return null;

  const slug = buildTourSlug({
    country: tour.country?.name,
    city: tour.city?.name,
    nid: tour.drupalInternalId,
  });
  const canonical = `${SITE}/${langcode}/tour/${slug}`;
  const title = `${tour.title} — StepUp Tours`;
  const rawDesc = tour.description?.replace(/<[^>]+>/g, '').trim() ?? '';
  const description = rawDesc.slice(0, 160) ||
    `${tour.title} en ${tour.city?.name ?? ''}, ${tour.country?.name ?? ''}`;
  const image = tour.image ?? `${SITE}/og-default.jpg`;
  const jsonLd = buildTourJsonLd(tour, canonical, langcode);

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={canonical} />
      <meta property="og:site_name" content="StepUp Tours" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* hreflang: translated slug for current lang, nid-fallback for others */}
      {SUPPORTED_LANGS.map((lang) => (
        <link
          key={lang}
          rel="alternate"
          hrefLang={lang}
          href={`${SITE}/${lang}/tour/${lang === langcode ? slug : `tour-${tour.drupalInternalId}`}`}
        />
      ))}
      <link
        rel="alternate"
        hrefLang="x-default"
        href={`${SITE}/en/tour/tour-${tour.drupalInternalId}`}
      />

      {jsonLd.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Head>
  );
}
