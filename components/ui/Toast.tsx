// components/ui/Toast.tsx
// Drupal-inspired status toast — green/red/orange/blue left-border band.
// Mounted once in _layout.tsx; any component can trigger it via useToastStore.
//
// Behaviour:
//   • Slides down from above + fades in (220 ms).
//   • Auto-hides after 4 seconds.
//   • ✕ button closes immediately.
//   • A new showToast() while one is visible resets the timer and re-animates.

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore, type ToastType } from '../../stores/toast.store';

// ── Per-type visual config ────────────────────────────────────────────────────

const CONFIG: Record<ToastType, { bg: string; border: string; icon: string; iconColor: string; textColor: string }> = {
  success: { bg: '#ECFDF5', border: '#16A34A', icon: 'checkmark-circle', iconColor: '#16A34A', textColor: '#14532D' },
  error:   { bg: '#FEF2F2', border: '#DC2626', icon: 'alert-circle',     iconColor: '#DC2626', textColor: '#7F1D1D' },
  warning: { bg: '#FFFBEB', border: '#D97706', icon: 'warning',          iconColor: '#D97706', textColor: '#78350F' },
  info:    { bg: '#EFF6FF', border: '#2563EB', icon: 'information-circle',iconColor: '#2563EB', textColor: '#1E3A8A' },
};

const ANIM_IN_MS  = 220;
const ANIM_OUT_MS = 300;
const HOLD_MS     = 4000;

// ── Component ─────────────────────────────────────────────────────────────────

export function Toast() {
  const { message, type, revision, hideToast } = useToastStore();
  const { width } = useWindowDimensions();
  const insets    = useSafeAreaInsets();

  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-60)).current;
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef   = useRef<Animated.CompositeAnimation | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    animRef.current?.stop();
    animRef.current = Animated.parallel([
      Animated.timing(opacity,    { toValue: 0, duration: ANIM_OUT_MS, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -60, duration: ANIM_OUT_MS, useNativeDriver: true }),
    ]);
    animRef.current.start(({ finished }) => { if (finished) hideToast(); });
  }, [hideToast, opacity, translateY]);

  useEffect(() => {
    if (!message) return;

    // Cancel any in-progress animation / timer from a previous toast
    if (timerRef.current) clearTimeout(timerRef.current);
    animRef.current?.stop();

    // Reset to hidden state instantly then animate in
    opacity.setValue(0);
    translateY.setValue(-60);

    animRef.current = Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: ANIM_IN_MS, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: ANIM_IN_MS, useNativeDriver: true }),
    ]);
    animRef.current.start(({ finished }) => {
      if (!finished) return;
      timerRef.current = setTimeout(dismiss, HOLD_MS);
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // `revision` is the signal; message/type change with it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);

  if (!message) return null;

  const cfg     = CONFIG[type] ?? CONFIG.success;
  const toastW  = Math.min(width - 32, 480);
  // Top offset: safe area + a little breathing room
  const topOffset = insets.top + (Platform.OS === 'web' ? 12 : 8);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          opacity,
          transform: [{ translateY }],
          top: topOffset,
          width: toastW,
          // On web use position:fixed so it floats above all content
          ...(Platform.OS === 'web' ? ({ position: 'fixed' } as any) : { position: 'absolute' }),
          // Center horizontally
          left: (width - toastW) / 2,
        },
        { backgroundColor: cfg.bg, borderLeftColor: cfg.border },
      ]}
      pointerEvents="box-none"
    >
      <Ionicons name={cfg.icon as any} size={20} color={cfg.iconColor} style={styles.icon} />
      <Text style={[styles.message, { color: cfg.textColor }]} numberOfLines={3}>
        {message}
      </Text>
      <Pressable onPress={dismiss} hitSlop={10} style={styles.closeBtn} accessibilityLabel="Close">
        <Ionicons name="close" size={16} color={cfg.iconColor} />
      </Pressable>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderLeftWidth: 4,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 10,
    gap: 10,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 9999,
  },
  icon: {
    flexShrink: 0,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  closeBtn: {
    flexShrink: 0,
    padding: 4,
  },
});
