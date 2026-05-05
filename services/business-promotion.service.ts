// services/business-promotion.service.ts
// Gestión de slots publicitarios para usuarios con rol 'business'.
// Modelo: cada slot tiene su propia suscripción Stripe independiente.
// Agnóstico del backend — toda la lógica de Drupal vive en drupal-client.ts.

import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';
import {
  mapDrupalBusinessPromotion,
  mapDrupalTourWithSlots,
} from '../lib/drupal-client';
import type {
  BusinessPromotion,
  TourWithSlots,
  TourFilters,
  PromotionTargetType,
} from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';

function getAuthHeader(): Record<string, string> {
  const session = useAuthStore.getState().session;
  if (!session?.token) return {};
  return { Authorization: `Basic ${session.token}` };
}

const authHeaders = () => ({
  'Content-Type': 'application/json',
  ...getAuthHeader(),
});

// ── Obtener promociones ───────────────────────────────────────────────────────

export async function getPromotionsByUser(userId: string): Promise<BusinessPromotion[]> {
  const { data } = await axios.get(
    `${BASE_URL}/api/business/promotions?userId=${userId}`,
    { headers: authHeaders() },
  );
  const items: any[] = data?.data ?? [];
  return items.map(mapDrupalBusinessPromotion);
}

export async function getPromotionsByBusiness(businessId: string): Promise<BusinessPromotion[]> {
  const { data } = await axios.get(
    `${BASE_URL}/api/business/promotions?businessId=${businessId}`,
    { headers: authHeaders() },
  );
  const items: any[] = data?.data ?? [];
  return items.map(mapDrupalBusinessPromotion);
}

// ── Añadir slot en trial (sin pago) ──────────────────────────────────────────

export async function addPromotion(payload: {
  businessId: string;
  targetType: PromotionTargetType;
  targetId: string;
}): Promise<BusinessPromotion> {
  const { data } = await axios.post(
    `${BASE_URL}/api/business/promotions`,
    payload,
    { headers: authHeaders() },
  );
  return mapDrupalBusinessPromotion(data?.data);
}

// ── Checkout Stripe para un slot concreto ─────────────────────────────────────
// Paso 1: obtener clientSecret de Stripe para ese slot + plan.
// No crea nada en Drupal todavía.

export async function createSlotCheckoutSession(
  planId: string,
  slotData: { businessId: string; targetType: PromotionTargetType; targetId: string },
): Promise<{ clientSecret: string; checkoutSessionId: string }> {
  const { data } = await axios.post(
    `${BASE_URL}/api/business/promotions/checkout`,
    { planId, ...slotData },
    { headers: authHeaders() },
  );
  return {
    clientSecret: data?.clientSecret ?? '',
    checkoutSessionId: data?.checkoutSessionId ?? '',
  };
}

// ── Confirmar promoción tras pago ──────────────────────────────────────────────
// Paso 2: el frontend confirma el pago, el backend crea subscription + promotion.

export async function confirmSlotPromotion(
  checkoutSessionId: string,
  slotData: { businessId: string; targetType: PromotionTargetType; targetId: string },
): Promise<BusinessPromotion> {
  const { data } = await axios.post(
    `${BASE_URL}/api/business/promotions/confirm`,
    { checkoutSessionId, ...slotData },
    { headers: authHeaders() },
  );
  return mapDrupalBusinessPromotion(data?.data);
}

// ── Cancelar / eliminar un slot ───────────────────────────────────────────────
// Si tiene suscripción, el backend también cancela la Stripe Subscription del slot.

export async function removePromotion(promotionId: string): Promise<void> {
  await axios.delete(
    `${BASE_URL}/api/business/promotions/${promotionId}`,
    { headers: authHeaders() },
  );
}

// ── Renovación automática de UN slot ─────────────────────────────────────────

export async function setSlotAutoRenewal(
  promotionId: string,
  autoRenewal: boolean,
): Promise<void> {
  await axios.post(
    `${BASE_URL}/api/business/promotions/${promotionId}/renewal`,
    { autoRenewal },
    { headers: authHeaders() },
  );
}

// ── Tours con slots disponibles ───────────────────────────────────────────────

export async function getAvailableTourSlots(
  filters?: Pick<TourFilters, 'search' | 'city' | 'page' | 'limit'>,
): Promise<TourWithSlots[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.city)   params.set('city',   filters.city);
  if (filters?.page   !== undefined) params.set('page',  String(filters.page));
  if (filters?.limit  !== undefined) params.set('limit', String(filters.limit));

  const qs = params.toString();
  const { data } = await axios.get(
    `${BASE_URL}/api/tours/available-slots${qs ? `?${qs}` : ''}`,
    { headers: authHeaders() },
  );
  const items: any[] = data?.data ?? [];
  return items.map(mapDrupalTourWithSlots);
}
