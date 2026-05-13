// Cloudflare Worker — sirve la SPA y, además, inyecta meta tags Open Graph /
// Twitter Card en el HTML al edge. Esto es necesario porque Expo Web está
// configurado con output: "single" (SPA) y los <Head> de expo-router/head se
// inyectan vía JavaScript; los crawlers de WhatsApp, Telegram, iMessage, Slack,
// Facebook y Twitter no ejecutan JS, así que necesitan los tags en el HTML
// inicial.

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
const SLUG_TOUR_RE = /^\/([a-z]{2})\/tour\/([a-z0-9-]+?)-(\d+)(\/steps)?$/;
const LANG_HOME_RE = /^\/([a-z]{2})\/?$/;

const SUPPORTED_LANGS = ['es', 'en', 'fr', 'de', 'it', 'el'];
const CANONICAL_HOST = 'stepuptours.com';
const SITE_ORIGIN = `https://${CANONICAL_HOST}`;
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-default.jpg`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const DEFAULT_DESCRIPTIONS = {
  en: 'Discover self-guided city tours worldwide. Walk at your own pace, find hidden gems and earn rewards with StepUp Tours.',
  es: 'Descubre tours autoguiados por ciudades de todo el mundo. Camina a tu ritmo, encuentra rincones únicos y gana recompensas con StepUp Tours.',
  fr: 'Découvrez des visites autoguidées dans des villes du monde entier. Avancez à votre rythme et gagnez des récompenses avec StepUp Tours.',
  de: 'Entdecke selbstgeführte Stadtführungen weltweit. Geh in deinem Tempo, finde versteckte Orte und sammle Belohnungen mit StepUp Tours.',
  it: 'Scopri tour autoguidati in città di tutto il mondo. Cammina al tuo ritmo, trova angoli unici e guadagna ricompense con StepUp Tours.',
  el: 'Ανακαλύψτε αυτοκαθοδηγούμενες ξεναγήσεις σε πόλεις παγκοσμίως. Περπατήστε με τον δικό σας ρυθμό και κερδίστε ανταμοιβές με το StepUp Tours.',
};

const DEFAULT_TITLES = {
  en: 'StepUp Tours — Discover City Tours',
  es: 'StepUp Tours — Descubre tours por la ciudad',
  fr: 'StepUp Tours — Découvrez des visites de villes',
  de: 'StepUp Tours — Stadtführungen entdecken',
  it: 'StepUp Tours — Scopri tour della città',
  el: 'StepUp Tours — Ανακαλύψτε ξεναγήσεις πόλεων',
};

function htmlEscape(str) {
  if (str == null) return '';
  return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
}

function stripHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(str, max) {
  if (!str) return '';
  if (str.length <= max) return str;
  return str.slice(0, max - 1).trimEnd() + '…';
}

function rewriteImageHost(rawUrl) {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl, SITE_ORIGIN);
    if (parsed.hostname.endsWith('pantheonsite.io')) {
      parsed.protocol = 'https:';
      parsed.hostname = CANONICAL_HOST;
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function pickLang(pathname) {
  const m = pathname.match(/^\/([a-z]{2})(\/|$)/);
  if (m && SUPPORTED_LANGS.includes(m[1])) return m[1];
  return 'en';
}

async function fetchTourMetaByNid(env, lang, nid) {
  const apiBase = env.DRUPAL_API_URL ?? 'https://dev-step-up-tours.pantheonsite.io';
  const prefix = lang === 'en' ? '' : `/${lang}`;
  const url =
      `${apiBase}${prefix}/jsonapi/node/tour` +
      `?filter[drupal_internal__nid]=${encodeURIComponent(nid)}` +
      `&filter[status]=1` +
      `&include=field_image,field_city,field_country` +
      `&fields[node--tour]=title,field_description,drupal_internal__nid,field_image,field_city,field_country` +
      `&fields[taxonomy_term--cities]=name` +
      `&fields[taxonomy_term--countries]=name` +
      `&fields[file--file]=uri,url`;
  const resp = await fetch(url, {
    headers: { Accept: 'application/vnd.api+json' },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!resp.ok) return null;
  const json = await resp.json();
  const node = json?.data?.[0];
  if (!node) return null;

  const attrs = node.attributes ?? {};
  const included = json?.included ?? [];

  const imgRelId = node.relationships?.field_image?.data?.id;
  const cityRelId = node.relationships?.field_city?.data?.id;
  const countryRelId = node.relationships?.field_country?.data?.id;

  const imgEntity = included.find((i) => i.id === imgRelId);
  const rawImageUrl =
      imgEntity?.attributes?.uri?.url ?? imgEntity?.attributes?.url ?? null;
  const image = rawImageUrl
      ? rewriteImageHost(rawImageUrl.startsWith('http') ? rawImageUrl : `${apiBase}${rawImageUrl}`)
      : DEFAULT_OG_IMAGE;

  const city = included.find((i) => i.id === cityRelId)?.attributes?.name ?? '';
  const country = included.find((i) => i.id === countryRelId)?.attributes?.name ?? '';

  return {
    title: attrs.title ?? '',
    description: attrs.field_description?.value ?? attrs.field_description ?? '',
    image,
    nid: attrs.drupal_internal__nid ?? Number(nid),
    city,
    country,
  };
}

function buildTourMeta(tour, lang, canonical) {
  const title = `${tour.title} — StepUp Tours`;
  const descRaw = stripHtml(tour.description);
  const description = truncate(
      descRaw ||
        `${tour.title}${tour.city ? ' en ' + tour.city : ''}${tour.country ? ', ' + tour.country : ''}`,
      200,
  );
  return {
    title,
    description,
    image: tour.image || DEFAULT_OG_IMAGE,
    canonical,
    type: 'website',
  };
}

function buildDefaultMeta(lang, canonical) {
  return {
    title: DEFAULT_TITLES[lang] ?? DEFAULT_TITLES.en,
    description: DEFAULT_DESCRIPTIONS[lang] ?? DEFAULT_DESCRIPTIONS.en,
    image: DEFAULT_OG_IMAGE,
    canonical,
    type: 'website',
  };
}

function renderHeadTags(meta, lang) {
  const t = htmlEscape(meta.title);
  const d = htmlEscape(meta.description);
  const img = htmlEscape(meta.image);
  const url = htmlEscape(meta.canonical);
  const localeMap = {
    en: 'en_US', es: 'es_ES', fr: 'fr_FR', de: 'de_DE', it: 'it_IT', el: 'el_GR',
  };
  const ogLocale = localeMap[lang] ?? 'en_US';
  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="${htmlEscape(meta.type)}" />`,
    `<meta property="og:site_name" content="StepUp Tours" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:image" content="${img}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${t}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:locale" content="${ogLocale}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${img}" />`,
    `<meta name="twitter:image:alt" content="${t}" />`,
  ].join('\n    ');
}

// Inserta los meta tags al final del <head> y elimina cualquier <title> o
// <meta name="description"> existente del HTML del SPA shell para evitar
// duplicados. No tocamos otros tags (viewport, charset, favicon, fonts).
function injectIntoHtml(html, headTags) {
  const stripped = html
      .replace(/<title>[^<]*<\/title>/i, '')
      .replace(/<meta\s+name=["']description["'][^>]*>/i, '');
  const closeHead = stripped.search(/<\/head>/i);
  if (closeHead === -1) return stripped;
  return (
      stripped.slice(0, closeHead) +
      '    ' + headTags + '\n  ' +
      stripped.slice(closeHead)
  );
}

async function resolveMetaForRequest(url, env) {
  const pathname = url.pathname;
  const lang = pickLang(pathname);
  const canonical = `${SITE_ORIGIN}${pathname === '/' ? '/' + lang : pathname}`;

  // Tour detail con slug terminado en -<nid>
  const slugMatch = pathname.match(SLUG_TOUR_RE);
  if (slugMatch) {
    const nid = slugMatch[3];
    try {
      const tour = await fetchTourMetaByNid(env, lang, nid);
      if (tour) return buildTourMeta(tour, lang, canonical);
    } catch {
      // fall through to defaults
    }
    return buildDefaultMeta(lang, canonical);
  }

  // Tour detail con UUID (antes del redirect 301) — devolvemos defaults.
  if (UUID_TOUR_RE.test(pathname)) {
    return buildDefaultMeta(lang, canonical);
  }

  // Home / listings → default meta
  return buildDefaultMeta(lang, canonical);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Redirect www → non-www (canonical domain)
    if (url.hostname === 'www.stepuptours.com') {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }

    // Redirect legacy UUID tour URLs to SEO-friendly slug URLs
    const uuidMatch = url.pathname.match(UUID_TOUR_RE);
    if (uuidMatch) {
      const [, lang, uuid, suffix] = uuidMatch;
      const apiBase = env.DRUPAL_API_URL ?? 'https://dev-step-up-tours.pantheonsite.io';
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
        // fall through — el SPA maneja UUIDs nativamente
      }
    }

    // Proxy /sites/default/files/* desde Pantheon con headers CORS.
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

    // Servir asset del SPA. Si es HTML, inyectar meta tags OG/Twitter al edge.
    const assetResponse = await env.ASSETS.fetch(request);
    const contentType = assetResponse.headers.get('Content-Type') ?? '';

    if (contentType.includes('text/html')) {
      const headers = new Headers(assetResponse.headers);
      // Necesario para que el popup de Google OAuth pueda comunicarse de vuelta.
      headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

      try {
        const [meta, html] = await Promise.all([
          resolveMetaForRequest(url, env),
          assetResponse.text(),
        ]);
        const headTags = renderHeadTags(meta, pickLang(url.pathname));
        const newHtml = injectIntoHtml(html, headTags);
        headers.delete('content-length');
        return new Response(newHtml, { status: assetResponse.status, headers });
      } catch {
        return new Response(assetResponse.body, { status: assetResponse.status, headers });
      }
    }

    return assetResponse;
  },
};
