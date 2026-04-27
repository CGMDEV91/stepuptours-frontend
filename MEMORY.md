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

