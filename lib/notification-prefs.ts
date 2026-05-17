// lib/notification-prefs.ts
// Preferencias de notificaciones del usuario (almacenamiento local).
// El backend también guarda estas preferencias para el cron de push; esta copia
// local permite que el toggle del perfil funcione de forma inmediata y offline.
import AsyncStorage from '@react-native-async-storage/async-storage';

const ABANDONED_TOUR_KEY = 'notif_pref_abandoned_tour';

export async function getAbandonedTourPref(): Promise<boolean> {
  const v = await AsyncStorage.getItem(ABANDONED_TOUR_KEY).catch(() => null);
  return v !== 'false'; // por defecto activado
}

export async function setAbandonedTourPref(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(ABANDONED_TOUR_KEY, enabled ? 'true' : 'false').catch(() => {});
}
