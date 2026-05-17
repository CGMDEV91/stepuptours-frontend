# Guía de builds y notificaciones — StepUp Tours

Cómo compilar las apps nativas iOS/Android, qué se necesita en cada caso y cómo
probar las notificaciones push.

---

## Conceptos previos

| Entorno | Sirve para | ¿Push? |
|---|---|---|
| `npx expo start` (navegador / Expo Go) | Iterar UI rápido en desarrollo | No |
| Build `preview` (EAS) | Ver la app nativa real, recorrer el diseño | No (no hace falta configurar nada) |
| Build `development` (EAS) | Desarrollo nativo con recarga en caliente | Sí, con credenciales |
| Build `production` (EAS) | Publicar en App Store / Google Play | Sí, con credenciales |

Puntos clave:

- **Expo Go** ya **no soporta push remotas** desde el SDK 53. El **simulador de iOS**
  nunca recibe push (limitación de Apple).
- El código de push está protegido (`try/catch` + carga diferida): si las
  notificaciones no están configuradas o se deniegan permisos, **la app no se
  rompe** — simplemente no llega la notificación. Todo lo demás funciona igual.
- Por tanto **puedes compilar y probar el aspecto de la app sin tocar nada de
  notificaciones**.

---

## 1. Requisitos en local

Una sola vez:

```bash
npm install            # instala dependencias del proyecto (incl. expo-notifications, expo-device)
npm install -g eas-cli # herramienta de EAS (global, NO es dependencia del proyecto)
eas login              # inicia sesión con tu cuenta de Expo
eas init               # enlaza el proyecto y escribe extra.eas.projectId en app.json
```

> `eas init` es **imprescindible**: `getExpoPushTokenAsync()` necesita el
> `projectId` para emitir el token de push. Sin él, el registro de push falla
> (pero la app sigue funcionando).

Variables de entorno necesarias en el build (`.env` / `env.production`):

```
EXPO_PUBLIC_SITE_URL=https://stepuptours.com
EXPO_PUBLIC_API_URL=https://dev-step-up-tours.pantheonsite.io
```

---

## 2. Build SIN notificaciones (ver cómo se ve la app)

La forma más directa de ver la app nativa real es el perfil **`preview`**, que
genera un binario independiente y **no requiere configurar FCM/APNs**:

```bash
eas build --profile preview --platform android   # genera un .apk
eas build --profile preview --platform ios       # genera un build para simulador/dispositivo
```

Instala el `.apk` en un Android (o el build en iOS) y recorre la app: slides de
introducción, menú inferior, perfil, redirección de pagos a la web, etc. La
única función que no se ejecutará es la notificación push.

> El perfil `preview` **no** necesita el paquete `expo-dev-client`.

---

## 3. Exportar / compilar para iOS y Android (producción)

No hace falta instalar ningún paquete extra: `expo-notifications` y
`expo-device` ya están en `package.json` y EAS los empaqueta automáticamente.

```bash
eas build --profile production --platform android
eas build --profile production --platform ios
```

Subir a las tiendas:

```bash
eas submit --profile production --platform android
eas submit --profile production --platform ios
```

Requisitos de cuenta:

- **Android**: cuenta de Google Play Console (pago único de 25 $).
- **iOS**: cuenta Apple Developer (99 $/año). Necesaria también para instalar
  builds en dispositivos físicos.

Identificadores ya configurados en `app.json`:

- `scheme`: `stepuptours`
- iOS `bundleIdentifier`: `com.stepuptours.app`
- Android `package`: `com.stepuptours.app`

---

## 4. Probar las notificaciones en local

Las push solo se pueden probar en un **dispositivo físico** con un build de EAS
(no Expo Go, no simulador).

### 4.1 Build de desarrollo

El perfil `development` permite recarga en caliente, pero **requiere el paquete
`expo-dev-client`**:

```bash
npx expo install expo-dev-client
eas build --profile development --platform android
```

Instala el build en el móvil y arranca el servidor:

```bash
npx expo start --dev-client
```

> Alternativa sin `expo-dev-client`: usar un build `preview` y configurar las
> credenciales de push igualmente.

### 4.2 Credenciales de push

- **Android (FCM)**: durante `eas build` o con `eas credentials`, EAS te guía
  para subir la clave de Firebase Cloud Messaging.
- **iOS (APNs)**: `eas credentials` genera/sube la clave APNs (requiere cuenta
  Apple Developer).

### 4.3 Probar el flujo de "tour abandonado"

1. Inicia sesión en la app → se registra el token push (`syncPushToken`).
2. Empieza un tour y déjalo a medias (sin completarlo).
3. En el backend Drupal, fuerza el cron:
   ```bash
   drush cron
   ```
   Para no esperar 24 h, baja temporalmente el umbral en
   `_stepuptours_api_send_abandoned_tour_reminders()` (módulo `stepuptours_api`).
4. Debe llegar la notificación "¿Retomamos tu tour?". Al tocarla, la app abre
   los pasos del tour.
5. El toggle "Recordatorios para retomar" del perfil silencia/activa este aviso.

---

## 5. Qué tener en cuenta para notificaciones en producción

- **No se necesitan paquetes adicionales**: `expo-notifications` y `expo-device`
  ya están en el proyecto y el plugin `expo-notifications` ya está en `app.json`.
- Lo que hay que configurar son **credenciales**, no código:
  - iOS → clave APNs.
  - Android → Firebase Cloud Messaging (FCM).
  - Ambas se gestionan con `eas credentials` / durante `eas build`.
- Si NO configuras las credenciales, la app se publica y funciona igual —
  simplemente no se entregan notificaciones.
- El backend envía las push vía la **Expo Push API** (`exp.host`) desde el cron
  de Drupal; no requiere SDK de servidor adicional.
- Usuarios existentes: el campo `field_push_notif_enabled` queda vacío hasta que
  su app abre y sincroniza la preferencia (la app la envía al arrancar).

---

## 6. Resumen rápido

| Objetivo | Comando | ¿Push? | Paquete extra |
|---|---|---|---|
| Iterar UI | `npx expo start` | No | — |
| Ver la app nativa real | `eas build --profile preview` | No | — |
| Dev build con hot reload | `eas build --profile development` | Sí (con credenciales) | `expo-dev-client` |
| Publicar en tiendas | `eas build --profile production` + `eas submit` | Sí (con credenciales) | — |

---

## 7. Checklist antes del primer build

- [ ] `npm install` ejecutado
- [ ] `eas-cli` instalado globalmente y `eas login` hecho
- [ ] `eas init` ejecutado (`projectId` presente en `app.json`)
- [ ] `EXPO_PUBLIC_SITE_URL` y `EXPO_PUBLIC_API_URL` definidos en el entorno de build
- [ ] Backend Drupal desplegado con `drush cim && drush cr` (campos y rutas nuevas)
