# StepUp Tours — Frontend

## Agent role

You are a senior full-stack engineer specialising in headless Drupal 11 + React Native / Expo. You know the StepUp Tours codebase in depth: the JSON:API integration, Expo Router conventions, Zustand store patterns, and the business rules that govern tours, steps, and gamification. When in doubt about a business rule or content model, consult the referenced skills before guessing.

---

## Project overview

**StepUp Tours** is a gamified city-tour app. Users follow physical steps (locations) along a tour route, scanning QR codes or answering questions to earn points and climb a ranking.

| Item | Value |
|---|---|
| Local environment | DDEV (`stepuptours.ddev.site`) |
| Backend | Drupal 11 — headless, JSON:API |
| Frontend | Expo 52 (React Native + Web) |
| Monorepo root | `/home/carlos/devel/stepuptours/` |

### Monorepo layout

```
stepuptours/
  web/                        Drupal 11 backend (DDEV)
    web/modules/custom/       Custom modules
    web/themes/custom/        Custom themes (unused in headless mode)
  frontend/
    stepuptours/              ← this repo (Expo frontend)
```

---

## Frontend stack

| Layer | Technology |
|---|---|
| Framework | Expo (React Native for Web + iOS + Android) |
| Router | Expo Router (file-based, URL-driven with `[langcode]` segment) |
| Backend | Drupal 11 JSON:API — all API logic isolated in `lib/drupal-client.ts` |
| State | Zustand stores (`stores/`) |
| JSON:API deserialization | [Jsona](https://github.com/nicktindall/jsona) — see caveats below |
| i18n | react-i18next (`i18n/`) |
| Styling | NativeWind (Tailwind for RN) + StyleSheet |

### Key folders

```
app/                    Expo Router pages
  [langcode]/           All user-facing pages; langcode in URL (en, es, fr…)
    _layout.tsx         Root layout: lang validation, navbar, auth modals
    (tabs)/index.tsx    Home page — tour listing with infinite scroll
components/
  layout/               Navbar, Footer, AuthModals, PageScrollView, PageFlatList
  tour/                 TourCard, StarRating, TourStep…
stores/                 Zustand: auth.store, tours.store, language.store
services/               API service layer (tours, auth, user…)
lib/
  drupal-client.ts      ONLY file that talks to Drupal. All fetch helpers here.
types/                  TypeScript interfaces (Tour, User, TourStep…)
i18n/                   Translation files and i18next config
```

---

## Drupal conventions

### JSON:API clients (`lib/drupal-client.ts`)

Two Axios instances exist:

| Client | Base URL | Use for |
|---|---|---|
| `drupalClient` | `/<langcode>/jsonapi/` (dynamic) | Content that must reflect current language |
| `drupalClientBase` | `/jsonapi/` (fixed, no prefix) | Structural queries where count/existence must not depend on translation status |

Public helpers:

| Helper | Client | Deserialization | Notes |
|---|---|---|---|
| `drupalGet` / `drupalGetRaw` | `drupalClient` | Jsona | Lang-aware; avoid for relationship ID reads |
| `drupalGetJsonApi` | `drupalClient` | Raw `data[]` | Lang-aware; safe for relationship IDs |
| `drupalGetJsonApiBase` | `drupalClientBase` | Raw `data[]` | No language prefix; use for step counts and structural queries |

### Jsona deserialization caveat

`drupalGet` / `drupalGetRaw` pass responses through Jsona. Jsona **does not reliably create stubs for non-included relationships** — if you request `fields[node--tour_step]=field_tour` without `include=field_tour`, `step.field_tour?.id` may be `undefined`. Use `drupalGetJsonApi` or `drupalGetJsonApiBase` whenever you need to read relationship IDs from the response.

### Language-aware queries

`drupalClient` dynamically sets `baseURL` to `/<currentLang>/jsonapi/` on every request. Endpoints like `/es/jsonapi/node/tour_step` **only return nodes with a Spanish translation**. For counts or structural queries that must include all content regardless of translation, always use `drupalGetJsonApiBase`.

### Drupal content API patterns

- **Single entity by UUID**: `filter[id]=<uuid>`
- **Relationship filter**: `filter[field_tour.id]=<uuid>` (follows JSON:API dot-notation)
- **Status filter**: always add `filter[status]=1` to exclude unpublished nodes
- **Pagination**: `page[limit]=50` default; use `page[offset]` for cursor-less pagination
- **Avoid `IN`-filter for UUIDs**: Drupal JSON:API's `IN` operator on UUID fields can return incorrect results. Use parallel individual calls instead (see BUG-002 in `BUGLOG.md`).

---

## Auth patterns

### `isNewLogin` flag (`stores/auth.store.ts`)

`auth.store.ts` exposes `isNewLogin: boolean`:
- Set to `true` by `signIn`, `signUp`, `signInWithGoogle`
- Set to `false` by `restore()` (session restore on app launch)
- Consumed by `app/[langcode]/_layout.tsx` to redirect to preferred language **only on fresh login**, not on every page reload (see BUG-001 in `BUGLOG.md`)

---

## Scroll containers (mobile)

Use `PageScrollView` and `PageFlatList` (`components/layout/`) instead of bare RN `ScrollView`/`FlatList` for **any full-page scroll container**. They lock in the correct bounce/overscroll/inset props for iOS and Android. Do not use them for small nested scroll areas (dropdowns, pickers).

---

## Business rules

See **`skills/stepuptours-business-rules.md`** for the full rule set. Quick reference:

| Area | Summary |
|---|---|
| Tour completion | A tour is "completed" when all mandatory steps are validated |
| Step validation | QR scan or challenge answer; optional steps award bonus points |
| Points | Each step has a configurable point value; bonus multipliers apply |
| Ranking | Global ranking recalculated server-side after each step validation |
| Favourites | Users can bookmark tours; stored in Drupal profile, not local state |
| Reviews | Users can rate tours (1–5 stars) after completing them |

---

## Content model

See **`skills/stepuptours-content-model.md`** for full field definitions. Quick reference:

| Content type | Key fields |
|---|---|
| `tour` | `title`, `field_description`, `field_image`, `field_category`, `field_difficulty`, `field_duration_minutes`, `field_city` |
| `tour_step` | `title`, `field_tour` (ref), `field_order`, `field_points`, `field_is_mandatory`, `field_validation_type`, `field_qr_code`, `field_challenge` |
| `city` | `name`, `field_country`, `field_image` |
| `category` | `name`, `field_icon` |
| `user` (profile) | `field_preferred_language`, `field_avatar`, `field_total_points` |

---

## User roles

| Role | Drupal machine name | Capabilities |
|---|---|---|
| Anonymous | `anonymous` | Browse and view tours; read-only |
| Authenticated | `authenticated` | Complete steps, earn points, leave reviews, manage favourites |
| Tour Creator | `tour_creator` | Create and edit own tours and steps |
| Administrator | `administrator` | Full access |

---

## Useful commands

```bash
# Drupal / DDEV
ddev drush cr                        # Clear Drupal caches
ddev drush cex                       # Export config
ddev drush cim                       # Import config
ddev drush uli                       # One-time login link
ddev drush sql-dump > backup.sql     # DB backup

# Frontend (from stepuptours-frontend/)
npx expo start                       # Start dev server
npx expo start --web                 # Web only
npx expo start --ios                 # iOS simulator
npx expo start --android             # Android emulator
npx expo export --platform web       # Build for web
```

---

## Skills reference

Project-local skills live in `.claude/skills/`. Claude should invoke them when the task matches their description — do not reconstruct their logic from scratch.

| Skill | When to use |
|---|---|
| `log-bug` | After the user confirms a bug is fixed — logs a structured BUG-NNN entry to `BUGLOG.md` |
| `stepuptours-business-rules` | When a task involves game logic, scoring, or completion rules |
| `stepuptours-content-model` | When a task involves Drupal content types, fields, or API shape |
| `drupal-jsonapi` | When building or debugging a Drupal JSON:API query (filters, pagination, relationships) |
| `drupal-backend` | When working on Drupal-side concerns: modules, hooks, config, migrations |
| `drupal-auth-users` | When a task involves Drupal authentication, roles, permissions, or user management |
| `react-native-expo` | When working with Expo / React Native APIs, navigation, or platform-specific behaviour |
| `react-state-architecture` | When designing or refactoring Zustand stores or global state |
| `responsive-design` | When implementing responsive or adaptive layouts across web, iOS, and Android |
| `payments-apple-pay` | When implementing or debugging Apple Pay / in-app payment flows |

## Agents reference

Project-local agents live in `.claude/agents/`. Spawn the appropriate agent for specialised sub-tasks.

| Agent | When to use |
|---|---|
| `fullstack-developer` | Default agent for feature work spanning frontend + backend |
| `frontend-developer` | Focused frontend tasks: components, screens, styling, Expo Router |
| `backend-architect` | Drupal architecture decisions, module design, data modelling |
| `drupal-expert` | Deep Drupal-specific tasks: hooks, plugins, JSON:API config, migrations |
| `code-reviewer` | Code review — correctness, patterns, security, performance |
| `context-manager` | Session continuity: summarising context, updating MEMORY.md |
| `prompt-engineer` | Writing or refining skills, agent definitions, and Claude instructions |

---

## MEMORY.md convention

At the end of long sessions (or when Claude Code context is nearly full), create or update `MEMORY.md` in the project root with a concise session summary:

```markdown
# MEMORY — <YYYY-MM-DD>

## What was done
- <bullet per meaningful change>

## Decisions made
- <architecture/pattern choices worth remembering>

## Open items
- <anything left unfinished or deferred>
```

Keep each entry brief. The file accumulates entries — do not erase previous ones.

---

## Bug history

See [`BUGLOG.md`](./BUGLOG.md) for a concise history of confirmed bugs and their solutions. Use it as a first reference when encountering unexpected API or rendering behaviour.
