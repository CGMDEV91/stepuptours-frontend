// components/auth/GoogleSignInButton.tsx
// Web-only "Sign in with Google" button.
//
// Renders a fully custom-styled button (matching the host modal's design)
// with the official Google Identity Services (GIS) iframe overlaid on top
// transparently. The user sees our button; clicks land on the GIS iframe,
// which triggers the OAuth flow and returns an id_token (JWT) to be verified
// by the backend (`GoogleAuthController::verifyIdToken`).
//
// Why an overlay: `google.accounts.id.renderButton` exposes only theme/size/
// shape/width — no padding, no custom borderRadius, no full-width. To honour
// the modal design we render the GIS button invisibly above our own.

import { useEffect, useRef, useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import {
  initializeGoogleIdSignIn,
  renderGoogleSignInButton,
} from '../../services/googleAuth.service';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { GoogleLogo } from './GoogleLogo';

interface Props {
  /** Visible label, e.g. t('auth.continueWithGoogle'). */
  label: string;
  onSuccess: (idToken: string) => void;
  onError?: (err: Error) => void;
  /** Google-supported button copy used by GIS for accessibility. */
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  /** BCP-47 locale for the underlying GIS button (a11y). */
  locale?: string;
  /** When true, blocks interaction without unmounting the GIS iframe. */
  disabled?: boolean;
}

const GIS_MIN_WIDTH = 200;
const GIS_MAX_WIDTH = 400;

function clampGisWidth(px: number): number {
  if (!Number.isFinite(px) || px <= 0) return GIS_MIN_WIDTH;
  return Math.max(GIS_MIN_WIDTH, Math.min(GIS_MAX_WIDTH, Math.round(px)));
}

// Visible button styles — mirror modalStyles.googleBtn from AuthModals.tsx.
function visibleButtonStyle(disabled: boolean) {
  return {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%' as const,
    opacity: disabled ? 0.55 : 1,
  };
}

// ── Native button — expo-auth-session OAuth flow ─────────────────────────────
function GoogleSignInButtonNative({ label, onSuccess, onError, disabled }: Props) {
  const { promptAsync, ready } = useGoogleAuth(onSuccess, onError);
  const blocked = disabled || !ready;

  return (
    <View style={{ width: '100%', marginBottom: 8 }}>
      <TouchableOpacity
        style={visibleButtonStyle(blocked)}
        onPress={() => promptAsync()}
        disabled={blocked}
        activeOpacity={0.7}
      >
        <GoogleLogo />
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
          {label}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Platform dispatcher ──────────────────────────────────────────────────────
export function GoogleSignInButton(props: Props) {
  if (Platform.OS === 'web') return <GoogleSignInButtonWeb {...props} />;

  // Native needs a platform-specific OAuth client ID. Until it's configured
  // in Google Cloud Console + .env.local, hide the button instead of crashing.
  const nativeClientId =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
      : process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  if (!nativeClientId) return null;

  return <GoogleSignInButtonNative {...props} />;
}

export default GoogleSignInButton;

function GoogleSignInButtonWeb({
  label,
  onSuccess,
  onError,
  text = 'continue_with',
  locale,
  disabled = false,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const gisHostRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState<number>(GIS_MIN_WIDTH);

  // Keep latest callbacks in refs so we don't re-initialise GIS on every parent
  // re-render.
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // Step 1 — initialise GIS (loads script, registers callback). Async.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let cancelled = false;
    initializeGoogleIdSignIn(
      (idToken) => onSuccessRef.current?.(idToken),
      (err) => onErrorRef.current?.(err),
    )
      .then(() => { if (!cancelled) setReady(true); })
      .catch((e) => { if (!cancelled) onErrorRef.current?.(e as Error); });
    return () => { cancelled = true; };
  }, []);

  // Step 2 — observe wrapper width so the GIS iframe matches the visible
  // button on any breakpoint (within Google's 200–400 px window).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => setWidth(clampGisWidth(el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Step 3 — render the GIS button on top, invisibly. Re-renders on width or
  // locale change.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!ready) return;
    if (!gisHostRef.current) return;
    gisHostRef.current.innerHTML = '';
    try {
      renderGoogleSignInButton(gisHostRef.current, {
        text,
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        width,
        locale,
      });
    } catch (e) {
      onErrorRef.current?.(e as Error);
    }
  }, [ready, width, text, locale]);

  return (
    <View style={{ position: 'relative', width: '100%', marginBottom: 8 }}>
      {/* Visible custom-styled button (no click logic; the GIS iframe on top
          captures the click). */}
      <View style={visibleButtonStyle(disabled)}>
        <GoogleLogo />
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
          {label}
        </Text>
      </View>

      {/* GIS button overlay — covers the visible button exactly, transparent.
          A near-zero (not zero) opacity avoids GIS abuse heuristics that
          require the button to be technically rendered. */}
      {/* @ts-ignore — div is web-only */}
      <div
        ref={wrapperRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: disabled ? 'none' : 'auto',
          opacity: 0.0001,
        }}
        aria-hidden="false"
      >
        {/* @ts-ignore */}
        <div
          ref={gisHostRef}
          style={{ width: `${width}px` }}
        />
      </div>
    </View>
  );
}
