// lib/session.ts
// Gestión de sesión, almacenamiento seguro, cookies e inactividad
// Agnóstico del backend

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { AuthSession } from '../types';

const SESSION_KEY          = 'app_session';
const REMEMBER_ME_FLAG_KEY = 'app_session_remember';
const INACTIVITY_TIMEOUT_MS  = 60 * 60 * 1000;          // 1 hora
const REMEMBER_ME_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

// ── Abstracción de almacenamiento ─────────────────────────────────────────────
// En web usa localStorage para que la sesión se comparta entre pestañas.
// REMEMBER_ME_FLAG_KEY solo controla la duración del timeout de inactividad.
// En nativo usa SecureStore.

const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },

  async set(key: string, value: string, rememberMe = false): Promise<void> {
    if (Platform.OS === 'web') {
      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_FLAG_KEY, '1');
      } else {
        localStorage.removeItem(REMEMBER_ME_FLAG_KEY);
      }
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },

  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      localStorage.removeItem(REMEMBER_ME_FLAG_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

// ── Session Storage ───────────────────────────────────────────────────────────

export const sessionStorage = {
  async getSession(): Promise<AuthSession | null> {
    try {
      const raw = await storage.get(SESSION_KEY);
      if (!raw) return null;
      const session: AuthSession = JSON.parse(raw);

      // Verificar expiración si existe
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        await this.clearSession();
        return null;
      }

      return session;
    } catch {
      return null;
    }
  },

  async saveSession(session: AuthSession, rememberMe = false): Promise<void> {
    await storage.set(SESSION_KEY, JSON.stringify(session), rememberMe);
  },

  async clearSession(): Promise<void> {
    await storage.remove(SESSION_KEY);
    inactivityTracker.reset();
  },

  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return session !== null;
  },

  async getToken(): Promise<string | null> {
    const session = await this.getSession();
    return session?.token ?? null;
  },

  async getUser(): Promise<AuthSession['user'] | null> {
    const session = await this.getSession();
    return session?.user ?? null;
  },
};

// ── Inactivity Tracker ────────────────────────────────────────────────────────

type InactivityCallback = () => void;

export const inactivityTracker = (() => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let onExpire: InactivityCallback | null = null;
  let isPaused  = false;
  let timeoutMs = INACTIVITY_TIMEOUT_MS;

  const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

  const schedule = () => {
    if (timer) clearTimeout(timer);
    if (!onExpire || isPaused) return;
    timer = setTimeout(() => {
      void sessionStorage.clearSession();
      onExpire?.();
    }, timeoutMs);
  };

  const reset = () => {
    if (isPaused) return;
    schedule();
  };

  const pause = () => {
    if (isPaused) return;
    isPaused = true;
    if (timer) { clearTimeout(timer); timer = null; }
  };

  const resume = () => {
    if (!isPaused) return;
    isPaused = false;
    schedule();
  };

  const handleActivity = () => reset();

  const handleVisibilityChange = () => {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'visible') {
      resume();
    } else {
      pause();
    }
  };

  const start = (callback: InactivityCallback, opts?: { rememberMe?: boolean }) => {
    onExpire  = callback;
    isPaused  = false;
    timeoutMs = opts?.rememberMe ? REMEMBER_ME_TIMEOUT_MS : INACTIVITY_TIMEOUT_MS;
    schedule();
    if (Platform.OS === 'web') {
      ACTIVITY_EVENTS.forEach((e) =>
        window.addEventListener(e, handleActivity, { passive: true }),
      );
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
  };

  const stop = () => {
    if (timer) clearTimeout(timer);
    timer    = null;
    onExpire = null;
    isPaused = false;
    if (Platform.OS === 'web') {
      ACTIVITY_EVENTS.forEach((e) =>
        window.removeEventListener(e, handleActivity),
      );
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    }
  };

  return { start, stop, reset, pause, resume };
})();

// ── Cross-tab session sync ────────────────────────────────────────────────────
// El evento 'storage' solo se emite en otras pestañas, no en la actual.
// Úsalo para propagar logout/login a todas las pestañas abiertas.

export function subscribeToExternalSessionChange(onLogout: () => void): () => void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return () => {};

  const handler = (e: StorageEvent) => {
    if (e.key === SESSION_KEY && e.newValue === null) {
      // La sesión fue eliminada en otra pestaña → logout aquí también
      onLogout();
    }
  };

  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

// ── Cookie helpers (web only) ─────────────────────────────────────────────────

export const cookieStorage = {
  set(name: string, value: string, days = 7): void {
    if (Platform.OS !== 'web') return;
    const expires = new Date();
    expires.setDate(expires.getDate() + days);
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
  },

  get(name: string): string | null {
    if (Platform.OS !== 'web') return null;
    const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    return match ? decodeURIComponent(match[2]) : null;
  },

  remove(name: string): void {
    if (Platform.OS !== 'web') return;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  },
};

// ── Preferencias del usuario (no sensibles) ───────────────────────────────────

const PREFS_KEY = 'app_preferences';

export interface UserPreferences {
  language: string;
  theme: 'light' | 'dark' | 'system';
  currency: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'es',
  theme: 'system',
  currency: 'EUR',
};

export const preferencesStorage = {
  get(): UserPreferences {
    if (Platform.OS !== 'web') return DEFAULT_PREFERENCES;
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES;
    } catch {
      return DEFAULT_PREFERENCES;
    }
  },

  set(prefs: Partial<UserPreferences>): void {
    if (Platform.OS !== 'web') return;
    const current = this.get();
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
  },

  clear(): void {
    if (Platform.OS !== 'web') return;
    localStorage.removeItem(PREFS_KEY);
  },
};
