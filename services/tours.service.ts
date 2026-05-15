// services/tours.service.ts
// Servicio de tours — agnóstico del backend

import {
  drupalGet,
  drupalGetRaw,
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
} from '../lib/drupal-client';
import type {
  Tour,
  TourStep,
  TourActivity,
  TourFilters,
  PaginatedResult,
} from '../types';

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
  ],
  'node--business': ['title', 'field_description', 'field_logo', 'field_website', 'field_phone', 'field_location', 'field_category', 'langcode'],
  'taxonomy_term--cities': ['name'],
  'taxonomy_term--countries': ['name'],
  'taxonomy_term--business_category': ['name'],
  'file--file': ['uri', 'url'],
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
  ],
  'taxonomy_term--cities': ['name'],
  'taxonomy_term--countries': ['name'],
  'file--file': ['uri', 'url'],
};

const TOUR_CARD_INCLUDE = ['field_image', 'field_city', 'field_country'];

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

export async function getTours(filters: TourFilters = {}): Promise<PaginatedResult<Tour>> {
  const { page = 1, limit = 20, countries, city, minRating, search, sort } = filters;

  const drupalFilters: Record<string, any> = { status: 1 };
  if (city) drupalFilters['field_city.name'] = city;

  let sortParam = 'sort=-field_average_rate,-field_rating_count,drupal_internal__nid';
  if (sort === 'alphabetical')      sortParam = 'sort=title,drupal_internal__nid';
  if (sort === 'alphabetical_desc') sortParam = 'sort=-title,drupal_internal__nid';
  if (sort === 'stops_desc')        sortParam = 'sort=-field_steps_count,drupal_internal__nid';
  if (sort === 'stops_asc')         sortParam = 'sort=field_steps_count,drupal_internal__nid';

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
    search ? `filter[title][condition][path]=title&filter[title][condition][operator]=CONTAINS&filter[title][condition][value]=${encodeURIComponent(search)}` : '',
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
  if (list.length === 0) throw new Error(`Tour with nid ${nid} not found`);

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
      'file--file': ['uri', 'url'],
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
      'file--file': ['uri', 'url'],
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
      'file--file': ['uri', 'url'],
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