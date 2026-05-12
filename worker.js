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

const UUID_TOUR_RE = /^\/([a-z]{2})\/tour\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/steps)?$/;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Redirect www → non-www (canonical domain)
    if (url.hostname === 'www.stepuptours.com') {
      url.hostname = 'stepuptours.com';
      return Response.redirect(url.toString(), 301);
    }

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
        // fall through — the SPA handles UUIDs natively
      }
    }

    // Proxy /sites/default/files/* desde Pantheon con headers CORS
    // Cubre tanto imágenes como TTS MP3s y cualquier otro asset estático
    if (url.pathname.startsWith('/sites/default/files/')) {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      const upstream = 'https://dev-step-up-tours.pantheonsite.io' + url.pathname;
      const response = await fetch(upstream);
      const newResponse = new Response(response.body, response);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => newResponse.headers.set(k, v));
      return newResponse;
    }

    // Everything else → serve the static SPA.
    // Override COOP to same-origin-allow-popups on HTML responses so that
    // Google OAuth popup can communicate back via window.closed without being
    // blocked by the default same-origin policy.
    const assetResponse = await env.ASSETS.fetch(request);
    const contentType = assetResponse.headers.get('Content-Type') ?? '';
    if (contentType.includes('text/html')) {
      const headers = new Headers(assetResponse.headers);
      headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
      return new Response(assetResponse.body, { status: assetResponse.status, headers });
    }
    return assetResponse;
  },
};