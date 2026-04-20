// lib/web-styles.ts
import { Platform } from 'react-native';
export const webFullHeight =
    Platform.OS === 'web'
        ? ({
            height: '100%' as any,
            overflow: 'hidden' as any,
            minHeight: 0 as any,
        })
        : {};