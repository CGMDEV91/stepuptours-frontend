// scripts/generate-sitemap.ts
// Fetches all published tours from Drupal and generates public/sitemap.xml.
// Run before the web build: npm run sitemap
// Or automatically via: npm run build:web

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://stepuptours.com';
const DRUPAL_URL = process.env.DRUPAL_URL ?? 'https://stepuptours.com';
const LANGUAGES = ['es', 'en', 'fr', 'de', 'it', 'el'];
const PAGE_LIMIT = 100;

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildSlug(country: string | null, city: string | null, nid: number): string {
  const parts: string[] = [];
  if (country) parts.push(slugify(country));
  if (city) parts.push(slugify(city));
  if (parts.length === 0) parts.push('tour');
  parts.push(String(nid));
  return parts.join('-');
}

interface TourEntry {
  nid: number;
  city: string | null;
  country: string | null;
  changed: string | null;
}

async function fetchToursForLang(langcode: string): Promise<TourEntry[]> {
  const prefix = langcode === 'en' ? '' : `/${langcode}`;
  const fields =
    'fields[node--tour]=drupal_internal__nid,changed' +
    '&include=field_city,field_country' +
    '&fields[taxonomy_term--cities]=name' +
    '&fields[taxonomy_term--countries]=name';

  const all: TourEntry[] = [];
  let offset = 0;

  while (true) {
    const url =
      `${DRUPAL_URL}${prefix}/jsonapi/node/tour` +
      `?filter[status]=1&${fields}&page[limit]=${PAGE_LIMIT}&page[offset]=${offset}`;

    const resp = await axios.get(url, { headers: { Accept: 'application/vnd.api+json' } });
    const nodes: any[] = resp.data?.data ?? [];
    const included: any[] = resp.data?.included ?? [];

    for (const node of nodes) {
      const nid: number = node.attributes?.drupal_internal__nid;
      const changed: string | null = node.attributes?.changed ?? null;
      const cityId = node.relationships?.field_city?.data?.id;
      const countryId = node.relationships?.field_country?.data?.id;
      const city = included.find((i) => i.id === cityId)?.attributes?.name ?? null;
      const country = included.find((i) => i.id === countryId)?.attributes?.name ?? null;
      if (nid) all.push({ nid, city, country, changed });
    }

    offset += PAGE_LIMIT;
    if (nodes.length < PAGE_LIMIT) break;
  }

  return all;
}

async function main() {
  const urlEntries: string[] = [];

  // Static pages
  for (const lang of LANGUAGES) {
    urlEntries.push(
      `  <url>
    <loc>${SITE_URL}/${lang}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`,
    );
    urlEntries.push(
      `  <url>
    <loc>${SITE_URL}/${lang}/faq</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`,
    );
  }

  // Tour pages — fetched per language so city/country names are translated
  for (const lang of LANGUAGES) {
    console.log(`Fetching tours for [${lang}]...`);
    const tours = await fetchToursForLang(lang);

    for (const tour of tours) {
      const slug = buildSlug(tour.country, tour.city, tour.nid);
      const lastmod = tour.changed ? tour.changed.split('T')[0] : null;

      // Build hreflang links — use translated slug for current lang, nid-fallback for others
      const hreflangLinks = LANGUAGES.map(
        (l) =>
          `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE_URL}/${l}/tour/${l === lang ? slug : `tour-${tour.nid}`}"/>`,
      ).join('\n');
      const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}/en/tour/tour-${tour.nid}"/>`;

      urlEntries.push(
        `  <url>
    <loc>${SITE_URL}/${lang}/tour/${slug}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
${hreflangLinks}
${xDefault}
  </url>`,
      );
    }

    console.log(`  → ${tours.length} tours`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
>
${urlEntries.join('\n')}
</urlset>`;

  const outPath = path.join(__dirname, '../public/sitemap.xml');
  fs.writeFileSync(outPath, xml, 'utf8');
  console.log(`\nSitemap written → ${outPath} (${urlEntries.length} entries)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
