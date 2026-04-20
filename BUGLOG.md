# BUGLOG — StepUp Tours Frontend

Bug history for the StepUp Tours frontend (Expo / React Native + Drupal 11 JSON:API).
Each entry is a confirmed, fixed bug. Use this as a reference before debugging similar issues.

---

## BUG-001 — preferredLanguage redirect fires on every page reload

**Status:** Fixed
**Date:** 2026-04-20
**Symptom:** After logging in, the app correctly redirected to the user's preferred language (e.g. `/es`). But if the user manually switched to another language (e.g. `/fr`) and reloaded the page, the app redirected back to the preferred language again, ignoring the manual choice.
**Root cause:** The guard variable `preferredLangAppliedForUserId` was module-level (in-memory). It reset to `null` on every page reload, so `restore()` (session restore) triggered the same redirect as a fresh login.
**Fix:** Added `isNewLogin: boolean` to `auth.store.ts`. `signIn/signUp/signInWithGoogle` set it `true`; `restore()` sets it `false`. The layout effect only redirects when `isNewLogin === true`, then calls `clearNewLogin()`.
**Files:** `stores/auth.store.ts`, `app/[langcode]/_layout.tsx`

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
