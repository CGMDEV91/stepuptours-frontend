# BUGLOG — StepUp Tours Frontend

Bug history for the StepUp Tours frontend (Expo / React Native + Drupal 11 JSON:API).
Each entry is a confirmed, fixed bug. Use this as a reference before debugging similar issues.

---

## BUG-005 — Duplicate React keys on tour pagination (Load More)

**Status:** Fixed
**Date:** 2026-05-09
**Symptom:** On the home page, clicking "Load More" caused React warnings "Encountered two children with the same key `.$<uuid>`" and the same tour cards appeared multiple times. The first page (9 tours) loaded correctly; duplicates appeared from page 2 onwards. Total count was correct (27 tours detected) but many cards were repeats of the same tour.
**Root cause:** All 27 tours were freshly created with a script, so every tour had `field_average_rate = 0` and `field_donation_count = 0`. The three sort options in `getTours()` were single-field sorts (`sort=-field_average_rate`, `sort=-field_donation_count`, `sort=title`). When all values are equal, Drupal's JSON:API returns results in non-deterministic SQL order — the order changes between the page 1 and page 2 requests, causing the same tour UUID to appear in both pages. The store appended pages naively (`[...state.tours, ...result.data]`) with no deduplication, so duplicate UUIDs flowed into the FlatList `keyExtractor`.
**Fix:** Added `drupal_internal__nid` as a stable secondary tiebreaker to all three sort strings (NID is unique and sequential, guaranteeing deterministic pagination). Added UUID deduplication in the store's append logic as a safety net.
**Files:** `services/tours.service.ts` (sort params), `stores/tours.store.ts` (append deduplication)

---

## BUG-004 — Imágenes de Drupal bloqueadas por CORS en producción

**Status:** Fixed
**Date:** 2026-05-08
**Symptom:** En producción (`stepuptours.com`), las tarjetas de tour y la página de detalle mostraban el área de imagen en blanco. La consola del navegador mostraba errores CORS al intentar cargar archivos estáticos desde `dev-step-up-tours.pantheonsite.io`.
**Root cause (dos causas combinadas):**
1. `resolveImageUrl` en `lib/drupal-client.ts` solo aplicaba el rewrite Pantheon→`stepuptours.com` (vía Cloudflare Worker) cuando la URL empezaba con `http`. Drupal devuelve `uri.url` como ruta relativa (`/sites/default/files/...`); el código le anteponía `BASE_URL` directamente, generando la URL absoluta de Pantheon sin pasar por el check de rewrite.
2. En `TourCard.tsx` y en `app/[langcode]/tour/[id].tsx`, `expo-image` recibía `headers: {}` (vacío en producción). Pasar este prop fuerza a expo-image a usar `fetch()` en lugar del elemento `<img>` nativo en web, lo que activa CORS incluso si la URL fuera correcta.
**Fix:** Refactorizado `resolveImageUrl` para construir siempre la URL completa primero y luego aplicar el rewrite de Pantheon, independientemente del formato original. En los dos componentes de imagen, el prop `headers` solo se pasa cuando `imageHeaders` no está vacío.
**Files:** `lib/drupal-client.ts`, `components/tour/TourCard.tsx`, `app/[langcode]/tour/[id].tsx`

---

## BUG-003 — All pages allow scroll past Footer into empty white space on iOS Safari and Chrome Android

**Status:** Fixed
**Date:** 2026-04-20
**Symptom:** On any page of the app (mobile web, `stepuptours.pages.dev`), scrolling to the bottom revealed the Footer correctly but allowed the user to keep scrolling into blank white space below it. Reproduced on real iOS Safari and Chrome Android; not reproducible in desktop DevTools mobile simulation.
**Root cause:** Two compounding causes: (1) `#root { position: fixed }` in `global.css` removed `#root` from the document flow, leaving `body` technically empty — iOS Safari then ignored `overflow: hidden` on `body` and allowed elastic document-level scroll regardless of inner `overflow: hidden` containers. (2) `setupScrollBehavior` in `app/_layout.tsx` appended `position: absolute` thumb divs as children of every scroll container; WebKit incorrectly includes absolutely-positioned children in `scrollHeight` calculations, extending the scrollable area beyond the Footer.
**Fix:** Removed `position: fixed` (and `top/left/width`) from `#root` in `global.css` so it participates in normal document flow. Removed `setupScrollBehavior` entirely from `app/_layout.tsx` — the decorative custom scrollbar was the direct cause of the inflated `scrollHeight` on Safari.
**Files:** `global.css`, `app/_layout.tsx`

---

## BUG-001 — preferredLanguage redirect fires on every page reload

**Status:** Fixed
**Date:** 2026-04-20
**Symptom:** After logging in, the app correctly redirected to the user's preferred language (e.g. `/es`). But if the user manually switched to another language (e.g. `/fr`) and reloaded the page, the app redirected back to the preferred language again, ignoring the manual choice.
**Root cause:** The guard variable `preferredLangAppliedForUserId` was module-level (in-memory). It reset to `null` on every page reload, so `restore()` (session restore) triggered the same redirect as a fresh login.
**Fix:** Added `isNewLogin: boolean` to `auth.store.ts`. `signIn/signUp/signInWithGoogle` set it `true`; `restore()` sets it `false`. The layout effect only redirects when `isNewLogin === true`, then calls `clearNewLogin()`.
**Files:** `stores/auth.store.ts`, `app/[langcode]/_layout.tsx`

---

## BUG-006 — Preferred language not saved or applied after registration

**Status:** Fixed
**Date:** 2026-05-13
**Symptom:** After registering (form or Google), the preferred language selected during registration was neither saved to the user profile nor used to redirect the app to the correct langcode.
**Root cause:** `signUp()` set `isNewLogin: true` before `updateProfile()` resolved, so the layout redirect fired while `user.preferredLanguage` was still empty; additionally `isNewLogin` was omitted from the layout effect's deps so setting it after the PATCH would not re-trigger the effect anyway. For Google registration, `selectedLangCode` was never passed to `signInWithGoogle` at all.
**Fix:** In `signUp()` and `signInWithGoogle()`, moved `set({ isNewLogin: true })` to after `await updateProfile()` completes; added `isNewLogin` to the `_layout.tsx` effect deps so it fires when the flag is set post-PATCH; passed `selectedLangCode` from RegisterModal to `signInWithGoogle`.
**Files:** `stores/auth.store.ts`, `app/[langcode]/_layout.tsx`, `components/layout/AuthModals.tsx`

---

## BUG-007 — Image style derivatives 404 in production after jsonapi_image_styles activation

**Status:** Fixed
**Date:** 2026-05-16
**Symptom:** After activating the Drupal `jsonapi_image_styles` module, all tour card images and banner images returned 404 in production. The URLs pointed to `stepuptours.com/sites/default/files/styles/large/...` with an AVIF extension.
**Root cause:** `resolveImageStyles()` in `lib/drupal-client.ts` called `normalizeAssetUrl()` for each derivative URL. `normalizeAssetUrl` rewrites any `pantheonsite.io` hostname to `stepuptours.com` (Cloudflare Worker) to add CORS headers. However, the Cloudflare Worker at `stepuptours.com` only proxies the root and certain paths — it does **not** proxy `/sites/default/files/styles/**`. So derivative AVIF URLs served by Pantheon were rewritten to a Cloudflare path that returned 404. Original images (via `resolveImageUrl`) share the same rewrite but are served by the Worker correctly; only style derivatives break.
**Fix:** In `resolveImageStyles()`, keep derivative URLs pointing directly to Pantheon without passing through `normalizeAssetUrl`. Image GETs are CORS-free (no `fetch()` with credentials), so the Cloudflare proxy is unnecessary for derivatives.
**Files:** `lib/drupal-client.ts`

---

## BUG-008 — site_view counter inflated: +1 per page reload instead of +1 per browser session

**Status:** Fixed
**Date:** 2026-05-16
**Symptom:** `total_views` in the analytics dashboard was growing much faster than real unique visits. Every reload of the home page counted as a new `site_view` event. Deep-linking directly to a tour page counted 0 visits.
**Root cause:** `track('site_view')` was called only from `app/[langcode]/(tabs)/index.tsx` (the home). The deduplication flag `_sessionSeen` was a module-level `Set` in `services/analytics.service.ts` — which resets on every page reload in a web SPA (JS module state is not persistent). Result: each reload = new `site_view`.
**Fix:** Extracted to a new `trackSiteVisit(langcode)` function with dedup persisted in `sessionStorage` (key `analytics_site_view_sent`). `sessionStorage` survives same-tab navigation but clears when the browser tab/window is closed, matching the desired "one visit per browser session" semantics. The call was moved to `app/[langcode]/_layout.tsx` (fires on any first page under `[langcode]`, including deep-links). Also called in `CookieBanner.tsx` after consent is granted, to catch users who accept after the initial load. The old `track('site_view')` in the home was removed.
**Files:** `services/analytics.service.ts`, `app/[langcode]/_layout.tsx`, `components/layout/CookieBanner.tsx`, `app/[langcode]/(tabs)/index.tsx`

---

## BUG-002 — TourCard shows stopsCount = 0 for some tours

**Status:** Fixed
**Date:** 2026-04-20
**Symptom:** On the home page, some TourCards showed "X puntos" (step count) and others showed nothing, even though those tours had steps visible on their detail page.
**Root cause (chain of 3):**
1. `batchGetStepCounts` used `drupalGetRaw` (Jsona deserialization). `field_tour` is a relationship field — Jsona does not reliably create stubs for non-included relationships, so `step.field_tour?.id` was `undefined` for some nodes.
2. Switching to `drupalGetJsonApiBase` (raw JSON:API, base URL) exposed that the original batch used a single `IN`-filter query (`filter[tid][condition][operator]=IN`) which Drupal JSON:API returned incorrect results for — some tour UUIDs consistently came back with 0 steps despite having steps.
3. The language-aware endpoint (`/es/jsonapi/`) was returning only steps with translations in the current language, so steps without a Spanish translation were invisible.
**Fix:** Replaced the single batch `IN`-filter call with `Promise.allSettled` of N parallel individual calls — one per tour — using the exact same filter as `getTourById` (`filter[field_tour.id]=<uuid>&filter[status]=1`), which was already confirmed to work.
**Files:** `services/tours.service.ts`, `lib/drupal-client.ts` (added `drupalGetJsonApiBase`)

---
