function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildSlug(country, city, nid) {
  const parts = [];
  if (country) parts.push(slugify(country));
  if (city) parts.push(slugify(city));
  if (parts.length === 0) parts.push('tour');
  parts.push(String(nid));
  return parts.join('-');
}

// Matches /{lang}/tour/{uuid} and /{lang}/tour/{uuid}/steps
const UUID_TOUR_RE = /^\/([a-z]{2})\/tour\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/steps)?$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Redirect legacy UUID tour URLs to SEO-friendly slug URLs
    const uuidMatch = url.pathname.match(UUID_TOUR_RE);
    if (uuidMatch) {
      const [, lang, uuid, suffix] = uuidMatch;
      const apiBase = env.DRUPAL_API_URL ?? 'https://stepuptours.com';
      const prefix = lang === 'en' ? '' : `/${lang}`;
      try {
        const apiResp = await fetch(
          `${apiBase}${prefix}/jsonapi/node/tour/${uuid}` +
            `?fields[node--tour]=drupal_internal__nid` +
            `&include=field_city,field_country` +
            `&fields[taxonomy_term--cities]=name` +
            `&fields[taxonomy_term--countries]=name`,
          { headers: { Accept: 'application/vnd.api+json' } },
        );
        if (apiResp.ok) {
          const data = await apiResp.json();
          const nid = data?.data?.attributes?.drupal_internal__nid;
          const included = data?.included ?? [];
          const cityId = data?.data?.relationships?.field_city?.data?.id;
          const countryId = data?.data?.relationships?.field_country?.data?.id;
          const city = included.find((i) => i.id === cityId)?.attributes?.name ?? '';
          const country = included.find((i) => i.id === countryId)?.attributes?.name ?? '';
          if (nid) {
            const slug = buildSlug(country, city, nid);
            return Response.redirect(
              `${url.origin}/${lang}/tour/${slug}${suffix ?? ''}`,
              301,
            );
          }
        }
      } catch {
        // If the Drupal call fails, fall through — the SPA handles UUIDs natively.
      }
    }

    // Proxy TTS MP3s with CORS headers
    if (url.pathname.startsWith('/sites/default/files/tts/')) {
      const upstream = 'https://dev-step-up-tours.pantheonsite.io' + url.pathname;

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }

      const response = await fetch(upstream);
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('Access-Control-Allow-Origin', '*');
      newResponse.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      return newResponse;
    }

    // Everything else → serve the static SPA
    return env.ASSETS.fetch(request);
  },
};
