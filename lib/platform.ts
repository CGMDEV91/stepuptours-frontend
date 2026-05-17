// lib/platform.ts
// Helpers de detección de plataforma. Permiten aislar el código específico de las
// apps nativas (iOS/Android) sin alterar la ruta de render web.
import { Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';
export const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
