// stores/auth.store.ts
// Estado global de autenticación

import { create } from 'zustand';
import { login, logout, restoreSession, register } from '../services/auth.service';
import { inactivityTracker } from '../lib/session';
import type { AuthCredentials, AuthSession, User } from '../types';

interface AuthState {
  session: AuthSession | null;
  user: User | null;
  isLoading: boolean;
  isNewLogin: boolean;
  error: string | null;
  pendingAuthModal: 'login' | 'register' | null;
  // Actions
  signIn: (credentials: AuthCredentials) => Promise<void>;
  signUp: (data: { username: string; publicName?: string; email: string; password: string; role?: 'guide' | 'business'; langcode?: string; preferredLanguage?: string }) => Promise<void>;
  signInWithGoogle: (googleIdToken: string, role?: 'guide' | 'business', preferredLanguage?: string) => Promise<void>;
  signOut: () => Promise<void>;
  restore: () => Promise<void>;
  clearError: () => void;
  clearNewLogin: () => void;
  openAuthModal: (mode: 'login' | 'register') => void;
  closeAuthModal: () => void;
  updateProfile: (updates: Partial<{ publicName: string; preferredLanguage: string; countryId: string }>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLoading: false,
  isNewLogin: false,
  error: null,
  pendingAuthModal: null,
  signIn: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const session = await login(credentials, credentials.rememberMe ?? false);
      set({ session, user: session.user, isLoading: false, isNewLogin: true });
      inactivityTracker.start(() => { get().signOut(); }, { rememberMe: credentials.rememberMe ?? false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Error al iniciar sesión' });
    }
  },

  signUp: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const session = await register(data);
      set({ session, user: session.user });
      inactivityTracker.start(() => { get().signOut(); }, { rememberMe: false });
      if (data.preferredLanguage) {
        // Update preferred language BEFORE setting isNewLogin so the layout
        // redirect reads the correct language when the effect fires.
        await get().updateProfile({ preferredLanguage: data.preferredLanguage });
      }
      set({ isNewLogin: true });
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Error al registrarse' });
      return;
    }
    set({ isLoading: false });
  },

  signInWithGoogle: async (googleIdToken, role, preferredLanguage?) => {
    set({ isLoading: true, error: null });
    try {
      const { loginWithGoogle } = await import('../services/auth.service');
      const session = await loginWithGoogle(googleIdToken, role);
      set({ session, user: session.user });
      inactivityTracker.start(() => { get().signOut(); }, { rememberMe: false });
      if (preferredLanguage) {
        await get().updateProfile({ preferredLanguage });
      }
      set({ isLoading: false, isNewLogin: true });
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Google sign-in failed' });
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    await logout();
    set({ session: null, user: null, isLoading: false, error: null });
  },

  restore: async () => {
    set({ isLoading: true });
    try {
      const session = await restoreSession();
      if (session) {
        set({ session, user: session.user, isNewLogin: false });
        inactivityTracker.start(() => { get().signOut(); }, { rememberMe: session.rememberMe ?? false });
      }
    } catch {
      // Sesión inválida o expirada — no hacer nada
    } finally {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
  clearNewLogin: () => set({ isNewLogin: false }),
  openAuthModal: (mode) => set({ pendingAuthModal: mode }),
  closeAuthModal: () => set({ pendingAuthModal: null }),
  updateProfile: async (updates) => {
    const user = get().user;
    if (!user) return;

    // Dynamic import para evitar dependencias circulares
    const { updateUserProfile } = await import('../services/user.service');
    const updatedUser = await updateUserProfile(user.id, updates);

    // Conservar roles del estado actual — JSON:API no permite leerlos
    // sin permisos de admin, por lo que updateUserProfile no los devuelve
    set({
      user: {
        ...updatedUser,
        roles: user.roles,
      },
    });
  },
}));
