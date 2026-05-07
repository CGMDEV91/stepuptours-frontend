// services/payouts.service.ts
// Stripe Connect Express onboarding & dashboard for guides.
// Agnóstico del backend — usa los endpoints custom /api/guide/stripe/*.

import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';
import type { StripeOnboardStatus } from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';

function authHeaders(): Record<string, string> {
  const session = useAuthStore.getState().session;
  return {
    'Content-Type': 'application/json',
    ...(session?.token ? { Authorization: `Basic ${session.token}` } : {}),
  };
}

export interface OnboardResult {
  onboardingUrl: string;
  stripeAccountId: string;
  expiresAt: number;
}

export interface DashboardResult {
  dashboardUrl: string;
}

/**
 * Crea (o reanuda) el onboarding de Stripe Express para el guía.
 * Devuelve una URL que debe abrirse en el navegador o un WebView.
 */
export async function startOnboarding(
  returnUrl: string,
  refreshUrl: string,
): Promise<OnboardResult> {
  try {
    const { data } = await axios.post(
      `${BASE_URL}/api/guide/stripe/onboard`,
      { returnUrl, refreshUrl },
      { headers: authHeaders() },
    );
    return {
      onboardingUrl: data?.onboardingUrl ?? '',
      stripeAccountId: data?.stripeAccountId ?? '',
      expiresAt: data?.expiresAt ?? 0,
    };
  } catch (err: any) {
    if (err?.response?.status === 503) throw new StripeNotConfiguredError();
    throw err;
  }
}

export class NoProfileError extends Error {
  constructor() { super('no_profile'); }
}

export class StripeNotConfiguredError extends Error {
  constructor() { super('stripe_not_configured'); }
}

/**
 * Comprueba si el guía ha completado el onboarding en Stripe.
 * Lanza NoProfileError si el guía no tiene professional_profile aún.
 */
export async function getOnboardStatus(): Promise<StripeOnboardStatus> {
  try {
    const { data } = await axios.get(
      `${BASE_URL}/api/guide/stripe/onboard/status`,
      { headers: authHeaders() },
    );
    return {
      onboardingComplete: data?.onboardingComplete ?? false,
      stripeAccountId: data?.stripeAccountId ?? null,
      payoutsEnabled: data?.payoutsEnabled ?? false,
      chargesEnabled: data?.chargesEnabled ?? false,
      detailsSubmitted: data?.detailsSubmitted ?? false,
    };
  } catch (err: any) {
    if (err?.response?.status === 404) throw new NoProfileError();
    throw err;
  }
}

/**
 * Genera un link de acceso al Express Dashboard de Stripe.
 * Solo funciona si el onboarding está completo.
 */
export async function getStripeDashboardUrl(): Promise<string> {
  const { data } = await axios.post(
    `${BASE_URL}/api/guide/stripe/dashboard`,
    {},
    { headers: authHeaders() },
  );
  return data?.dashboardUrl ?? '';
}
