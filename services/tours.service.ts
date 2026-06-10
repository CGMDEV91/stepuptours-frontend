// services/tours.service.ts
// Servicio de tours — agnóstico del backend

import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';
import {
  drupalGet,
  drupalGetRaw,
  drupalGetJsonApiBaseRaw,
  drupalPost,
  drupalPatch,
  buildFilters,
  buildInclude,
  buildFields,
  buildPage,
  mapDrupalTour,
  mapDrupalTourStep,
  mapDrupalActivity,
  extractTourFromActivity,
  getApiLanguage,
  resolveImageUrl,
} from '../lib/drupal-client';
import { cached } from '../lib/mem-cache';
import type {
  Tour,
  TourStep,
  TourActivity,
  TourFilters,
  PaginatedResult,
} from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';

// ── Constantes de campos y relaciones ─────────────────────────────────────────

const TOUR_FIELDS = {
  'node--tour': [
    'title',
    'drupal_internal__nid',
    'field_description',
    'field_image',
    'field_average_rate',
    'field_rating_count',
    'field_duration',
    'field_donation_count',
    'field_donation_total',
    'field_location',
    'field_city',
    'field_country',
    'field_steps_count',
    'field_featured_business_1',
    'field_featured_business_2',
    'field_featured_business_3',
    'status',
    'uid',
    'langcode',
    'available_langs',
    'author_is_admin',
    'field_author_is_guide',
  ],
  'node--business': ['title', 'field_description', 'field_logo', 'field_website', 'field_phone', 'field_location', 'field_category', 'langcode'],
  'taxonomy_term--cities': ['name'],
  'taxonomy_term--countries': ['name'],
  'taxonomy_term--business_category': ['name'],
  'file--file': ['uri', 'url', 'image_style_uri'],
};

const TOUR_INCLUDE = [
  'field_image',
  'field_city',
  'field_country',
  'field_featured_business_1',
  'field_featured_business_1.field_logo',
  'field_featured_business_1.field_category',
  'field_featured_business_2',
  'field_featured_business_2.field_logo',
  'field_featured_business_2.field_category',
  'field_featured_business_3',
  'field_featured_business_3.field_logo',
  'field_featured_business_3.field_category',
];

const TOUR_CARD_FIELDS = {
  'node--tour': [
    'title',
    'drupal_internal__nid',
    'field_image',
    'field_average_rate',
    'field_rating_count',
    'field_duration',
    'field_donation_count',
    'field_city',
    'field_country',
    'field_steps_count',
    'status',
    'uid',
    'langcode',
    'available_langs',
    'author_is_admin',
    'field_author_is_guide',
  ],
  'taxonomy_term--cities': ['name'],
  'taxonomy_term--countries': ['name'],
  'file--file': ['uri', 'url', 'image_style_uri'],
  'user--user': ['display_name', 'name', 'drupal_internal__uid', 'field_public_name'],
};

const TOUR_CARD_INCLUDE = ['field_image', 'field_city', 'field_country', 'uid'];

// TTLs de la caché en memoria (ms).
const TOURS_TTL = 5 * 60 * 1000;       // listados de tours
const TAXONOMY_TTL = 10 * 60 * 1000;   // países / ciudades (casi estáticos)

// ── Obtener listado de tours ───────────────────────────────────────────────────

function buildCountriesFilter(countries: string[]): string {
  if (!countries.length) return '';
  if (countries.length === 1) return `filter[field_country.name]=${encodeURIComponent(countries[0])}`;
  const parts = ['filter[cg][group][conjunction]=OR'];
  countries.forEach((c, i) => {
    parts.push(`filter[c${i}][condition][path]=field_country.name`);
    parts.push(`filter[c${i}][condition][operator]=%3D`);
    parts.push(`filter[c${i}][condition][value]=${encodeURIComponent(c)}`);
    parts.push(`filter[c${i}][condition][memberOf]=cg`);
  });
  return parts.join('&');
}

// ── Búsqueda por título, ciudad o país via endpoint custom ────────────────────
// La query JSON:API con OR group sobre campos de relación de entidad
// (field_city.name, field_country.name) genera JOINs costosos que causan 504.
// El endpoint /api/tours/search usa EntityQuery con OR sobre TIDs, que es eficiente.

function mapSearchTour(item: any): Tour {
  return {
    id: item.id,
    drupalInternalId: item.nid ?? 0,
    title: item.title ?? '',
    description: '',
    image: item.imageUrl ? resolveImageUrl({ url: item.imageUrl }) : null,
    imageStyles: null,
    duration: item.duration ?? 0,
    averageRate: parseFloat(item.averageRate ?? '0'),
    ratingCount: item.ratingCount ?? 0,
    stopsCount: item.stopsCount ?? 0,
    donationCount: item.donationCount ?? 0,
    donationTotal: 0,
    city: item.city ?? null,
    country: item.country ?? null,
    location: null,
    featuredBusinesses: [null, null, null],
    authorId: '',
    authorPublicName: undefined,
    authorIsAdmin: !!item.authorIsAdmin,
    authorIsGuide: !!item.authorIsGuide,
    availableLangs: Array.isArray(item.availableLangs) && item.availableLangs.length > 0
      ? item.availableLangs
      : [item.langcode ?? 'en'],
    published: !!item.status,
    langcode: item.langcode ?? 'en',
  };
}

async function searchTours(filters: TourFilters): Promise<PaginatedResult<Tour>> {
  const { search, page = 1, limit = 20 } = filters;
  const params = new URLSearchParams();
  if (search) params.set('q', search);
  params.set('page', String(page));
  params.set('limit', String(limit));
  params.set('lang', getApiLanguage());

  const { data } = await axios.get<{ data: any[]; total: number; hasMore: boolean }>(
    `${BASE_URL}/api/tours/search?${params.toString()}`,
  );

  return {
    data: (data.data ?? []).map(mapSearchTour),
    total: data.total ?? 0,
    hasMore: data.hasMore ?? false,
  };
}

export async function getTours(filters: TourFilters = {}): Promise<PaginatedResult<Tour>> {
  // Caché por idioma + filtros: revisitar una vista ya cargada no relanza la API.
  const cacheKey = `tours:${getApiLanguage()}:${JSON.stringify(filters)}`;
  return cached(cacheKey, TOURS_TTL, () => fetchTours(filters));
}

async function fetchTours(filters: TourFilters = {}): Promise<PaginatedResult<Tour>> {
  const { page = 1, limit = 20, countries, city, minRating, search, sort, authorType, langs } = filters;

  // Búsqueda libre: delegar al endpoint custom /api/tours/search para evitar el
  // timeout causado por los JOINs del OR group en campos de relación JSON:API.
  if (search && search.trim().length > 0) {
    return searchTours({ search: search.trim(), page, limit });
  }

  // ── Language filter (client-side) ─────────────────────────────────────────
  // `available_langs` is a computed field not stored in the DB, so it cannot
  // be filtered via JSON:API. Strategy: fetch all tours without the lang filter
  // (large limit), then filter client-side by availableLangs.
  if (langs && langs.length > 0) {
    const allResult = await fetchTours({ ...filters, langs: undefined, limit: 500, page: 1 });
    const filtered = allResult.data.filter((t) =>
      langs.some((l) => t.availableLangs.includes(l)),
    );
    const start = (page - 1) * limit;
    return {
      data: filtered.slice(start, start + limit),
      total: filtered.length,
      hasMore: start + limit < filtered.length,
    };
  }

  const drupalFilters: Record<string, any> = { status: 1 };
  if (city) drupalFilters['field_city.name'] = city;

  // Filter by author type via the cached boolean field_author_is_admin on
  // the tour itself (kept in sync by stepuptours_api_node_presave /
  // stepuptours_api_user_update). We can't filter through uid.roles.target_id
  // because JSON:API restricts the user.roles field for anonymous visitors and
  // returns 400. Filtering a simple boolean on the node has no access issues.
  let authorFilterStr = '';
  if (authorType === 'admin') {
    authorFilterStr = 'filter[field_author_is_admin]=1';
  } else if (authorType === 'guide') {
    authorFilterStr = 'filter[field_author_is_admin]=0';
  }

  let sortParam = 'sort=-field_average_rate,-field_rating_count,drupal_internal__nid';
  if (sort === 'most_completed')    sortParam = 'sort=-field_rating_count,-field_average_rate,drupal_internal__nid';
  if (sort === 'newest')            sortParam = 'sort=-created,drupal_internal__nid';
  if (sort === 'alphabetical')      sortParam = 'sort=title,drupal_internal__nid';
  if (sort === 'alphabetical_desc') sortParam = 'sort=-title,drupal_internal__nid';
  if (sort === 'stops_desc')        sortParam = 'sort=-field_steps_count,drupal_internal__nid';
  if (sort === 'stops_asc')         sortParam = 'sort=field_steps_count,drupal_internal__nid';

  // ── Search filter: OR across title, city and country ─────────────────────
  // Previously only title was searched. Now we build a JSON:API OR group so
  // that typing "Barcelona" or "Spain" also returns the right tours.
  let searchFilter = '';
  if (search) {
    const q = encodeURIComponent(search);
    searchFilter = [
      'filter[sg][group][conjunction]=OR',
      `filter[title_f][condition][path]=title&filter[title_f][condition][operator]=CONTAINS&filter[title_f][condition][value]=${q}&filter[title_f][condition][memberOf]=sg`,
      `filter[city_f][condition][path]=field_city.name&filter[city_f][condition][operator]=CONTAINS&filter[city_f][condition][value]=${q}&filter[city_f][condition][memberOf]=sg`,
      `filter[country_f][condition][path]=field_country.name&filter[country_f][condition][operator]=CONTAINS&filter[country_f][condition][value]=${q}&filter[country_f][condition][memberOf]=sg`,
    ].join('&');
  }

  // Skip the country relationship filter when a city is selected:
  // a city already implies its country unambiguously, and combining
  // filter[field_city.name] + filter[field_country.name] in JSON:API forces
  // Drupal to JOIN both taxonomy relationships, which is ~140x slower on
  // Pantheon (~21s vs ~0.15s in measured tests). The country chip stays
  // visible in the UI for UX; only the request is optimised.
  const filterStr = [
    buildFilters(drupalFilters),
    city ? '' : buildCountriesFilter(countries ?? []),
    minRating ? `filter[rate][condition][path]=field_average_rate&filter[rate][condition][operator]=>=&filter[rate][condition][value]=${minRating}` : '',
    searchFilter,
    authorFilterStr,
  ].filter(Boolean).join('&');

  const dataParams = [
    filterStr,
    sortParam,
    buildPage(page, limit),
    buildFields(TOUR_CARD_FIELDS),
    buildInclude(TOUR_CARD_INCLUDE),
  ].filter(Boolean).join('&');

  // Single request: Drupal 11 JSON:API includes meta.count in every collection
  // response — no need for a separate count round-trip.
  // The previous two-request pattern (data + base-URL count) was causing the
  // filter bug: relationship filters on the non-language-prefixed URL are not
  // cached on Pantheon and could take 15+ seconds, keeping isLoading=true long
  // enough for a competing fetch to supersede and discard the filtered result.
  const { data, meta } = await drupalGetRaw('/node/tour', dataParams);

  const rawList = Array.isArray(data) ? data : [data];
  const mapped = rawList.map(mapDrupalTour);

  const total = typeof (meta as any)?.count === 'number' ? (meta as any).count : undefined;
  const hasMore = total !== undefined ? page * limit < total : mapped.length === limit;

  return {
    data: mapped,
    total,
    hasMore,
  };
}

// ── Obtener detalle de un tour ────────────────────────────────────────────────

export async function getTourById(id: string): Promise<Tour> {
  const params = [
    buildFields(TOUR_FIELDS),
    buildInclude([...TOUR_INCLUDE, 'uid']),
  ].join('&');

  const raw = await drupalGet<any>(`/node/tour/${id}`, params);
  return mapDrupalTour(raw);
}

// ── Obtener tour por nid (Drupal internal node ID) ────────────────────────────

export async function getTourByNid(nid: number): Promise<Tour> {
  const params = [
    `filter[drupal_internal__nid]=${nid}`,
    'filter[status]=1',
    buildFields(TOUR_FIELDS),
    buildInclude([...TOUR_INCLUDE, 'uid']),
  ].join('&');

  const { data } = await drupalGetRaw('/node/tour', params);
  const list = Array.isArray(data) ? data : data ? [data] : [];
  if (list.length === 0) {
    // Lang-aware endpoint returned empty — the tour may exist but not in the
    // requested language. Retry against the non-prefixed /jsonapi/ which
    // returns the source-language version. If found, mark as untranslated so
    // the UI can show an info banner.
    const fallback = await drupalGetJsonApiBaseRaw(`/node/tour?${params}`);
    if (fallback.data.length === 0) {
      const e = new Error(`Tour with nid ${nid} not found`) as Error & { status?: number };
      e.status = 404;
      throw e;
    }
    const tour = mapDrupalTour(fallback.data[0]);
    tour.isUntranslated = true;
    return tour;
  }

  return mapDrupalTour(list[0]);
}

// ── Obtener steps de un tour ──────────────────────────────────────────────────

export async function getTourSteps(tourId: string): Promise<TourStep[]> {
  const params = [
    `filter[field_tour.id]=${tourId}`,
    'filter[status]=1',
    'sort=field_order',
    buildFields({
      'node--tour_step': [
        'title',
        'field_description',
        'field_order',
        'field_location',
        'field_total_completed',
        'field_featured_business',
        'langcode',
      ],
      'node--business': ['title', 'field_description', 'field_logo', 'field_website', 'field_phone', 'field_location', 'field_category'],
      'taxonomy_term--business_category': ['name'],
      'file--file': ['uri', 'url', 'image_style_uri'],
    }),
    buildInclude(['field_featured_business', 'field_featured_business.field_logo', 'field_featured_business.field_category']),
  ].join('&');

  const raw = await drupalGet<any[]>('/node/tour_step', params);
  const rawList = Array.isArray(raw) ? raw : [raw];
  return rawList.map(mapDrupalTourStep);
}

// ── Obtener actividad de un usuario en un tour ────────────────────────────────

export async function getTourActivity(
    userId: string,
    tourId: string
): Promise<TourActivity | null> {
  const params = [
    `filter[field_user.id]=${userId}`,
    `filter[field_tour.id]=${tourId}`,
    buildInclude(['field_steps_completed']),
  ].join('&');

  const raw = await drupalGet<any[]>('/node/tour_user_activity', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.length ? mapDrupalActivity(list[0]) : null;
}

// ── Crear o actualizar actividad de usuario en un tour ────────────────────────

export async function upsertTourActivity(
    userId: string,
    tourId: string,
    updates: Partial<Pick<TourActivity, 'isFavorite' | 'isSaved' | 'isCompleted' | 'userRating' | 'stepsCompleted'>>,
    currentTourRatingCount?: number
): Promise<TourActivity> {
  const existing = await getTourActivity(userId, tourId);
  const isNewRating = updates.userRating !== undefined && !existing?.userRating;

  const attributes: Record<string, any> = {};
  if (updates.isFavorite !== undefined) attributes.field_is_favorite = updates.isFavorite;
  if (updates.isSaved !== undefined) attributes.field_is_saved = updates.isSaved;
  if (updates.isCompleted !== undefined) {
    attributes.field_is_completed = updates.isCompleted;
    if (updates.isCompleted) {
      attributes.field_completed_at = Math.floor(Date.now() / 1000);
    }
  }
  if (updates.userRating !== undefined) {
    attributes.field_user_rating = updates.userRating;
    if (isNewRating) {
      attributes.field_rated_at = Math.floor(Date.now() / 1000);
    }
  }

  const relationships: Record<string, any> = {
    field_user: { data: { type: 'user--user', id: userId } },
    field_tour: { data: { type: 'node--tour', id: tourId } },
  };

  if (updates.stepsCompleted !== undefined) {
    relationships.field_steps_completed = {
      data: updates.stepsCompleted.map((id) => ({ type: 'node--tour_step', id })),
    };
  }

  let activity: TourActivity;

  if (existing) {
    const raw = await drupalPatch<any>(`/node/tour_user_activity/${existing.id}`, {
      data: {
        type: 'node--tour_user_activity',
        id: existing.id,
        attributes,
        relationships,
      },
    });
    activity = mapDrupalActivity(raw);
  } else {
    const raw = await drupalPost<any>('/node/tour_user_activity', {
      data: {
        type: 'node--tour_user_activity',
        attributes,
        relationships,
      },
    });
    activity = mapDrupalActivity(raw);
  }

  // Incrementar ratingCount solo cuando es un rating nuevo
  if (isNewRating && currentTourRatingCount !== undefined) {
    try {
      await drupalPatch(`/node/tour/${tourId}`, {
        data: {
          type: 'node--tour',
          id: tourId,
          attributes: {
            field_rating_count: currentTourRatingCount + 1,
          },
        },
      });
    } catch {
      // No crítico
    }
  }

  return activity;
}

// ── Enviar rating de tour (usuarios anónimos) ─────────────────────────────────
// Los usuarios autenticados siguen usando upsertTourActivity. Este endpoint
// acepta anónimos: el backend crea un tour_user_activity con uid 0 que solo
// contiene el rating, y el hook de recálculo actualiza field_average_rate.

export async function submitTourRating(tourId: string, rating: number): Promise<void> {
  const session = useAuthStore.getState().session;
  const authHeader = session?.token ? { Authorization: `Basic ${session.token}` } : {};
  await axios.post(
    `${BASE_URL}/api/tour/rate`,
    { tourId, rating },
    { headers: { 'Content-Type': 'application/json', ...authHeader } },
  );
}

// ── Obtener todos los tours con actividad del usuario ─────────────────────────

export async function getUserTourActivities(userId: string): Promise<TourActivity[]> {
  const params = [
    `filter[field_user.id]=${userId}`,
    buildFields({
      'node--tour_user_activity': [
        'field_is_favorite',
        'field_is_saved',
        'field_is_completed',
        'field_user_rating',
        'field_completed_at',
        'field_xp_awarded',
        'field_tour',
      ],
      'node--tour': [
        'title',
        'field_image',
        'field_average_rate',
        'field_rating_count',
        'field_duration',
        'field_donation_count',
        'field_city',
        'field_country',
        'field_steps_count',
        'status',
      ],
      'taxonomy_term--cities': ['name'],
      'taxonomy_term--countries': ['name'],
      'file--file': ['uri', 'url', 'image_style_uri'],
    }),
    buildInclude(['field_tour', 'field_tour.field_city', 'field_tour.field_country', 'field_tour.field_image']),
  ].join('&');

  const raw = await drupalGet<any[]>('/node/tour_user_activity', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map(mapDrupalActivity);
}

// ── Obtener actividades con datos de tour embebidos (una sola petición) ───────

export interface ActivityWithTour {
  activity: TourActivity;
  tour: Tour;
}

export async function getUserActivitiesWithTours(userId: string): Promise<ActivityWithTour[]> {
  const params = [
    `filter[field_user.id]=${userId}`,
    buildFields({
      'node--tour_user_activity': [
        'field_is_favorite',
        'field_is_saved',
        'field_is_completed',
        'field_user_rating',
        'field_completed_at',
        'field_xp_awarded',
        'field_tour',
      ],
      'node--tour': [
        'title',
        'field_image',
        'field_average_rate',
        'field_rating_count',
        'field_duration',
        'field_donation_count',
        'field_city',
        'field_country',
        'field_steps_count',
        'status',
      ],
      'taxonomy_term--cities': ['name'],
      'taxonomy_term--countries': ['name'],
      'file--file': ['uri', 'url', 'image_style_uri'],
    }),
    buildInclude(['field_tour', 'field_tour.field_city', 'field_tour.field_country', 'field_tour.field_image']),
  ].join('&');

  const raw = await drupalGet<any[]>('/node/tour_user_activity', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];

  const results: ActivityWithTour[] = [];
  for (const item of list) {
    const activity = mapDrupalActivity(item);
    const tour = extractTourFromActivity(item);
    if (tour) {
      results.push({ activity, tour });
    }
  }

  return results;
}

// ── Obtener tours por lista de UUIDs ──────────────────────────────────────────

export async function getToursByIds(ids: string[]): Promise<Tour[]> {
  if (ids.length === 0) return [];

  const filterParts = ids.map(
      (id, i) =>
          `filter[id-group][group][conjunction]=OR&filter[id-${i}][condition][path]=id&filter[id-${i}][condition][value]=${id}&filter[id-${i}][condition][memberOf]=id-group`
  );

  const params = [
    'filter[status]=1',
    ...filterParts,
    buildFields(TOUR_CARD_FIELDS),
    buildInclude(TOUR_CARD_INCLUDE),
    `page[limit]=${ids.length}`,
  ].join('&');

  const { data } = await drupalGetRaw('/node/tour', params);
  const rawList = Array.isArray(data) ? data : data ? [data] : [];
  return rawList.map(mapDrupalTour);
}

// ── Obtener países disponibles ─────────────────────────────────────────────────

export async function getCountries(): Promise<{ id: string; name: string }[]> {
  return cached(`countries:${getApiLanguage()}`, TAXONOMY_TTL, fetchCountries);
}

async function fetchCountries(): Promise<{ id: string; name: string }[]> {
  const params = [
    'filter[status]=1',
    'page[limit]=500',
    'fields[node--tour]=field_country',
    'fields[taxonomy_term--countries]=name',
    'include=field_country',
  ].join('&');
  const tours = await drupalGet<any[]>('/node/tour', params);
  const seen = new Map<string, { id: string; name: string }>();
  for (const tour of (Array.isArray(tours) ? tours : [])) {
    const c = tour.field_country;
    if (c?.id && c?.name) seen.set(c.id, { id: c.id, name: c.name });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ── Obtener ciudades por países ───────────────────────────────────────────────

async function fetchCitiesForCountry(countryName?: string): Promise<{ id: string; name: string; countryName?: string }[]> {
  const parts = [
    'filter[status]=1',
    'page[limit]=500',
    'fields[node--tour]=field_city,field_country',
    'fields[taxonomy_term--cities]=name',
    'fields[taxonomy_term--countries]=name',
    'include=field_city,field_country',
  ];
  if (countryName) {
    parts.push(`filter[field_country.name]=${encodeURIComponent(countryName)}`);
  }
  const tours = await drupalGet<any[]>('/node/tour', parts.join('&'));
  const seen = new Map<string, { id: string; name: string; countryName?: string }>();
  for (const tour of (Array.isArray(tours) ? tours : [])) {
    const city = tour.field_city;
    const country = tour.field_country;
    if (city?.id && city?.name) {
      seen.set(city.id, { id: city.id, name: city.name, countryName: country?.name });
    }
  }
  return [...seen.values()];
}

export async function getCitiesByCountry(countries?: string[]): Promise<{ id: string; name: string; countryName?: string }[]> {
  const key = `cities:${getApiLanguage()}:${[...(countries ?? [])].sort().join(',')}`;
  return cached(key, TAXONOMY_TTL, () => fetchCitiesByCountry(countries));
}

async function fetchCitiesByCountry(countries?: string[]): Promise<{ id: string; name: string; countryName?: string }[]> {
  if (!countries?.length) {
    const all = await fetchCitiesForCountry();
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (countries.length === 1) {
    const result = await fetchCitiesForCountry(countries[0]);
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }
  const results = await Promise.all(countries.map((c) => fetchCitiesForCountry(c)));
  const seen = new Map<string, { id: string; name: string; countryName?: string }>();
  for (const list of results) {
    for (const city of list) seen.set(city.id, city);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}