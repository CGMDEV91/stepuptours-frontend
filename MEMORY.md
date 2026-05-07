# MEMORY — 2026-04-28

## What was done

- Implemented a fully custom analytics system (no GA/Mixpanel/Amplitude), GDPR-compliant.
- Created `services/analytics.service.ts`: consent gating, session UUID (sessionStorage on web), SHA-256 user hash, in-memory queue, 5s batch flush via `fetch` with `keepalive: true`, offline re-queue (max 100), `flushNow()` for synchronous drain. Also exposes `fetchAnalyticsSummary()` and `fetchBusinessAnalytics()` for the dashboard.
- Created `hooks/useAbandonDetector.ts`: fires `tour_abandon` with progress % on `beforeunload`/`visibilitychange` (web) and `AppState` (native), then calls `flushNow()`.
- Created `hooks/useStepTimer.ts`: thin hook wrapping enter/complete/abandon timing (step timing ultimately embedded directly in StepTimeline via a `Map<string, number>` ref).
- Wired `notifyConsentGranted/Revoked()` into `CookieBanner.tsx`.
- Called `initAnalytics()` in `app/_layout.tsx` startup `Promise.all`.
- Added tracking to: `tour/[id].tsx` (tour_view, tour_share, tour_favorite), `steps.tsx` (tour_start + useAbandonDetector), `StepTimeline.tsx` (step_view, step_complete with real duration), `BusinessCard.tsx` (business_link_click), `CompletionPopup.tsx` (tour_complete, tour_donation_click), `(tabs)/index.tsx` (site_view, search_query ≥3 chars with result count, filter_apply per filter).
- Added `user_register` tracking in `auth.service.ts` after successful POST; added `langcode?` param to `register()` and `signUp()` in store; `AuthModals.tsx` reads langcode from `useLanguageStore` and passes it.
- Created `components/admin/AnalyticsTab.tsx`: date range presets (7d/30d/90d), 4 summary cards, SVG sparkline chart (react-native-svg) with views/completions/abandonments lines, sortable top-tours table, premium business metrics section.
- Added Analytics tab to `app/[langcode]/admin.tsx` (TabId, TABS array, VALID_ADMIN_TABS, renderContent case).
- Added `admin.tabs.analytics` i18n key to all 6 locale files (en, es, fr, de, it, el).
- Wrote full self-contained Drupal backend guide in the plan file (`~/.claude/plans/planea-como-implementar-estadisticas-mellow-steele.md`, PARTE B) for a separate Claude Code session with access to the Drupal repo.

## Decisions made

- No external analytics tools — fully custom, data stays in own DB.
- GDPR: `session_id` in `sessionStorage` (dies on tab close, not persistent), `user_hash` = SHA-256(user.id) computed in frontend (never raw UUID stored), no IP address, only active if `cookie_consent = 'accepted'`.
- Step timing embedded in `StepTimeline` (not via hook props) — keeps all expand/collapse and timing logic co-located.
- `flushNow()` called synchronously on abandon so the event survives tab close.
- Drupal backend uses two tables: `su_analytics_events` (raw append-only, high volume) and `su_analytics_daily` (pre-aggregated by cron). Dashboard always reads from the aggregated table.
- Cron aggregation is idempotent (`INSERT ... ON DUPLICATE KEY UPDATE`). `retention_days = 0` means no time limit (configurable by admin via `drush cset`).

---

## Sesión 2026-05-07

**Resumen**: Multi-session sprint covering UX improvements across the business dashboard, auth modals, and modal scrollbars.

**Trabajo realizado**:

### create-business.tsx — Colors & category edit bug
- Replaced `const AMBER` with `const GREEN = '#10B981'` / `const GREEN_DARK = '#059669'`
- Replaced all `AMBER` color references (spinner, banner icon, checkmarks, save button background)
- Updated dropdown active state: `'#FEF3C7'` → `'#ECFDF5'`, `'#92400E'` → `GREEN_DARK`

### business-dashboard.tsx — Mobile bottom spacing
- Added `paddingBottom: 32` to the content wrapper `<View>` on both mobile and desktop branches
- Fixes last card sitting flush against the footer on mobile (My Businesses, Find Tours, My Promotions tabs)

### global.css — Modal + auth scrollbars
- Added `.modal-scroll` CSS class: 4px thin native webkit scrollbar for React Native Web modal ScrollViews
- Expanded `.auth-scroll` from plain `overflow-y: auto` to include matching thin scrollbar styling
- Pure CSS, no JS/DOM manipulation — avoids the old BUG-003 (absolute-position thumb inflating scrollHeight)

### Modal ScrollViews — applied `.modal-scroll` class
- `components/business/FindToursTab.tsx` (plan-picker modal + checkout modal ScrollViews)
- `components/tour/TourOnboardingModal.tsx` (onboarding modal ScrollView)
- `components/tour/CompletionPopup.tsx` (mobile + desktop completion card ScrollViews)
- `components/tour/StepTimeline.tsx` (step details modal ScrollView)

### FindToursTab.tsx — UX improvements
- Improved tour card design: `borderRadius: 16`, softer shadow, padding 16, gap 16
- Added `PAGE_SIZE = 10` + `visibleCount` state + "Load more" amber button (same style as homepage)
- SlotBox icon changes: `mine` → `storefront`, `occupied` → `storefront-outline` (more intuitive for users)
- Mobile slot layout: boxes appear below location label when `width < 600` using `useWindowDimensions`
- Added `alignSelf: 'flex-start'` to `statusBadge` in `MyBusinessesTab.tsx`

### AuthModals.tsx — Three UX fixes
1. **Scrollbar**: `.auth-scroll` CSS already applied; now has thin 4px webkit scrollbar styling
2. **Google pre-step**: Added `googlePreStep` boolean state to `RegisterModal`; clicking "Continue with Google" now switches to a pre-step view showing role cards (always all 3, no `allowProfessional` guard) + language picker + "Register with Google" button before triggering OAuth. Back button returns to normal form.
3. **Drag-close fix**: Added `mouseDownTarget = useRef<EventTarget | null>(null)` to `AuthModals` wrapper. Backdrop `onClick` only calls `handleClose()` if `mousedown` also originated on the backdrop itself — prevents text drag-select from closing the modal.

### i18n — 6 locale files (en, es, fr, de, it, el)
- Added `auth.registerWithGoogle`, `auth.chooseYourProfile`, `auth.chooseYourProfileHint`
- Added `common.back`

**Archivos modificados**:
- `components/layout/AuthModals.tsx`
- `components/business/FindToursTab.tsx`
- `components/business/MyBusinessesTab.tsx`
- `components/tour/TourOnboardingModal.tsx`
- `components/tour/CompletionPopup.tsx`
- `components/tour/StepTimeline.tsx`
- `app/[langcode]/business-dashboard.tsx`
- `app/[langcode]/dashboard/create-business.tsx`
- `global.css`
- `i18n/locales/en.json`, `es.json`, `fr.json`, `de.json`, `it.json`, `el.json`

**Pendiente / Próximos pasos**:
- Runtime-test the Google pre-step flow (no automated test yet)
- Run `ddev drush php:script web/scripts/create_business_categories.php` to create the 13 taxonomy terms and export them with `drush dcer`
- Verify Stripe webhook is wired for local testing (was failing in local because webhook couldn't reach DDEV)

