// lib/anon-progress.ts
// Progreso de tour para usuarios anónimos — almacenamiento local, sin backend.
// Web: sessionStorage (se pierde al cerrar el navegador).
// Native: AsyncStorage con timestamp; caduca a las 24h.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'anon_tour_progress:';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

// Key for the "don't show again" dismissal of the AnonInfoModal.
// Kept here so it can be cleared atomically alongside progress.
export const ANON_INFO_DISMISSED_KEY = 'anon_info_modal_dismissed';

// Cross-platform read/write for the AnonInfoModal dismissal.
// Web: sessionStorage — resets automatically when the browser session ends.
// Native: AsyncStorage — cleared explicitly when the TTL expires.
export async function getAnonInfoDismissed(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      if (typeof sessionStorage === 'undefined') return false;
      return sessionStorage.getItem(ANON_INFO_DISMISSED_KEY) === 'true';
    }
    return (await AsyncStorage.getItem(ANON_INFO_DISMISSED_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setAnonInfoDismissed(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof sessionStorage === 'undefined') return;
      sessionStorage.setItem(ANON_INFO_DISMISSED_KEY, 'true');
      return;
    }
    await AsyncStorage.setItem(ANON_INFO_DISMISSED_KEY, 'true');
  } catch {
    // Non-critical
  }
}

export async function clearAnonInfoDismissed(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof sessionStorage === 'undefined') return;
      sessionStorage.removeItem(ANON_INFO_DISMISSED_KEY);
      return;
    }
    await AsyncStorage.removeItem(ANON_INFO_DISMISSED_KEY);
  } catch {
    // Non-critical
  }
}

interface StoredProgress {
  stepIds: string[];
  savedAt: number;
}

function keyFor(tourId: string): string {
  return `${KEY_PREFIX}${tourId}`;
}

export async function getAnonProgress(tourId: string): Promise<string[]> {
  const key = keyFor(tourId);
  try {
    if (Platform.OS === 'web') {
      if (typeof sessionStorage === 'undefined') return [];
      const raw = sessionStorage.getItem(key);
      if (!raw) return [];
      const parsed: StoredProgress = JSON.parse(raw);
      return Array.isArray(parsed.stepIds) ? parsed.stepIds : [];
    }
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed: StoredProgress = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > TTL_MS) {
      await AsyncStorage.removeItem(key);
      await AsyncStorage.removeItem(ANON_INFO_DISMISSED_KEY);
      return [];
    }
    return Array.isArray(parsed.stepIds) ? parsed.stepIds : [];
  } catch {
    return [];
  }
}

export async function setAnonProgress(tourId: string, stepIds: string[]): Promise<void> {
  const key = keyFor(tourId);
  const payload: StoredProgress = { stepIds, savedAt: Date.now() };
  try {
    if (Platform.OS === 'web') {
      if (typeof sessionStorage === 'undefined') return;
      sessionStorage.setItem(key, JSON.stringify(payload));
      return;
    }
    await AsyncStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // No crítico — el progreso anónimo es efímero por diseño
  }
}

export async function clearAnonProgress(tourId: string): Promise<void> {
  const key = keyFor(tourId);
  try {
    if (Platform.OS === 'web') {
      if (typeof sessionStorage === 'undefined') return;
      sessionStorage.removeItem(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  } catch {
    // No crítico
  }
}
