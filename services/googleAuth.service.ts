// services/googleAuth.service.ts
// Google Identity Services (GIS) — Sign In With Google flow.
// Returns an id_token (JWT) that the backend verifies cryptographically
// against the configured Google Web Client ID (matches `aud`/`iss`/`exp`).
//
// Web-only for now. Native sign-in requires @react-native-google-signin/google-signin.

import { Platform } from 'react-native';

export const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';

let gsiLoaded = false;
let gsiInitialized = false;

/** Loads the GIS script tag (idempotent). */
export function ensureGSI(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (gsiLoaded || (window as any).google?.accounts?.id) {
    gsiLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => { gsiLoaded = true; resolve(); };
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
}

/**
 * Initialises the GIS id-flow with a callback that receives the id_token.
 * Safe to call multiple times — re-initialising just replaces the callback.
 *
 * @param onCredential Called with the id_token (JWT) when the user signs in.
 * @param onError      Called when GIS fails to load or the user cancels.
 */
export async function initializeGoogleIdSignIn(
  onCredential: (idToken: string) => void,
  onError?: (err: Error) => void,
): Promise<void> {
  if (Platform.OS !== 'web') {
    onError?.(new Error('Google sign-in on native requires additional configuration'));
    return;
  }
  if (!GOOGLE_CLIENT_ID) {
    onError?.(new Error('EXPO_PUBLIC_GOOGLE_CLIENT_ID is not configured'));
    return;
  }

  try {
    await ensureGSI();
  }
  catch (e) {
    onError?.(e as Error);
    return;
  }

  const g = (window as any).google;
  g.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response: any) => {
      if (response?.credential) {
        onCredential(response.credential as string);
      }
      else {
        onError?.(new Error('Google sign-in returned no credential'));
      }
    },
    auto_select: false,
    cancel_on_tap_outside: true,
    use_fedcm_for_prompt: true,
  });
  gsiInitialized = true;
}

/**
 * Renders the official Google "Sign in with Google" button into `element`.
 * `initializeGoogleIdSignIn` must be called first to register the callback.
 */
export function renderGoogleSignInButton(
  element: HTMLElement,
  options: {
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
    theme?: 'outline' | 'filled_blue' | 'filled_black';
    size?: 'large' | 'medium' | 'small';
    shape?: 'rectangular' | 'pill';
    width?: number;
    locale?: string;
  } = {},
): void {
  if (Platform.OS !== 'web') return;
  if (!gsiInitialized) {
    throw new Error('initializeGoogleIdSignIn must be called before renderGoogleSignInButton');
  }
  const g = (window as any).google;
  g.accounts.id.renderButton(element, {
    type: 'standard',
    theme: options.theme ?? 'outline',
    size: options.size ?? 'large',
    text: options.text ?? 'continue_with',
    shape: options.shape ?? 'rectangular',
    width: options.width,
    locale: options.locale,
    logo_alignment: 'left',
  });
}
