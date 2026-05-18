// hooks/useGoogleAuth.ts
// Native Google sign-in via expo-auth-session. Returns a promptAsync() that
// opens the OAuth flow and yields a Google id_token (JWT) verified by the
// backend (`/api/auth/google`). Web uses Google Identity Services instead.

import { useEffect, useRef } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

interface UseGoogleAuth {
  promptAsync: () => void;
  ready: boolean;
}

export function useGoogleAuth(
  onSuccess: (idToken: string) => void,
  onError?: (err: Error) => void,
): UseGoogleAuth {
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken =
        response.params?.id_token ?? response.authentication?.idToken;
      if (idToken) onSuccessRef.current(idToken);
      else onErrorRef.current?.(new Error('Google sign-in returned no id_token'));
    } else if (response.type === 'error') {
      onErrorRef.current?.(
        new Error(response.error?.message ?? 'Google sign-in error'),
      );
    }
  }, [response]);

  return { promptAsync: () => promptAsync(), ready: !!request };
}
