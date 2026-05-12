// components/seo/PageHead.tsx
// Generic canonical + title head for simple public pages — web-only.

import { Platform } from 'react-native';
import Head from 'expo-router/head';

const SITE = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://stepuptours.com';

interface PageHeadProps {
  langcode: string;
  path: string;
  title: string;
}

export function PageHead({ langcode, path, title }: PageHeadProps) {
  if (Platform.OS !== 'web') return null;
  const canonical = `${SITE}/${langcode}/${path}`;
  return (
    <Head>
      <title>{title} — StepUp Tours</title>
      <link rel="canonical" href={canonical} />
    </Head>
  );
}
