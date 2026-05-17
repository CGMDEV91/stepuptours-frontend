// lib/web-handoff.ts
// Abre la web app de StepUp Tours en el navegador, autenticando al usuario cuando
// es posible. Las apps nativas NO procesan pagos: promociones, suscripciones y
// donaciones se gestionan en la web para evitar la comisión de las tiendas.
//
// Handoff de sesión: si el backend expone `/api/auth/web-handoff-token`, se obtiene
// un token de un solo uso y se abre `<WEB_URL>/<lang>/handoff?token=...&next=<path>`,
// de modo que la web inicie sesión automáticamente. Si no, se abre la ruta normal
// y el usuario inicia sesión manualmente.
import axios from 'axios';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../stores/auth.store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';
// URL pública de la web app (frontend).
const WEB_URL = process.env.EXPO_PUBLIC_SITE_URL ?? API_URL;

function getAuthHeader(): Record<string, string> {
  const session = useAuthStore.getState().session;
  if (!session?.token) return {};
  return { Authorization: `Basic ${session.token}` };
}

async function fetchHandoffToken(): Promise<string | null> {
  const session = useAuthStore.getState().session;
  if (!session?.token) return null;
  try {
    const { data } = await axios.post(
      `${API_URL}/api/auth/web-handoff-token`,
      {},
      { headers: { 'Content-Type': 'application/json', ...getAuthHeader() }, timeout: 8000 },
    );
    return data?.token ?? null;
  } catch {
    return null;
  }
}

/**
 * Abre una ruta de la web app. `path` debe empezar por "/" e incluir el langcode,
 * p. ej. "/es/dashboard". Devuelve cuando el navegador in-app se cierra.
 */
export async function openWebAuthenticated(path: string): Promise<void> {
  const token = await fetchHandoffToken();
  const url = token
    ? `${WEB_URL}/handoff?token=${encodeURIComponent(token)}&next=${encodeURIComponent(path)}`
    : `${WEB_URL}${path}`;
  await WebBrowser.openBrowserAsync(url);
}
