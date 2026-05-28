// services/comments.service.ts
// Admin↔Guide messaging via Drupal comment module.
//
// Comment types and their node--tour field names:
//   tour_review              → field_tour_review
//   tour_translation_request → field_tour_transl_req
//   tour_translation_review  → field_tour_transl_rev
//
// JSON:API endpoints used:
//   GET  /jsonapi/comment/{type}?filter[entity_id.id]={tourUuid}&include=uid
//   POST /jsonapi/comment/{type}
//   PATCH /jsonapi/comment/{type}/{uuid}   (mark read / resolve)

import axios from 'axios';
import { drupalGetJsonApiBaseRaw, drupalPost, drupalPatch } from '../lib/drupal-client';
import { useAuthStore } from '../stores/auth.store';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ThreadType =
  | 'tour_review'
  | 'tour_translation_request'
  | 'tour_translation_review';

/** Machine-name of the comment field on node--tour for each thread type. */
const THREAD_FIELD: Record<ThreadType, string> = {
  tour_review:              'field_tour_review',
  tour_translation_request: 'field_tour_transl_req',
  tour_translation_review:  'field_tour_transl_rev',
};

export interface TourComment {
  id: string;
  tourId: string;          // UUID of the parent tour node
  threadType: ThreadType;
  body: string;
  authorId: string;
  authorPublicName: string;
  createdAt: string;       // ISO 8601
  resolved: boolean;
  readByAuthor: boolean;
  /** Optional i18n message key for backend-automated messages.
   *  When present, the frontend should render `t(messageKey, messageParams)`
   *  instead of `body`. Falls back to body for human-written messages. */
  messageKey?: string | null;
  messageParams?: Record<string, any> | null;
}

/** Extracts the i18n key + params from a JSON:API attributes object. */
function extractI18nMessage(attrs: any): { key: string | null; params: Record<string, any> | null } {
  // field_msg_key may come as a flat string or an array of { value }.
  const keyRaw = attrs?.field_msg_key;
  const key: string | null = typeof keyRaw === 'string' && keyRaw.length > 0
    ? keyRaw
    : (Array.isArray(keyRaw) && keyRaw[0]?.value) ? String(keyRaw[0].value) : null;

  // field_msg_params is text_long → { value, format } or a plain string.
  const paramsRaw = attrs?.field_msg_params;
  let paramsStr: string | null = null;
  if (typeof paramsRaw === 'string') {
    paramsStr = paramsRaw;
  } else if (paramsRaw?.value) {
    paramsStr = String(paramsRaw.value);
  } else if (Array.isArray(paramsRaw) && paramsRaw[0]?.value) {
    paramsStr = String(paramsRaw[0].value);
  }

  let params: Record<string, any> | null = null;
  if (paramsStr) {
    try { params = JSON.parse(paramsStr); } catch { params = null; }
  }

  return { key, params };
}

// ── Mapping ────────────────────────────────────────────────────────────────────

function mapComment(raw: any, included: any[], threadType: ThreadType): TourComment {
  const attrs = raw.attributes ?? {};
  const rels  = raw.relationships ?? {};

  // Resolve author display name from included.
  const authorRel = rels.uid?.data;
  const authorNode = authorRel
    ? included.find((n: any) => n.type === 'user--user' && n.id === authorRel.id)
    : null;
  const authorPublicName =
    authorNode?.attributes?.display_name ??
    authorNode?.attributes?.name ??
    attrs.name ??
    'Unknown';

  const { key: messageKey, params: messageParams } = extractI18nMessage(attrs);

  return {
    id:               raw.id,
    tourId:           rels.entity_id?.data?.id ?? '',
    threadType,
    body:             attrs.comment_body?.value ?? attrs.comment_body?.processed ?? '',
    authorId:         authorRel?.id ?? '',
    authorPublicName,
    createdAt:        attrs.created ?? '',
    resolved:         attrs.field_resolved ?? false,
    readByAuthor:     attrs.field_read_by_author ?? false,
    messageKey,
    messageParams,
  };
}

// ── API calls ─────────────────────────────────────────────────────────────────

/**
 * Fetch all comments for a tour in a given thread.
 * Always uses the base (non-lang) client so comments are never filtered by
 * translation status.
 */
export async function getTourComments(
  tourUuid: string,
  threadType: ThreadType,
): Promise<TourComment[]> {
  const params = new URLSearchParams({
    'filter[entity_id.id]': tourUuid,
    'filter[field_name]':   THREAD_FIELD[threadType],
    'include':              'uid',
    'sort':                 'created',
    'page[limit]':          '100',
  });

  const response = await drupalGetJsonApiBaseRaw(`/comment/${threadType}?${params}`);
  const items: any[]    = response.data ?? [];
  const included: any[] = response.included ?? [];

  return items.map((item: any) => mapComment(item, included, threadType));
}

/**
 * Post a new comment on a tour thread.
 * Requires the user to be authenticated.
 */
export async function postTourComment(
  tourUuid: string,
  tourNid: number,
  threadType: ThreadType,
  body: string,
): Promise<TourComment> {
  const fieldName = THREAD_FIELD[threadType];

  // NOTE: do NOT include a `comment_type` relationship — the bundle is already
  // conveyed by `type: comment--{threadType}`. Passing it with the machine name
  // as `id` makes JSON:API look up a comment_type resource by that UUID and
  // fail ("resource ... could not be found"). `entity_type` must be set so
  // Drupal knows the commented entity is a node.
  //
  // We DO NOT send `langcode` either — drupalClient already targets
  // /<currentLangcode>/jsonapi/ so Drupal derives it from the URL prefix.
  // Sending it from the frontend invited a class of bug where the full
  // Language object ({id,name,direction,isDefault}) leaked into the payload
  // and Drupal rejected it with "properties … do not exist on the langcode
  // field of type language".
  const payload = {
    data: {
      type: `comment--${threadType}`,
      attributes: {
        subject:      threadType,
        comment_body: { value: body, format: 'plain_text' },
        field_name:   fieldName,
        entity_type:  'node',
      },
      relationships: {
        entity_id: {
          data: { type: 'node--tour', id: tourUuid },
        },
      },
    },
  };

  // `drupalPost` deserialises with Jsona, so the result is a *flat* object
  // (no `.data` / `.attributes` envelope) — different from `getTourComments`
  // which uses `drupalGetJsonApiBaseRaw` and gets the raw JSON:API shape.
  // Map the flat resource directly here.
  const raw: any = await drupalPost(`/comment/${threadType}`, payload);

  return {
    id:               raw?.id ?? '',
    tourId:           raw?.entity_id?.id ?? tourUuid,
    threadType,
    body:             raw?.comment_body?.value ?? body,
    authorId:         raw?.uid?.id ?? '',
    authorPublicName: raw?.uid?.display_name ?? raw?.uid?.name ?? raw?.name ?? '',
    createdAt:        raw?.created ?? new Date().toISOString(),
    resolved:         raw?.field_resolved ?? false,
    readByAuthor:     raw?.field_read_by_author ?? false,
    // Human-posted comments never carry an auto i18n key.
    messageKey:       null,
    messageParams:    null,
  };
}

/**
 * Mark a comment as read by the guide author.
 */
export async function markCommentRead(commentId: string, threadType: ThreadType): Promise<void> {
  await drupalPatch(`/comment/${threadType}/${commentId}`, {
    data: {
      type: `comment--${threadType}`,
      id:   commentId,
      attributes: { field_read_by_author: true },
    },
  });
}

/**
 * Resolve / close a comment thread (admin action).
 */
export async function resolveComment(commentId: string, threadType: ThreadType): Promise<void> {
  await drupalPatch(`/comment/${threadType}/${commentId}`, {
    data: {
      type: `comment--${threadType}`,
      id:   commentId,
      attributes: { field_resolved: true },
    },
  });
}

// ── Unread counters per thread for a given tour ──────────────────────────────

/**
 * Returns `{ tour_review: N, tour_translation_request: N, tour_translation_review: N }`
 * — the number of unread comments addressed to the guide (i.e. not authored by
 * the guide themself) for each of the 3 threads of one specific tour.
 */
export async function getUnreadCountByThread(
  guideUserId: string,
  tourUuid: string,
): Promise<Record<ThreadType, number>> {
  const threadTypes: ThreadType[] = [
    'tour_review',
    'tour_translation_request',
    'tour_translation_review',
  ];
  const out: Record<ThreadType, number> = {
    tour_review:              0,
    tour_translation_request: 0,
    tour_translation_review:  0,
  };

  await Promise.all(
    threadTypes.map(async (threadType) => {
      try {
        const params = new URLSearchParams({
          'filter[entity_id.id]':         tourUuid,
          'filter[field_read_by_author]': '0',
          'include':                      'uid',
          'page[limit]':                  '100',
        });
        const response = await drupalGetJsonApiBaseRaw(`/comment/${threadType}?${params}`);
        const items: any[]    = response.data ?? [];
        const included: any[] = response.included ?? [];
        items.forEach((item: any) => {
          const c = mapComment(item, included, threadType);
          if (c.authorId !== guideUserId) {
            out[threadType] += 1;
          }
        });
      } catch {
        /* silent */
      }
    }),
  );

  return out;
}

// ── Admin inbox ───────────────────────────────────────────────────────────────

export interface AdminInboxThreadTotals {
  total: number;
  unreadFromGuide: number;
}

export interface AdminInboxTour {
  tourId: string;
  tourNid: number;
  tourTitle: string;
  ownerId: string | null;
  ownerName: string | null;
  lastCommentAt: string;
  totals: {
    review:             AdminInboxThreadTotals;
    translationRequest: AdminInboxThreadTotals;
    translationReview:  AdminInboxThreadTotals;
  };
}

/**
 * Admin-only: list all tours with message activity, with per-thread counts
 * and a "lastCommentAt" timestamp. Sorted by most recent first.
 */
export async function getAdminMessagesInbox(): Promise<AdminInboxTour[]> {
  const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
  const session  = useAuthStore.getState().session;
  const headers: Record<string, string> = {};
  if (session?.token) {
    headers.Authorization = `${session.tokenType === 'bearer' ? 'Bearer' : 'Basic'} ${session.token}`;
  }
  const { data } = await axios.get<AdminInboxTour[]>(
    `${BASE_URL}/api/admin/messages/inbox`,
    { headers },
  );
  return Array.isArray(data) ? data : [];
}

/**
 * Returns a map of tourUuid → unread count for a given guide user.
 * "Unread" = comments where field_read_by_author = false AND author != guideUserId
 * (i.e., messages FROM admin that the guide hasn't read yet).
 */
export async function getUnreadCountByTour(
  guideUserId: string,
): Promise<Record<string, number>> {
  const threadTypes: ThreadType[] = [
    'tour_review',
    'tour_translation_request',
    'tour_translation_review',
  ];

  const allComments: TourComment[] = [];

  await Promise.all(
    threadTypes.map(async (threadType) => {
      try {
        const params = new URLSearchParams({
          'filter[field_read_by_author]': '0',
          'include':                      'uid,entity_id',
          'page[limit]':                  '200',
        });
        const response = await drupalGetJsonApiBaseRaw(`/comment/${threadType}?${params}`);
        const items: any[]    = response.data ?? [];
        const included: any[] = response.included ?? [];
        items.forEach((item: any) => {
          const c = mapComment(item, included, threadType);
          // Count only if the comment was NOT written by the guide themselves.
          if (c.authorId !== guideUserId) {
            allComments.push(c);
          }
        });
      } catch {
        // Silently skip if comment type endpoint is unavailable.
      }
    }),
  );

  const result: Record<string, number> = {};
  for (const c of allComments) {
    if (c.tourId) {
      result[c.tourId] = (result[c.tourId] ?? 0) + 1;
    }
  }
  return result;
}
