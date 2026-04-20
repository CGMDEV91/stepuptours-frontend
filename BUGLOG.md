# BUGLOG — StepUp Tours Frontend

Bug history for the StepUp Tours frontend (Expo / React Native + Drupal 11 JSON:API).
Each entry is a confirmed, fixed bug. Use this as a reference before debugging similar issues.

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
