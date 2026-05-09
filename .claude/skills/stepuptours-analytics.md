# Skill: StepUp Tours — Analytics System

Documentación completa del sistema de analytics custom: frontend tracker + backend Drupal module.

---

## Arquitectura general

```
Frontend (Expo)                         Backend (Drupal)
─────────────────────────────           ──────────────────────────────────────
analytics.service.ts                    module: stepuptours_analytics
  │  track(eventType, params)    POST →  /api/analytics/events
  │  flushNow()                         AnalyticsEventController
  │  fetchAnalyticsSummary()     GET  →  /api/analytics/summary
  │  fetchTourAnalytics()        GET  →  /api/analytics/tour/{id}
  │  fetchBusinessAnalytics()    GET  →  /api/analytics/business/{id}
  └  fetchAllBusinessAnalytics() GET  →  /api/analytics/businesses
                                        AnalyticsSummaryController
                                        AnalyticsAggregator (cron daily)
```

---

## Frontend — `services/analytics.service.ts`

### Tipos de eventos

| Evento | Dedupado por sesión | Entidad |
|--------|---------------------|---------|
| `site_view` | ✅ sí | — |
| `tour_view` | ✅ sí | `tour_id` |
| `step_view` | ✅ sí | `step_id` |
| `tour_start` | ❌ no | `tour_id` |
| `tour_complete` | ❌ no | `tour_id` |
| `tour_abandon` | ❌ no | `tour_id` |
| `tour_share` | ❌ no | `tour_id` |
| `tour_favorite` | ❌ no | `tour_id` |
| `tour_donation_click` | ❌ no | `tour_id` |
| `step_complete` | ❌ no | `step_id` |
| `step_abandon` | ❌ no | `step_id` |
| `business_link_click` | ❌ no | `business_id` |
| `search_query` | ❌ no | — |
| `filter_apply` | ❌ no | — |
| `user_register` | ❌ no | — |

### Deduplicación de vistas

Los eventos de tipo "vista" (`site_view`, `tour_view`, `step_view`) solo se envían **una vez por entidad por sesión**. Esto se implementa con un `Set<string>` module-level (`_sessionSeen`) que persiste mientras dura la sesión:

```typescript
const _sessionSeen = new Set<string>();
const DEDUPE_EVENTS: AnalyticsEventType[] = ['site_view', 'tour_view', 'step_view'];

function isDuplicate(eventType, entityId?): boolean {
  if (!DEDUPE_EVENTS.includes(eventType)) return false;
  const key = entityId ? `${eventType}:${entityId}` : eventType;
  if (_sessionSeen.has(key)) return true;
  _sessionSeen.add(key);
  return false;
}
```

En `track()` se llama antes de encolar: `if (isDuplicate(eventType, entityId)) return;`

### Sesión

- **Web**: `session_id` persiste en `sessionStorage` bajo la clave `analytics_session_id`. Vive por tab; se destruye al cerrar el tab.
- **Native**: nuevo UUID por cold start de la app.
- El `_sessionSeen` Set tiene exactamente la misma duración que la sesión (es module-level).

### Consentimiento

- Solo trackea si el usuario aceptó cookies (`cookie_consent = 'accepted'` en localStorage / AsyncStorage).
- `notifyConsentGranted()` → activa el flush loop.
- `notifyConsentRevoked()` → vacía la queue y para el loop.

### Batching y envío

- Los eventos se acumulan en `_queue: AnalyticsEvent[]`.
- Se envían en lotes de 10 (`BATCH_SIZE`) o cada 5 segundos (`FLUSH_INTERVAL_MS`).
- Payload al backend: `POST /api/analytics/events` con `{ events: AnalyticsEvent[] }`.
- En web se usa `keepalive: true` para que el request sobreviva a `beforeunload`.
- Si el envío falla, los eventos se reencolan al frente (hasta `MAX_QUEUE_SIZE = 100`).

### Payload de un evento

```typescript
{
  event_type: 'tour_view',
  session_id: 'uuid',
  user_hash: 'sha256(userId) | undefined',  // undefined si anónimo
  tour_id?: 'uuid',
  step_id?: 'uuid',
  business_id?: 'uuid',
  langcode: 'en',
  platform: 'web' | 'ios' | 'android',
  value_int?: number,
  value_str?: string,
  is_anonymous: 1 | 0,
  created_at: 1234567890,  // unix timestamp
}
```

### Dónde se llama `track()` en el frontend

| Evento | Archivo | Condición |
|--------|---------|-----------|
| `tour_view` | `app/[langcode]/tour/[id].tsx` | Al montar la pantalla de detalle |
| `tour_start` | `app/[langcode]/tour/[id]/steps.tsx` | Al entrar en la vista de pasos |
| `tour_favorite` | `app/[langcode]/tour/[id].tsx` | Al pulsar el corazón |
| `tour_share` | `app/[langcode]/tour/[id].tsx` | Al usar share sheet |
| `tour_abandon` | `hooks/useAbandonDetector.ts` | `beforeunload` (web) / AppState change (native) |
| `user_register` | Flujo de auth | Registro nuevo |

> **Nota**: `site_view` está definido en el backend pero actualmente **no se envía desde el frontend** (la home no llama a `track('site_view', ...)`). El contador "VISTAS TOTALES" del admin refleja únicamente los eventos que existan en la DB.

---

## Backend — Drupal module `stepuptours_analytics`

**Ruta**: `web/modules/custom/stepuptours_analytics/`

### Esquema de base de datos

**Tabla `su_analytics_events`** — eventos crudos (append-only)

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | serial PK | |
| `event_type` | varchar(64) | 14 tipos permitidos |
| `session_id` | varchar(64) | ID de sesión del cliente |
| `user_hash` | varchar(64) nullable | SHA-256 del user ID |
| `tour_id` | varchar(36) nullable | UUID del tour |
| `step_id` | varchar(36) nullable | UUID del step |
| `business_id` | varchar(36) nullable | UUID del business |
| `langcode` | varchar(8) | default 'en' |
| `platform` | varchar(16) | web / ios / android |
| `value_int` | int nullable | campo custom |
| `value_str` | varchar(255) nullable | campo custom |
| `is_anonymous` | tinyint | 0=registered, 1=anon |
| `created_at` | int | unix timestamp |

**Tabla `su_analytics_daily`** — agregados pre-computados por día

| Campo | Tipo | Notas |
|-------|------|-------|
| `date_day` | varchar(10) | YYYY-MM-DD |
| `entity_type` | varchar(16) | 'site', 'tour', 'business', 'step' |
| `entity_id` | varchar(36) nullable | NULL para métricas de site |
| `metric` | varchar(64) | 'views', 'starts', 'completions', etc. |
| `value` | bigint | valor agregado |
| `langcode` | varchar(8) nullable | |

Unique key: `(date_day, entity_type, entity_id, metric, langcode)` — permite re-runs idempotentes del aggregator.

### Endpoints

| Método | Ruta | Controlador | Auth |
|--------|------|-------------|------|
| POST | `/api/analytics/events` | `AnalyticsEventController` | público |
| GET | `/api/analytics/summary` | `AnalyticsSummaryController` | admin |
| GET | `/api/analytics/tour/{id}` | `AnalyticsSummaryController` | admin |
| GET | `/api/analytics/business/{id}` | `AnalyticsSummaryController` | business owner / admin |
| GET | `/api/analytics/businesses` | `AnalyticsSummaryController` | admin |

**Parámetros del summary**: `?from=YYYY-MM-DD&to=YYYY-MM-DD&langcode=en`

> El `langcode` en el summary **solo afecta a los títulos** devueltos, nunca filtra las métricas. Todas las métricas se agregan cross-language.

### Aggregator (`AnalyticsAggregator.php`)

Corre via cron (diariamente). Agrega los eventos del día anterior en `su_analytics_daily`:

```sql
-- Ejemplo: vistas de site
INSERT INTO su_analytics_daily (date_day, entity_type, entity_id, metric, value)
SELECT DATE(FROM_UNIXTIME(created_at)), 'site', NULL, 'page_views', COUNT(*)
FROM su_analytics_events
WHERE event_type = 'site_view' AND ...
ON DUPLICATE KEY UPDATE value = VALUES(value)
```

**Importante**: el aggregator cuenta `COUNT(*)` — no deduplica por `session_id`. La deduplicación se hace en el tracker frontend (BUG-005 fix). Si se añade `site_view` tracking en el futuro, el conteo en el admin reflejará visitas únicas por sesión gracias a esta deduplicación previa.

### Fallback raw

Si `su_analytics_daily` está vacío para el periodo, el summary cae back a consultar `su_analytics_events` directamente con `SUM(event_type = 'site_view')`.

### Respuesta del summary

```json
{
  "site": {
    "total_views": 4367,
    "anon_views": 2278,
    "registered_views": 2089,
    "new_registrations": 13,
    "total_searches": 0,
    "total_users": 13
  },
  "tours": [
    {
      "tour_id": "uuid",
      "title": "Montmartre & the Impressionist Soul of Paris",
      "views": 120,
      "starts": 45,
      "completions": 12,
      "abandonments": 8,
      "completion_rate": 0.267,
      "avg_abandonment_pct": 25,
      "shares": 5,
      "avg_step_duration_s": 240
    }
  ],
  "date_series": [
    { "date": "2026-05-09", "views": 234, "completions": 12, "abandonments": 8 }
  ]
}
```

---

## Admin UI — `components/admin/AnalyticsTab.tsx`

Importado en `app/[langcode]/admin.tsx`. Muestra:

- **Summary cards**: VISTAS TOTALES (`site.total_views`), COMPLETADOS (`tours[].completions` sum), ABANDONOS, NUEVOS REGISTROS (`site.new_registrations`), USUARIOS TOTALES (`site.total_users`)
- **Tabla de tours**: views, starts, completions, completion rate, abandonment % por tour
- **Date series**: gráfica de vistas/completions/abandonos por día

Llama a `fetchAnalyticsSummary(from, to, undefined, langcode)` del service.

---

## Decisiones de diseño clave

1. **Deduplicación en el tracker, no en las queries** — los datos crudos se mantienen limpios desde el origen. El backend no necesita `COUNT(DISTINCT session_id)`.
2. **Agregación diaria** — `su_analytics_daily` pre-computa métricas para queries de dashboard rápidas; los eventos crudos se mantienen para auditoría.
3. **`langcode` solo para títulos** — las métricas son cross-language para no fragmentar los conteos.
4. **SHA-256 del user ID** — nunca se almacena el user ID directamente; el hash permite agrupar actividad del mismo usuario sin exponer la identidad.
5. **`site_view` no implementado en frontend** — está definido en el backend pero pendiente de añadir en la home. El contador "VISTAS TOTALES" estará en 0 o reflejará solo eventos manuales hasta que se implemente.
