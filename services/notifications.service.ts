// services/notifications.service.ts
// Registro de push notifications (Expo) y sincronización del token con el backend.
//
// expo-notifications / expo-device se cargan de forma diferida (require dentro de
// try/catch) para que la app siga compilando aunque las dependencias todavía no
// estén instaladas o en plataformas donde no aplican (web).
import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';
import { isNative } from '../lib/platform';
import { getAbandonedTourPref } from '../lib/notification-prefs';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';

function getAuthHeader(): Record<string, string> {
  const session = useAuthStore.getState().session;
  if (!session?.token) return {};
  return { Authorization: `Basic ${session.token}` };
}

function loadNotifications(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-notifications');
  } catch {
    return null;
  }
}

function loadDevice(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-device');
  } catch {
    return null;
  }
}

/**
 * Pide permisos y devuelve el Expo push token, o null si no es posible.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (!isNative) return null;
  const Notifications = loadNotifications();
  const Device = loadDevice();
  if (!Notifications) return null;

  try {
    if (Device && !Device.isDevice) return null; // los simuladores no reciben push

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    const tokenResult = await Notifications.getExpoPushTokenAsync();
    return tokenResult?.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Registra el token push en el backend para el usuario autenticado.
 * Idempotente: seguro de llamar en cada arranque de la app.
 */
export async function syncPushToken(): Promise<void> {
  if (!isNative) return;
  const session = useAuthStore.getState().session;
  if (!session?.token) return;

  const enabled = await getAbandonedTourPref();
  const token = enabled ? await getExpoPushToken() : null;

  try {
    await axios.post(
      `${BASE_URL}/api/user/push-token`,
      { token, enabled },
      { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } },
    );
  } catch {
    // Endpoint backend opcional — no es crítico para el funcionamiento de la app.
  }
}

/**
 * Configura el handler de toques en notificaciones. Devuelve una función de
 * limpieza. `onTourReminder` recibe el tourId embebido en la notificación.
 */
export function addNotificationTapListener(
  onTourReminder: (tourId: string) => void,
): () => void {
  const Notifications = loadNotifications();
  if (!Notifications) return () => {};

  const sub = Notifications.addNotificationResponseReceivedListener((response: any) => {
    const data = response?.notification?.request?.content?.data;
    if (data?.tourId) onTourReminder(String(data.tourId));
  });
  return () => sub?.remove?.();
}
