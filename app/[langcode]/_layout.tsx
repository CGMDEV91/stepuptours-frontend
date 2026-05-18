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
import { BottomTabBar } from '../../components/layout/BottomTabBar';
import { IntroSlides } from '../../components/layout/IntroSlides';
import CookieBanner from '../../components/layout/CookieBanner';
import { trackSiteVisit } from '../../services/analytics.service';
import { isNative } from '../../lib/platform';
import { wasIntroShown, markIntroShown } from '../../lib/intro-state';
import { useLocationPermission } from '../../hooks/useLocationPermission';

export default function LangcodeLayout() {
  useLocationPermission();

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

  // Count one site visit per browser session, regardless of the entry page.
  // trackSiteVisit dedupes via sessionStorage so reloads never recount.
  useEffect(() => {
    if (langcode) void trackSiteVisit(langcode);
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
      const protectedSegments = ['profile', 'favourites', 'completed', 'dashboard'];
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
    let targetLang = langcode;
    if (
      preferredLang &&
      preferredLang !== langcode &&
      languages.some((l) => l.id === preferredLang)
    ) {
      setLanguageByCode(preferredLang);
      targetLang = preferredLang;
    }
    // A fresh login always lands on the home screen.
    router.replace(`/${targetLang}` as any);
  }, [ready, user?.id, languages, isNewLogin]);

  // Intro deslizante: solo en nativo, solo invitado, una vez por apertura de app.
  // No se decide hasta que termina la restauración de sesión, para no mostrarla a
  // un usuario autenticado durante el arranque.
  const [introDone, setIntroDone] = useState(wasIntroShown());
  const showIntro = isNative && !user && !isAuthLoading && !introDone;

  const handleIntroDone = () => {
    markIntroShown();
    setIntroDone(true);
  };

  return (
      <View style={{ flex: 1, minHeight: 0 }}>
      {!isNative && <Navbar onOpenAuth={(mode) => openAuthModal(mode)} />}
        <View style={{ flex: 1, minHeight: 0 }}>
        <Slot />
      </View>
      {isNative && <BottomTabBar />}
      <AuthModals
        visible={pendingAuthModal}
        onClose={closeAuthModal}
        onSwitch={(mode) => openAuthModal(mode)}
      />
      {/* Cookie consent banner — solo web */}
      {!isNative && <CookieBanner />}
      {showIntro && <IntroSlides onDone={handleIntroDone} />}
    </View>
  );
}
