// services/dashboard.service.ts
// Dashboard service — agnostic of Drupal internals
// All Drupal-specific mapping happens in drupal-client.ts

import axios from 'axios';
import {
  drupalGet,
  drupalGetJsonApiBase,
  drupalGetJsonApiInLangRaw,
  drupalPost,
  drupalPatch,
  drupalPatchBase,
  buildInclude,
  buildFields,
  buildGeoFieldValue,
  mapDrupalTour,
  mapDrupalTourStep,
  mapDrupalDonation,
  mapDrupalProfessionalProfile,
  mapDrupalSubscription,
  mapDrupalSubscriptionPlan,
  mapDrupalSubscriptionPayment,
  getApiLanguage,
} from '../lib/drupal-client';
import { useAuthStore } from '../stores/auth.store';
import type { Tour, TourStep, Donation, ProfessionalProfile, Subscription, SubscriptionPlan, SubscriptionPayment } from '../types';

const DRUPAL_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';

function getDashboardAuthHeader(): Record<string, string> {
  const session = useAuthStore.getState().session;
  if (!session?.token) return {};
  const prefix = (session as any).tokenType === 'bearer' ? 'Bearer' : 'Basic';
  return { Authorization: `${prefix} ${session.token}` };
}

// ── Tours ─────────────────────────────────────────────────────────────────────

/**
 * Load tours authored by the current guide, each serialized in its OWN source
 * (creation) language.
 *
 * Uses the custom backend endpoint GET /api/me/tours. This is the only reliable
 * way to render mixed per-tour source languages in a single request: JSON:API
 * renders a whole collection in ONE negotiated language, so it cannot return a
 * tour created in ES and another created in IT each in its own language. The
 * endpoint loads each node's untranslated (default) translation server-side.
 *
 * `userId` is kept for call-site compatibility (e.g. getDonationsForAuthor); the
 * endpoint scopes results to the authenticated user.
 */
export async function getToursByAuthor(userId: string): Promise<Tour[]> {
  const { data } = await axios.get<{ tours: any[] }>(
      `${DRUPAL_BASE}/api/me/tours`,
      { headers: { Accept: 'application/json', ...getDashboardAuthHeader() } },
  );
  const list = Array.isArray(data?.tours) ? data.tours : [];
  return list.map((raw) => mapApiMeTour(raw, userId));
}

/**
 * Maps a /api/me/tours item (already domain-shaped by the backend) to Tour.
 */
function mapApiMeTour(raw: any, userId: string): Tour {
  return {
    id: raw.id,
    drupalInternalId: raw.drupalInternalId ?? 0,
    title: raw.title ?? '',
    description: raw.description ?? '',
    image: raw.image ?? null,
    imageStyles: null,
    duration: raw.duration ?? 0,
    averageRate: raw.averageRate ?? 0,
    ratingCount: raw.ratingCount ?? 0,
    stopsCount: raw.stopsCount ?? 0,
    donationCount: raw.donationCount ?? 0,
    donationTotal: raw.donationTotal ?? 0,
    city: raw.city ?? null,
    country: raw.country ?? null,
    location: raw.location ?? null,
    featuredBusinesses: [null, null, null],
    authorId: userId,
    authorPublicName: undefined,
    authorIsAdmin: false,
    availableLangs: Array.isArray(raw.availableLangs) ? raw.availableLangs : [raw.langcode].filter(Boolean),
    published: raw.published ?? false,
    adminApproved: raw.adminApproved ?? raw.published ?? false,
    langcode: raw.langcode ?? raw.sourceLang ?? 'en',
  };
}

/**
 * Load a single tour by UUID, always in the node's original creation language.
 *
 * Same two-mechanism approach as getToursByAuthor:
 *  - drupalGetJsonApiBase (no lang prefix) +
 *  - filter[default_langcode]=1 (force source-language revision).
 *
 * This ensures drupal_internal__nid is populated and langcode reflects the
 * actual creation language of the node, which is what isTranslationMode
 * detection in create-tour.tsx compares against.
 */
export async function getTourById(tourId: string): Promise<Tour> {
  const params = [
    'filter[default_langcode]=1',  // ← force node's own creation language
    buildInclude([
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
    ]),
    buildFields({
      'node--tour': [
        'drupal_internal__nid',
        'title',
        'field_description',
        'field_image',
        'field_duration',
        'field_average_rate',
        'field_rating_count',
        'field_donation_count',
        'field_donation_total',
        'field_location',
        'field_city',
        'field_country',
        'field_featured_business_1',
        'field_featured_business_2',
        'field_featured_business_3',
        'status',
        'uid',
        'langcode',
        'available_langs',
      ],
      'taxonomy_term--cities': ['name'],
      'taxonomy_term--countries': ['name'],
      'taxonomy_term--business_category': ['name'],
      'node--business': ['title', 'field_description', 'field_logo', 'field_website', 'field_phone', 'field_location', 'field_category', 'langcode'],
      'file--file': ['uri', 'url', 'image_style_uri'],
    }),
  ].join('&');

  const rawItems = await drupalGetJsonApiBase(`/node/tour/${tourId}`, params);
  const raw = Array.isArray(rawItems) ? rawItems[0] : rawItems;
  if (!raw) throw new Error(`Tour ${tourId} not found`);
  return mapDrupalTourFromJsonApi(raw);
}

/**
 * Load a single tour by UUID in a specific content language.
 *
 * Used by create-tour.tsx when the guide edits a translation (contentLang
 * differs from the UI langcode). We call drupalGetJsonApiBase with a manual
 * lang prefix injected into the path so Drupal returns the translated version
 * of the node — title, description, image — while the UI stays in its own
 * language.
 *
 * Unlike getTourById we do NOT add filter[default_langcode]=1 here because
 * we explicitly want the translated (non-default) version.
 */
export async function getTourByIdInLang(tourId: string, contentLang: string): Promise<Tour> {
  const params = [
    buildInclude([
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
    ]),
    buildFields({
      'node--tour': [
        'drupal_internal__nid',
        'title',
        'field_description',
        'field_image',
        'field_duration',
        'field_average_rate',
        'field_rating_count',
        'field_donation_count',
        'field_donation_total',
        'field_location',
        'field_city',
        'field_country',
        'field_featured_business_1',
        'field_featured_business_2',
        'field_featured_business_3',
        'status',
        'uid',
        'langcode',
        'available_langs',
      ],
      'taxonomy_term--cities': ['name'],
      'taxonomy_term--countries': ['name'],
      'taxonomy_term--business_category': ['name'],
      'node--business': ['title', 'field_description', 'field_logo', 'field_website', 'field_phone', 'field_location', 'field_category', 'langcode'],
      'file--file': ['uri', 'url', 'image_style_uri'],
    }),
  ].join('&');

  // Render the node in the requested content language using the correct
  // /{lang}/jsonapi prefix (the default site language carries no prefix).
  const { data, included } = await drupalGetJsonApiInLangRaw(`/node/tour/${tourId}`, contentLang, params);
  const raw = Array.isArray(data) ? data[0] : data;
  if (!raw) throw new Error(`Tour ${tourId} not found in lang ${contentLang}`);
  raw._included = included;
  return mapDrupalTourFromJsonApi(raw);
}

/**
 * Maps a raw JSON:API node--tour resource object (not Jsona-deserialized) to
 * the domain Tour type. Used by getToursByAuthor, getTourById, and
 * getTourByIdInLang which all use drupalGetJsonApiBase.
 */
function mapDrupalTourFromJsonApi(item: any): Tour {
  const attrs = item.attributes ?? {};
  const rels  = item.relationships ?? {};

  const city    = item.field_city    ?? resolveRelIncluded(item, 'field_city');
  const country = item.field_country ?? resolveRelIncluded(item, 'field_country');
  const imageRel = item.field_image  ?? resolveRelIncluded(item, 'field_image');

  return {
    id: item.id,
    drupalInternalId: attrs.drupal_internal__nid ?? 0,
    title: attrs.title ?? '',
    description: attrs.field_description?.value ?? attrs.field_description ?? '',
    image: imageRel?.attributes?.uri?.url
        ? (imageRel.attributes.uri.url.startsWith('http')
            ? imageRel.attributes.uri.url
            : `${DRUPAL_BASE}${imageRel.attributes.uri.url}`)
        : null,
    imageStyles: null,
    duration: attrs.field_duration ?? 0,
    averageRate: parseFloat(attrs.field_average_rate ?? '0'),
    ratingCount: parseInt(attrs.field_rating_count ?? '0', 10),
    stopsCount: attrs.field_steps_count ?? 0,
    donationCount: attrs.field_donation_count ?? 0,
    donationTotal: parseFloat(attrs.field_donation_total ?? '0'),
    city: city ? { id: city.id, name: city.attributes?.name ?? city.name ?? '' } : null,
    country: country ? { id: country.id, name: country.attributes?.name ?? country.name ?? '' } : null,
    location: attrs.field_location
        ? { lat: attrs.field_location.lat, lon: attrs.field_location.lon }
        : null,
    featuredBusinesses: [null, null, null],
    authorId: rels.uid?.data?.id ?? '',
    authorPublicName: undefined,
    authorIsAdmin: false,
    availableLangs: normalizeAvailableLangsFromAttrs(attrs),
    published: attrs.status ?? false,
    langcode: attrs.langcode ?? 'en',
  };
}

/** Resolve a relationship from the raw JSON:API item's included array if present. */
function resolveRelIncluded(item: any, relName: string): any | null {
  const relData = item.relationships?.[relName]?.data;
  if (!relData) return null;
  const included: any[] = item._included ?? [];
  return included.find((inc: any) => inc.id === relData.id) ?? null;
}

function normalizeAvailableLangsFromAttrs(attrs: any): string[] {
  const v = attrs.available_langs;
  let langs: string[] = [];
  if (Array.isArray(v)) {
    langs = v
        .map((i: any) => (typeof i === 'string' ? i : i?.value))
        .filter((x: any): x is string => typeof x === 'string' && x.length > 0);
  } else if (typeof v === 'string' && v.length > 0) {
    langs = [v];
  }
  if (langs.length === 0 && attrs.langcode) langs = [attrs.langcode];
  return Array.from(new Set(langs));
}

/**
 * Load tour steps for the edit form, always using the default-language endpoint.
 *
 * filter[default_langcode]=1 ensures we get source-language step content so
 * isTranslationMode detection in create-tour.tsx works correctly.
 */
export async function getTourStepsForEdit(tourId: string): Promise<TourStep[]> {
  const params = [
    `filter[field_tour.id]=${tourId}`,
    'filter[default_langcode]=1',  // ← force source-language steps
    'sort=field_order',
    buildFields({
      'node--tour_step': [
        'title',
        'field_description',
        'field_order',
        'field_location',
        'field_total_completed',
        'field_featured_business',
        'field_duration',
        'langcode',
        'status',
      ],
      'node--business': ['title', 'field_description', 'field_logo', 'field_website', 'field_phone', 'field_location', 'field_category'],
      'taxonomy_term--business_category': ['name'],
      'file--file': ['uri', 'url'],
    }),
    buildInclude(['field_featured_business', 'field_featured_business.field_logo', 'field_featured_business.field_category']),
  ].join('&');

  const rawItems = await drupalGetJsonApiBase('/node/tour_step', params);
  return rawItems.map(mapDrupalTourStepFromJsonApi);
}

/**
 * Load tour steps in a specific content language.
 *
 * Used in translation edit mode — we show the guide the translated step titles
 * (read-only) so they can see what has already been translated. We do NOT add
 * filter[default_langcode]=1 because we want the translated versions.
 */
export async function getTourStepsInLang(tourId: string, contentLang: string): Promise<TourStep[]> {
  const params = [
    `filter[field_tour.id]=${tourId}`,
    'sort=field_order',
    buildFields({
      'node--tour_step': [
        'title',
        'field_description',
        'field_order',
        'field_location',
        'field_total_completed',
        'field_featured_business',
        'field_duration',
        'langcode',
        'status',
      ],
      'node--business': ['title', 'field_description', 'field_logo', 'field_website', 'field_phone', 'field_location', 'field_category'],
      'taxonomy_term--business_category': ['name'],
      'file--file': ['uri', 'url'],
    }),
    buildInclude(['field_featured_business', 'field_featured_business.field_logo', 'field_featured_business.field_category']),
  ].join('&');

  // Render steps in the requested content language using the correct
  // /{lang}/jsonapi prefix (the default site language carries no prefix).
  const { data, included } = await drupalGetJsonApiInLangRaw('/node/tour_step', contentLang, params);
  return data.map((item) => mapDrupalTourStepFromJsonApi({ ...item, _included: included }));
}

/**
 * Maps a raw JSON:API node--tour_step resource to the domain TourStep type.
 */
function mapDrupalTourStepFromJsonApi(item: any): TourStep {
  const attrs = item.attributes ?? {};
  return {
    id: item.id,
    title: attrs.title ?? '',
    description: attrs.field_description?.value ?? attrs.field_description ?? '',
    contentLangcode: attrs.langcode ?? 'en',
    order: attrs.field_order ?? 0,
    published: attrs.status ?? true,
    location: attrs.field_location
        ? { lat: attrs.field_location.lat, lon: attrs.field_location.lon }
        : null,
    totalCompleted: attrs.field_total_completed ?? 0,
    featuredBusiness: null,
    embedSrc: attrs.field_url    ?? null,
    panoid:   attrs.field_panoid ?? null,
    heading:  attrs.field_heading != null ? parseFloat(attrs.field_heading) : null,
    pitch:    attrs.field_pitch   != null ? parseFloat(attrs.field_pitch)   : null,
    fov:      attrs.field_fov     != null ? parseFloat(attrs.field_fov)     : null,
  };
}

/**
 * Delete a whole tour and cascade-delete its steps and user activities.
 *
 * Uses the custom guide endpoint (not JSON:API) so the server can cascade
 * related entities and enforce ownership. `nid` is the tour's Drupal node id.
 */
export async function deleteTour(nid: number): Promise<void> {
  await axios.delete(
      `${DRUPAL_BASE}/api/me/tour/${nid}`,
      { headers: { Accept: 'application/json', ...getDashboardAuthHeader() } },
  );
}

/**
 * Delete a single non-default tour translation, cascading the same translation
 * on every step of the tour. The source language cannot be deleted this way.
 */
export async function deleteTourTranslation(nid: number, langcode: string): Promise<void> {
  await axios.delete(
      `${DRUPAL_BASE}/api/me/tour/${nid}/translation/${langcode}`,
      { headers: { Accept: 'application/json', ...getDashboardAuthHeader() } },
  );
}

/**
 * Update the title/description (and optionally the image) of a specific
 * tour translation via the custom guide endpoint, bypassing JSON:API URL
 * language negotiation.
 *
 * This is needed because the default language (EN) has no URL prefix in
 * Drupal, so patching via /jsonapi/ resolves to the session language context
 * (which may be different), causing a 422 "translation does not exist" error.
 */
export async function updateTourTranslation(
    nid: number,
    langcode: string,
    data: {
      title: string;
      description: string;
      imageFileUuid?: string | null;
    },
): Promise<void> {
  const body: Record<string, any> = {
    title: data.title,
    field_description: { value: data.description, format: 'basic_html' },
  };
  if (data.imageFileUuid !== undefined) {
    body.field_image_uuid = data.imageFileUuid ?? null;
  }
  await axios.post(
      `${DRUPAL_BASE}/api/me/tour/${nid}/translation/${langcode}/save`,
      body,
      { headers: { 'Content-Type': 'application/json', ...getDashboardAuthHeader() } },
  );
}

export async function createTour(data: {
  title: string;
  description: string;
  duration: number;
  cityId?: string;
  countryId?: string;
  featuredBusinessIds?: (string | null)[];
  imageId?: string;
  langcode?: string;
}): Promise<Tour> {
  const relationships: Record<string, any> = {};
  if (data.cityId) {
    relationships.field_city = { data: { type: 'taxonomy_term--cities', id: data.cityId } };
  }
  if (data.countryId) {
    relationships.field_country = { data: { type: 'taxonomy_term--countries', id: data.countryId } };
  }
  if (data.imageId) {
    relationships.field_image = { data: { type: 'file--file', id: data.imageId } };
  }

  const slots = data.featuredBusinessIds ?? [null, null, null];
  relationships.field_featured_business_1 = {
    data: slots[0] ? { type: 'node--business', id: slots[0] } : null,
  };
  relationships.field_featured_business_2 = {
    data: slots[1] ? { type: 'node--business', id: slots[1] } : null,
  };
  relationships.field_featured_business_3 = {
    data: slots[2] ? { type: 'node--business', id: slots[2] } : null,
  };

  const raw = await drupalPost<any>('/node/tour', {
    data: {
      type: 'node--tour',
      attributes: {
        title: data.title,
        field_description: { value: data.description, format: 'basic_html' },
        field_duration: data.duration,
        langcode: data.langcode ?? getApiLanguage(),
      },
      relationships,
    },
  });
  return mapDrupalTour(raw);
}

export async function updateTour(
    tourId: string,
    data: {
      title: string;
      description: string;
      duration: number;
      cityId?: string;
      countryId?: string;
      featuredBusinessIds?: (string | null)[];
      imageId?: string | null;
    },
    langcode?: string
): Promise<Tour> {
  const relationships: Record<string, any> = {};
  if (data.cityId !== undefined) {
    relationships.field_city = data.cityId
        ? { data: { type: 'taxonomy_term--cities', id: data.cityId } }
        : { data: null };
  }
  if (data.countryId !== undefined) {
    relationships.field_country = data.countryId
        ? { data: { type: 'taxonomy_term--countries', id: data.countryId } }
        : { data: null };
  }
  if (data.imageId !== undefined) {
    relationships.field_image = data.imageId
        ? { data: { type: 'file--file', id: data.imageId } }
        : { data: null };
  }

  const slots = data.featuredBusinessIds ?? [null, null, null];
  relationships.field_featured_business_1 = {
    data: slots[0] ? { type: 'node--business', id: slots[0] } : null,
  };
  relationships.field_featured_business_2 = {
    data: slots[1] ? { type: 'node--business', id: slots[1] } : null,
  };
  relationships.field_featured_business_3 = {
    data: slots[2] ? { type: 'node--business', id: slots[2] } : null,
  };

  const raw = await drupalPatchBase<any>(`/node/tour/${tourId}`, {
    data: {
      type: 'node--tour',
      id: tourId,
      attributes: {
        title: data.title,
        field_description: { value: data.description, format: 'basic_html' },
        field_duration: data.duration,
      },
      relationships,
    },
  }, langcode);
  return mapDrupalTour(raw);
}

// ── Tour Steps ────────────────────────────────────────────────────────────────

export async function createTourStep(
    tourId: string,
    data: {
      title: string;
      description: string;
      order: number;
      lat?: number;
      lon?: number;
      duration?: number;
      featuredBusinessId?: string | null;
      langcode?: string;
    }
): Promise<TourStep> {
  const attributes: Record<string, any> = {
    title: data.title,
    field_description: { value: data.description, format: 'basic_html' },
    field_order: data.order,
  };
  if (data.lat !== undefined && data.lon !== undefined && !isNaN(data.lat) && !isNaN(data.lon)) {
    attributes.field_location = buildGeoFieldValue(data.lat, data.lon);
  }
  if (data.duration !== undefined) {
    attributes.field_duration = data.duration;
  }

  const relationships: Record<string, any> = {
    field_tour: { data: { type: 'node--tour', id: tourId } },
  };
  if (data.featuredBusinessId !== undefined) {
    relationships.field_featured_business = {
      data: data.featuredBusinessId ? { type: 'node--business', id: data.featuredBusinessId } : null,
    };
  }

  attributes.langcode = data.langcode ?? getApiLanguage();

  const raw = await drupalPost<any>('/node/tour_step', {
    data: {
      type: 'node--tour_step',
      attributes,
      relationships,
    },
  });
  return mapDrupalTourStep(raw);
}

export async function updateTourStep(
    stepId: string,
    data: {
      title: string;
      description: string;
      order: number;
      lat?: number;
      lon?: number;
      duration?: number;
      featuredBusinessId?: string | null;
    },
    langcode?: string
): Promise<TourStep> {
  const attributes: Record<string, any> = {
    title: data.title,
    field_description: { value: data.description, format: 'basic_html' },
    field_order: data.order,
  };
  if (data.lat !== undefined && data.lon !== undefined && !isNaN(data.lat) && !isNaN(data.lon)) {
    attributes.field_location = buildGeoFieldValue(data.lat, data.lon);
  } else if (data.lat === undefined && data.lon === undefined) {
    attributes.field_location = null;
  }
  if (data.duration !== undefined) {
    attributes.field_duration = data.duration;
  }

  const relationships: Record<string, any> = {};
  if (data.featuredBusinessId !== undefined) {
    relationships.field_featured_business = {
      data: data.featuredBusinessId ? { type: 'node--business', id: data.featuredBusinessId } : null,
    };
  }

  const raw = await drupalPatchBase<any>(`/node/tour_step/${stepId}`, {
    data: {
      type: 'node--tour_step',
      id: stepId,
      attributes,
      relationships,
    },
  }, langcode);
  return mapDrupalTourStep(raw);
}

/**
 * Delete a whole tour-step entity (all translations) via the custom guide
 * endpoint. `stepUuid` is the step node UUID.
 */
export async function deleteTourStep(stepUuid: string): Promise<void> {
  await axios.delete(
      `${DRUPAL_BASE}/api/me/tour-step/${stepUuid}`,
      { headers: { Accept: 'application/json', ...getDashboardAuthHeader() } },
  );
}

/**
 * Delete a single non-default translation of a step (the step keeps the rest).
 */
export async function deleteTourStepTranslation(stepUuid: string, langcode: string): Promise<void> {
  await axios.delete(
      `${DRUPAL_BASE}/api/me/tour-step/${stepUuid}/translation/${langcode}`,
      { headers: { Accept: 'application/json', ...getDashboardAuthHeader() } },
  );
}

/**
 * Publish or unpublish a step via the custom guide endpoint. JSON:API can't
 * PATCH the `status` field without admin permissions, so this runs server-side
 * with an ownership check instead.
 */
export async function setStepPublished(stepUuid: string, published: boolean): Promise<void> {
  await axios.post(
      `${DRUPAL_BASE}/api/me/tour-step/${stepUuid}/${published ? 'publish' : 'unpublish'}`,
      {},
      { headers: { Accept: 'application/json', ...getDashboardAuthHeader() } },
  );
}

// ── Professional Profile ──────────────────────────────────────────────────────

export async function getProfessionalProfile(userId: string): Promise<ProfessionalProfile | null> {
  const params = [
    `filter[field_user.id]=${userId}`,
    'fields[node--professional_profile]=id,field_full_name,field_tax_id,field_address,field_account_holder,field_bank_iban,field_bank_bic,field_revenue_percentage,field_user',
  ].join('&');
  const raw = await drupalGet<any[]>('/node/professional_profile', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.length > 0 ? mapDrupalProfessionalProfile(list[0]) : null;
}

export interface ProfileUpdates {
  fullName: string;
  taxId: string;
  accountHolder: string;
  iban: string;
  bic: string;
  addressLine1: string;
  addressLine2: string;
  locality: string;
  postalCode: string;
  countryCode: string;
  administrativeArea: string;
}

function splitFullName(fullName: string): { given_name: string; family_name: string } {
  const parts = (fullName || 'Unknown').trim().split(/\s+/);
  return {
    given_name: parts[0] || 'Unknown',
    family_name: parts.length > 1 ? parts.slice(1).join(' ') : parts[0] || 'Unknown',
  };
}

export async function createProfessionalProfile(
    userId: string,
    updates: ProfileUpdates
): Promise<void> {
  const { given_name, family_name } = splitFullName(updates.fullName);
  await drupalPost('/node/professional_profile', {
    data: {
      type: 'node--professional_profile',
      attributes: {
        title: `Professional Profile - ${userId}`,
        field_full_name: updates.fullName,
        field_tax_id: updates.taxId,
        field_account_holder: updates.accountHolder,
        field_bank_iban: updates.iban,
        field_bank_bic: updates.bic,
        field_address: {
          country_code: updates.countryCode || 'ES',
          given_name,
          family_name,
          address_line1: updates.addressLine1,
          address_line2: updates.addressLine2 ?? '',
          locality: updates.locality,
          postal_code: updates.postalCode,
          administrative_area: updates.administrativeArea ?? '',
        },
      },
      relationships: {
        field_user: {
          data: { type: 'user--user', id: userId },
        },
      },
    },
  });
}

export async function updateProfessionalProfile(
    profileId: string,
    updates: Partial<ProfileUpdates>
): Promise<void> {
  const attributes: Record<string, any> = {};
  if (updates.fullName !== undefined) attributes.field_full_name = updates.fullName;
  if (updates.taxId !== undefined) attributes.field_tax_id = updates.taxId;
  if (updates.accountHolder !== undefined) attributes.field_account_holder = updates.accountHolder;
  if (updates.iban !== undefined) attributes.field_bank_iban = updates.iban;
  if (updates.bic !== undefined) attributes.field_bank_bic = updates.bic;
  if (
      updates.addressLine1 !== undefined ||
      updates.locality !== undefined ||
      updates.postalCode !== undefined ||
      updates.countryCode !== undefined
  ) {
    const { given_name, family_name } = splitFullName(updates.fullName ?? '');
    attributes.field_address = {
      country_code: updates.countryCode || 'ES',
      given_name,
      family_name,
      address_line1: updates.addressLine1 ?? '',
      address_line2: updates.addressLine2 ?? '',
      locality: updates.locality ?? '',
      postal_code: updates.postalCode ?? '',
      administrative_area: updates.administrativeArea ?? '',
    };
  }

  await drupalPatch(`/node/professional_profile/${profileId}`, {
    data: {
      type: 'node--professional_profile',
      id: profileId,
      attributes,
    },
  });
}

// ── Subscription ──────────────────────────────────────────────────────────────

export async function getSubscriptionPlans(
    planTypes: string[] = ['premium'],
): Promise<SubscriptionPlan[]> {
  const filterParts: string[] = ['filter[status]=1', 'sort=field_price'];

  if (planTypes.length === 1) {
    filterParts.push(`filter[field_plan_type]=${planTypes[0]}`);
  } else {
    filterParts.push('filter[pt_filter][condition][path]=field_plan_type');
    filterParts.push('filter[pt_filter][condition][operator]=IN');
    planTypes.forEach((type, i) => {
      filterParts.push(`filter[pt_filter][condition][value][${i}]=${encodeURIComponent(type)}`);
    });
  }

  const params = filterParts.join('&');
  const raw = await drupalGet<any[]>('/node/subscription_plan', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map(mapDrupalSubscriptionPlan);
}

export async function getActiveSubscription(userId: string): Promise<Subscription | null> {
  const params = [
    `filter[field_user.id]=${userId}`,
    buildInclude(['field_plan']),
    'sort=-field_end_date',
    'page[limit]=5',
    'fields[node--subscription]=id,field_user,field_plan,field_subscription_status,field_start_date,field_end_date,field_auto_renewal,field_stripe_subscription_id,field_stripe_customer_id',
  ].join('&');
  const raw = await drupalGet<any[]>('/node/subscription', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (list.length === 0) return null;
  const mapped = list.map(mapDrupalSubscription);
  const now = new Date();
  const valid = mapped.filter(s =>
      (s.status === 'active' || s.status === 'cancelled') &&
      new Date(s.endDate) > now
  );
  return valid.length > 0 ? valid[0] : null;
}

export async function getSubscriptionPayments(subscriptionId: string): Promise<SubscriptionPayment[]> {
  const params = [
    `filter[field_subscription.id]=${subscriptionId}`,
    'sort=-field_period_start',
    buildInclude(['field_plan']),
    'fields[node--subscription_payment]=id,field_subscription,field_user,field_plan,field_amount,field_stripe_invoice_id,field_stripe_payment_intent,field_payment_status,field_period_start,field_period_end',
    'fields[node--subscription_plan]=title',
  ].join('&');
  const raw = await drupalGet<any[]>('/node/subscription_payment', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map(mapDrupalSubscriptionPayment);
}

export async function getPaymentHistoryByUser(userId: string): Promise<SubscriptionPayment[]> {
  const params = [
    `filter[field_user.id]=${userId}`,
    'sort=-field_period_start',
    buildInclude(['field_plan']),
    'fields[node--subscription_payment]=id,field_subscription,field_user,field_plan,field_amount,field_stripe_invoice_id,field_stripe_payment_intent,field_payment_status,field_period_start,field_period_end',
    'fields[node--subscription_plan]=title',
  ].join('&');
  const raw = await drupalGet<any[]>('/node/subscription_payment', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map(mapDrupalSubscriptionPayment);
}

export async function updateSubscription(
    subscriptionId: string,
    autoRenewal: boolean
): Promise<void> {
  await drupalPatch(`/node/subscription/${subscriptionId}`, {
    data: {
      type: 'node--subscription',
      id: subscriptionId,
      attributes: {
        field_auto_renewal: autoRenewal,
      },
    },
  });
}

// ── Donations ─────────────────────────────────────────────────────────────────

export async function getDonationsForAuthor(
    userId: string
): Promise<{ donations: Donation[]; total: number }> {
  const tours = await getToursByAuthor(userId);
  if (tours.length === 0) return { donations: [], total: 0 };

  const allDonations: Donation[] = [];
  for (const tour of tours) {
    const params = [
      `filter[field_tour.id]=${tour.id}`,
      buildInclude(['field_user', 'field_tour']),
      'sort=-created',
    ].join('&');
    const raw = await drupalGet<any[]>('/node/donation', params);
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    allDonations.push(...list.map(mapDrupalDonation));
  }

  const total = allDonations.reduce((sum, d) => sum + d.amount, 0);
  return { donations: allDonations, total };
}

// ── Tours quota ───────────────────────────────────────────────────────────────

export interface ToursQuota {
  used: number;
  max: number;
  planType: string;
  billing: string;
}

export async function getToursQuota(): Promise<ToursQuota> {
  const { data } = await axios.get<ToursQuota>(
      `${DRUPAL_BASE}/api/me/tours/quota`,
      { headers: { Accept: 'application/json', ...getDashboardAuthHeader() } },
  );
  return data;
}

// ── Guide-side translation & tour publishing controls ────────────────────────

export interface TourTranslationInfo {
  langcode:  string;
  langName:  string;
  title:     string;
  published: boolean;
}

export interface TranslationsListResponse {
  sourceLang:   string;
  translations: TourTranslationInfo[];
}

export async function listTourTranslations(nid: number): Promise<TranslationsListResponse> {
  const { data } = await axios.get<TranslationsListResponse>(
      `${DRUPAL_BASE}/api/me/tour/${nid}/translations`,
      { headers: { Accept: 'application/json', ...getDashboardAuthHeader() } },
  );
  if (Array.isArray(data)) {
    return { sourceLang: 'en', translations: data as unknown as TourTranslationInfo[] };
  }
  return data;
}

export async function approveTranslation(nid: number, langcode: string): Promise<void> {
  await axios.post(
      `${DRUPAL_BASE}/api/me/tour/${nid}/translation/${langcode}/approve`,
      {},
      { headers: { Accept: 'application/json', ...getDashboardAuthHeader() } },
  );
}

export async function unpublishTranslation(nid: number, langcode: string): Promise<void> {
  await axios.post(
      `${DRUPAL_BASE}/api/me/tour/${nid}/translation/${langcode}/unpublish`,
      {},
      { headers: { Accept: 'application/json', ...getDashboardAuthHeader() } },
  );
}

export async function unpublishTour(nid: number): Promise<void> {
  await axios.post(
      `${DRUPAL_BASE}/api/me/tour/${nid}/unpublish`,
      {},
      { headers: { Accept: 'application/json', ...getDashboardAuthHeader() } },
  );
}

export async function republishTour(nid: number): Promise<void> {
  await axios.post(
      `${DRUPAL_BASE}/api/me/tour/${nid}/republish`,
      {},
      { headers: { Accept: 'application/json', ...getDashboardAuthHeader() } },
  );
}