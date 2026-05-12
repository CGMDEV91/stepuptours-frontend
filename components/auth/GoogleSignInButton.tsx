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
import { Platform, Text, View } from 'react-native';
import {
  initializeGoogleIdSignIn,
  renderGoogleSignInButton,
} from '../../services/googleAuth.service';

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

const GoogleLogo = () => (
  // @ts-ignore — react-native typings don't include native SVG, but on web
  // it falls through to a real <svg> element.
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    {/* @ts-ignore */}
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    {/* @ts-ignore */}
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    {/* @ts-ignore */}
    <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
    {/* @ts-ignore */}
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

export function GoogleSignInButton({
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

  if (Platform.OS !== 'web') return null;

  // Visible button styles — mirror modalStyles.googleBtn from AuthModals.tsx.
  const visibleButtonStyle = {
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

  return (
    <View style={{ position: 'relative', width: '100%', marginBottom: 8 }}>
      {/* Visible custom-styled button (no click logic; the GIS iframe on top
          captures the click). */}
      <View style={visibleButtonStyle}>
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

export default GoogleSignInButton;
