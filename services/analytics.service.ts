import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../stores/auth.store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';
const ENDPOINT = `${BASE_URL}/api/analytics/events`;
const CONSENT_KEY = 'cookie_consent';
const SESSION_KEY = 'analytics_session_id';
const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 5000;
const MAX_QUEUE_SIZE = 100;

export type AnalyticsEventType =
  | 'site_view'
  | 'tour_view'
  | 'tour_start'
  | 'tour_complete'
  | 'tour_abandon'
  | 'tour_share'
  | 'tour_favorite'
  | 'tour_donation_click'
  | 'step_view'
  | 'step_complete'
  | 'step_abandon'
  | 'business_link_click'
  | 'search_query'
  | 'filter_apply'
  | 'user_register';

export interface AnalyticsEvent {
  event_type: AnalyticsEventType;
  session_id: string;
  user_hash?: string;
  tour_id?: string;
  step_id?: string;
  business_id?: string;
  langcode: string;
  platform: 'web' | 'ios' | 'android';
  value_int?: number;
  value_str?: string;
  is_anonymous: 1 | 0;
  created_at: number;
}

export interface SiteSummary {
  total_views: number;
  anon_views: number;
  registered_views: number;
  new_registrations: number;
  total_searches: number;
}

export interface TourSummary {
  tour_id: string;
  title: string;
  views: number;
  starts: number;
  completions: number;
  abandonments: number;
  avg_abandonment_pct: number;
  shares: number;
  completion_rate: number;
  avg_step_duration_s?: number; // optional — populated by backend if available
}

export interface StepAnalytics {
  step_id: string;
  title: string;
  order: number;
  views: number;                // step_view events = "I'm here" clicks
  completions: number;          // step_complete events
  avg_duration_seconds: number; // avg time with step open
  drop_rate: number;            // 1 - (completions / previous_step_completions)
}

export interface TourAnalyticsDetail {
  tour_id: string;
  title: string;
  period: { from: string; to: string };
  views: number;
  starts: number;
  completions: number;
  completion_rate: number;
  avg_abandonment_pct: number;
  shares: number;
  steps: StepAnalytics[];
}

export interface BusinessSummary {
  business_id: string;
  name: string;
  step_views: number;
  total_link_clicks: number;
  website_clicks: number;
  phone_clicks: number;
  maps_clicks: number;
  click_through_rate: number;
  avg_time_on_step_seconds: number;
}

export interface DatePoint {
  date: string;
  views: number;
  completions: number;
  abandonments: number;
}

export interface AnalyticsSummary {
  site: SiteSummary;
  tours: TourSummary[];
  date_series: DatePoint[];
}

export interface BusinessAnalytics {
  business_id: string;
  period: { from: string; to: string };
  step_views: number;
  website_clicks: number;
  phone_clicks: number;
  maps_clicks: number;
  total_link_clicks: number;
  click_through_rate: number;
  avg_time_on_step_seconds: number;
  top_tours: { tour_id: string; tour_title: string; step_views: number; ctr: number }[];
}

let _queue: AnalyticsEvent[] = [];
let _flushTimer: ReturnType<typeof setInterval> | null = null;
let _consentGranted: boolean | null = null;
let _sessionId: string | null = null;

async function sha256(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return '';
}

function getPlatform(): 'web' | 'ios' | 'android' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

async function getOrCreateSessionId(): Promise<string> {
  if (_sessionId) return _sessionId;
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    _sessionId = id;
    return id;
  }
  // Native: nuevo UUID por cold start (equivalente a cerrar tab en web)
  _sessionId = crypto.randomUUID();
  return _sessionId;
}

async function isConsentGranted(): Promise<boolean> {
  if (_consentGranted !== null) return _consentGranted;
  let stored: string | null = null;
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    stored = localStorage.getItem(CONSENT_KEY);
  } else {
    stored = await AsyncStorage.getItem(CONSENT_KEY).catch(() => null);
  }
  _consentGranted = stored === 'accepted';
  return _consentGranted;
}

export function notifyConsentGranted(): void {
  _consentGranted = true;
  startFlushLoop();
}

export function notifyConsentRevoked(): void {
  _consentGranted = false;
  _queue = [];
  stopFlushLoop();
}

function startFlushLoop(): void {
  if (_flushTimer) return;
  _flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
}

function stopFlushLoop(): void {
  if (_flushTimer) {
    clearInterval(_flushTimer);
    _flushTimer = null;
  }
}

async function flush(): Promise<void> {
  if (_queue.length === 0) return;
  const batch = _queue.splice(0, BATCH_SIZE);
  try {
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      // keepalive permite que el request sobreviva a beforeunload en web
      ...(Platform.OS === 'web' ? { keepalive: true } : {}),
    });
  } catch {
    // Reencolar al frente si hay espacio para evitar pérdida de eventos offline
    if (_queue.length < MAX_QUEUE_SIZE) {
      _queue.unshift(...batch);
    }
  }
}

export async function flushNow(): Promise<void> {
  stopFlushLoop();
  await flush();
  startFlushLoop();
}

export async function initAnalytics(): Promise<void> {
  const granted = await isConsentGranted();
  if (granted) startFlushLoop();
}

export async function track(
  eventType: AnalyticsEventType,
  params: {
    langcode: string;
    tourId?: string;
    stepId?: string;
    businessId?: string;
    valueInt?: number;
    valueStr?: string;
  }
): Promise<void> {
  const granted = await isConsentGranted();
  if (!granted) return;

  const sessionId = await getOrCreateSessionId();
  const user = useAuthStore.getState().user;
  const userHash = user ? await sha256(user.id) : undefined;

  const event: AnalyticsEvent = {
    event_type: eventType,
    session_id: sessionId,
    user_hash: userHash || undefined,
    tour_id: params.tourId,
    step_id: params.stepId,
    business_id: params.businessId,
    langcode: params.langcode,
    platform: getPlatform(),
    value_int: params.valueInt,
    value_str: params.valueStr,
    is_anonymous: user ? 0 : 1,
    created_at: Math.floor(Date.now() / 1000),
  };

  _queue.push(event);
  if (!_flushTimer) startFlushLoop();
  if (_queue.length >= BATCH_SIZE) void flush();
}

export async function fetchAnalyticsSummary(
  from: string,
  to: string,
  tourId?: string,
  langcode?: string
): Promise<AnalyticsSummary> {
  const params = new URLSearchParams({ from, to });
  if (tourId) params.set('tour_id', tourId);
  if (langcode) params.set('langcode', langcode);
  const session = useAuthStore.getState().session;
  const res = await fetch(`${BASE_URL}/api/analytics/summary?${params}`, {
    headers: { Authorization: `Basic ${session?.token}` },
  });
  return res.json();
}

export async function fetchBusinessAnalytics(
  businessId: string,
  from: string,
  to: string
): Promise<BusinessAnalytics> {
  const session = useAuthStore.getState().session;
  const res = await fetch(
    `${BASE_URL}/api/analytics/business/${businessId}?from=${from}&to=${to}`,
    { headers: { Authorization: `Basic ${session?.token}` } }
  );
  return res.json();
}

// GET /api/analytics/tour/{tour_id}?from=&to=
export async function fetchTourAnalytics(
  tourId: string,
  from: string,
  to: string
): Promise<TourAnalyticsDetail> {
  const session = useAuthStore.getState().session;
  const res = await fetch(
    `${BASE_URL}/api/analytics/tour/${tourId}?from=${from}&to=${to}`,
    { headers: { Authorization: `Basic ${session?.token}` } }
  );
  return res.json();
}

// GET /api/analytics/businesses?from=&to=  (admin only)
export async function fetchAllBusinessAnalytics(
  from: string,
  to: string
): Promise<BusinessSummary[]> {
  const session = useAuthStore.getState().session;
  const res = await fetch(
    `${BASE_URL}/api/analytics/businesses?from=${from}&to=${to}`,
    { headers: { Authorization: `Basic ${session?.token}` } }
  );
  return res.json();
}
