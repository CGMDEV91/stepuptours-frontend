import "../global.css";
import "../i18n";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { PortalHost } from "@rn-primitives/portal";
import { useAuthStore } from "../stores/auth.store";
import { useLanguageStore } from "../stores/language.store";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";

export default function RootLayout() {
  useFonts({ ...Ionicons.font });

  const restore = useAuthStore((s) => s.restore);
  const fetchLanguages = useLanguageStore((s) => s.fetchLanguages);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    Promise.all([restore(), fetchLanguages()]).then(() => {
      setInitialized(true);
    });
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <PortalHost />
    </>
  );
}
