// lib/web-styles.ts
// Reusable web-only styles for page-level containers.
//
// `100dvh` (dynamic viewport height) tracks the real visible height on mobile
// Safari/Chrome — unlike `100vh`, which represents the max viewport (URL bar
// hidden) and overflows when the URL bar is visible, creating empty scroll
// space below the Footer. Supported on Safari 15.4+, Chrome 108+, Firefox 101+.
//
// Spread this into any page-level container that previously used
// `Platform.OS === 'web' ? { height: '100vh', overflow: 'hidden' } : {}`.
import { Platform } from 'react-native';

export const webFullHeight =
    Platform.OS === 'web'
        ? ({ overflow: 'hidden' as any, minHeight: 0 as any })
        : {};
