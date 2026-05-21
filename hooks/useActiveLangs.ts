// hooks/useActiveLangs.ts
// Returns the active language codes fetched from Drupal via the language store.
// Populated after hydration; empty during static prerender (Node environment).
// SEO Head components fall back to SUPPORTED_LANGS when this returns [].
//
// IMPORTANT: the selector returns `s.languages` (stable reference, only changes
// when Drupal updates the list). The `.map()` is memoized separately so it never
// creates a new array on every render — which would cause an infinite re-render
// loop in Zustand's subscription system.

import { useMemo } from 'react';
import { useLanguageStore } from '../stores/language.store';

export function useActiveLangs(): readonly string[] {
  const languages = useLanguageStore((s) => s.languages);
  return useMemo(() => languages.map((l) => l.id), [languages]);
}
