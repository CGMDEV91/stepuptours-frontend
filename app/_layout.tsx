import "../global.css";
import "../i18n";
import { useEffect, useRef, useState } from "react";
import { Stack, useRouter } from "expo-router";
import Head from "expo-router/head";
import { PortalHost } from "@rn-primitives/portal";
import { useAuthStore } from "../stores/auth.store";
import { useLanguageStore } from "../stores/language.store";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import { initAnalytics } from "../services/analytics.service";
import { registerServiceWorker } from "../lib/register-sw";
import { isNative } from "../lib/platform";
import { syncPushToken, addNotificationTapListener } from "../services/notifications.service";

export default function RootLayout() {
  useFonts({ ...Ionicons.font });

  const restore = useAuthStore((s) => s.restore);
  const fetchLanguages = useLanguageStore((s) => s.fetchLanguages);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    registerServiceWorker();
    Promise.all([restore(), fetchLanguages(), initAnalytics()]).then(() => {
      setInitialized(true);
    });
  }, []);

  // Push notifications (solo nativo): registrar el token cuando hay sesión y
  // navegar al tour al tocar un recordatorio de "retomar tour".
  const pushSynced = useRef(false);
  useEffect(() => {
    if (!isNative) return;

    const trySync = () => {
      const session = useAuthStore.getState().session;
      if (session?.token && !pushSynced.current) {
        pushSynced.current = true;
        void syncPushToken();
      }
      if (!session?.token) pushSynced.current = false;
    };
    trySync();
    const unsub = useAuthStore.subscribe(trySync);

    const removeTapListener = addNotificationTapListener((tourId) => {
      const lang = useLanguageStore.getState().currentLanguage?.id ?? 'en';
      router.push(`/${lang}/tour/${tourId}/steps` as any);
    });

    return () => {
      unsub();
      removeTapListener();
    };
  }, [router]);

  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
      </Head>
      <Stack screenOptions={{ headerShown: false }} />
      <PortalHost />
    </>
  );
}
