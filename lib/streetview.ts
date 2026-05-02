import { TourStep } from '../types';

/**
 * Returns the Street View embed URL for a TourStep.
 *
 * Priority:
 *   1. embedSrc (field_url after Drupal normalization) — the Google Maps
 *      embed URL with pb= encoding. Most precise: preserves the exact
 *      heading the guide chose. Used when available.
 *   2. Reconstructed unofficial URL from lat/lon + panoid + heading/pitch.
 *      Fallback when embedSrc is absent. Note: heading is unreliable with
 *      panoid in the cbll format — Google tends to ignore it.
 */
export function buildStreetViewUrl(step: TourStep): string | null {
  // Use the original embed src when available — it has the correct heading.
  if (step.embedSrc) return step.embedSrc;

  // Fallback: reconstruct from structured fields.
  const lat = step.location?.lat;
  const lon = step.location?.lon;

  if (lat == null || lon == null) return null;

  const heading = step.heading ?? 0;
  const pitch   = step.pitch   ?? 0;

  const params = new URLSearchParams({
    layer:  'c',
    cbll:   `${lat},${lon}`,
    cbp:    `12,${heading},0,0,${pitch}`,
    output: 'svembed',
    hl:     'es',
  });

  if (step.panoid) params.set('panoid', step.panoid);

  return `https://maps.google.com/maps?${params.toString()}`;
}
