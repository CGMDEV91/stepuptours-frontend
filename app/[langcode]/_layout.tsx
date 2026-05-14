// app/[langcode]/_layout.tsx
// Valida el langcode de la URL, sincroniza stores, renderiza Navbar
import { useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { Slot, useLocalSearchParams, usePathname, useRouter, useSegments } from 'expo-router';
import { inactivityTracker, subscribeToExternalSessionChange } from '../../lib/session';
import { setApiLanguage } from '../../lib/drupal-client';
import { useLanguageStore } from '../../stores/language.store';
import { useAuthStore } from '../../stores/auth.store';
import { AuthModals } from '../../components/layout/AuthModals';
import { Navbar } from '../../components/layout/Navbar';
import CookieBanner from '../../components/layout/CookieBanner';

export default function LangcodeLayout() {
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const languages = useLanguageStore((s) => s.languages);
  const currentLanguage = useLanguageStore((s) => s.currentLanguage);
  const setLanguageByCode = useLanguageStore((s) => s.setLanguageByCode);
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

  // Auth modal state — driven by Zustand so any page can trigger it
  const pendingAuthModal = useAuthStore((s) => s.pendingAuthModal);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);
  const closeAuthModal = useAuthStore((s) => s.closeAuthModal);

  // Auth state for logout redirect
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const isNewLogin = useAuthStore((s) => s.isNewLogin);
  const clearNewLogin = useAuthStore((s) => s.clearNewLogin);

  // Sync API language immediately from URL — no guards needed, runs before child effects
  useEffect(() => {
    if (langcode) setApiLanguage(langcode);
  }, [langcode]);

  // Pause inactivity timer when app goes to background on native
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        inactivityTracker.resume();
      } else {
        inactivityTracker.pause();
      }
    });
    return () => sub.remove();
  }, []);

  // Cross-tab session sync: if another tab logs out, sign out here too
  const signOut = useAuthStore((s) => s.signOut);
  useEffect(() => {
    return subscribeToExternalSessionChange(() => {
      signOut();
    });
  }, [signOut]);

  // ── Guard: no navegar hasta que el Root Layout esté montado ──────────────
  // router.replace() llamado en el primer render (o síncrono con él) lanza
  // "Attempted to navigate before mounting the Root Layout". El estado `ready`
  // garantiza que cualquier navegación ocurre como mínimo en el segundo ciclo.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);

  // Validar y sincronizar langcode
  useEffect(() => {
    if (!ready) return;
    if (!langcode || languages.length === 0) return;

    const isValid = languages.some((l) => l.id === langcode);
    if (!isValid) {
      const pathWithoutLang = pathname.replace(/^\/[^\/]+/, '');
      router.replace(`/en${pathWithoutLang}` as any);
      return;
    }
    if (currentLanguage?.id !== langcode) {
      setLanguageByCode(langcode);
    }
  }, [ready, langcode, languages]);

  // Redirect to home after logout from protected pages
  useEffect(() => {
    if (!ready) return;
    if (!isAuthLoading && !user && langcode) {
      const protectedSegments = ['profile', 'favourites', 'completed', 'dashboard', 'steps'];
      const currentSegment = segments[segments.length - 1];
      if (protectedSegments.includes(currentSegment)) {
        router.replace(`/${langcode}` as any);
      }
    }
  }, [ready, user, isAuthLoading, langcode, segments]);

  // Redirect to the user's preferred language only on a fresh login/registration.
  // isNewLogin is true after signIn/signUp/signInWithGoogle and false after restore(),
  // so page reloads with an existing session never trigger this redirect.
  // isNewLogin IS included in deps so that registration flows — which set isNewLogin
  // only after updateProfile() completes — still trigger this effect correctly.
  useEffect(() => {
    if (!ready || !user || languages.length === 0) return;
    if (!isNewLogin) return;
    clearNewLogin();

    const preferredLang = user.preferredLanguage;
    if (!preferredLang || preferredLang === langcode) return;

    const isAvailable = languages.some((l) => l.id === preferredLang);
    if (!isAvailable) return;

    setLanguageByCode(preferredLang);
    const pathWithoutLang = pathname.replace(/^\/[^\/]+/, '');
    router.replace(`/${preferredLang}${pathWithoutLang}` as any);
  }, [ready, user?.id, languages, isNewLogin]);

  return (
      <View style={{ flex: 1, minHeight: 0 }}>
      <Navbar onOpenAuth={(mode) => openAuthModal(mode)} />
        <View style={{ flex: 1, minHeight: 0 }}>
        <Slot />
      </View>
      <AuthModals
        visible={pendingAuthModal}
        onClose={closeAuthModal}
        onSwitch={(mode) => openAuthModal(mode)}
      />
      {/* Cookie consent banner — position: absolute, renders above content */}
      <CookieBanner />
    </View>
  );
}
