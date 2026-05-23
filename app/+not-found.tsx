// app/+not-found.tsx
// Rutas no matcheadas por Expo Router → redirect automático a la home del
// idioma actual. No mostramos modal de servidor: una URL inexistente no es
// un problema de backend.

import { Redirect } from 'expo-router';
import { useLanguageStore } from '@/stores/language.store';

export default function NotFoundScreen() {
  const currentLanguage = useLanguageStore((s) => s.currentLanguage);
  const lang = currentLanguage?.id ?? 'en';
  return <Redirect href={`/${lang}` as any} />;
}
