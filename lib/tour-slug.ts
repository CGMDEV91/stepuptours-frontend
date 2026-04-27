// lib/tour-slug.ts
// URL slug utilities for SEO-friendly tour URLs.
// Format: /{langcode}/tour/{country}-{city}-{nid}
// e.g.  /es/tour/espana-alicante-234

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildTourSlug({
  country,
  city,
  nid,
}: {
  country?: string | null;
  city?: string | null;
  nid: number;
}): string {
  const parts: string[] = [];
  if (country) parts.push(slugify(country));
  if (city) parts.push(slugify(city));
  if (parts.length === 0) parts.push('tour');
  parts.push(String(nid));
  return parts.join('-');
}

// Extracts the nid from the last numeric segment of a slug.
// 'espana-alicante-234' → 234
// Returns NaN when the last segment is not a valid integer (signals UUID format).
export function extractNidFromSlug(idParam: string): number {
  return parseInt(idParam.split('-').pop() ?? '', 10);
}

// Detects the UUID 8-4-4-4-12 hex pattern.
export function isUuid(idParam: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(idParam);
}
