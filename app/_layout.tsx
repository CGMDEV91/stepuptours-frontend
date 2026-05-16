import "../global.css";
import "../i18n";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import Head from "expo-router/head";
import { PortalHost } from "@rn-primitives/portal";
import { useAuthStore } from "../stores/auth.store";
import { useLanguageStore } from "../stores/language.store";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import { initAnalytics } from "../services/analytics.service";
import { registerServiceWorker } from "../lib/register-sw";

export default function RootLayout() {
  useFonts({ ...Ionicons.font });

  const restore = useAuthStore((s) => s.restore);
  const fetchLanguages = useLanguageStore((s) => s.fetchLanguages);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    registerServiceWorker();
    Promise.all([restore(), fetchLanguages(), initAnalytics()]).then(() => {
      setInitialized(true);
    });
  }, []);

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
