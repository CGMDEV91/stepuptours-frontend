// components/ui/Tooltip.tsx
// Lightweight tooltip wrapper. On web it shows on hover; on native it shows on
// long-press for ~1.5 s. Designed to wrap small icons or badges.

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  const onLongPress = () => {
    show();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(hide, 1500);
  };

  const webProps =
    Platform.OS === 'web'
      ? ({ onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide } as any)
      : {};

  return (
    <View style={styles.wrap} {...webProps}>
      <Pressable onLongPress={onLongPress} delayLongPress={300}>
        {children}
      </Pressable>
      {visible && (
        <View pointerEvents="none" style={styles.bubble}>
          <Text style={styles.bubbleText}>{content}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  bubble: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 6,
    backgroundColor: 'rgba(17,24,39,0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    maxWidth: 220,
    zIndex: 9999,
  },
  bubbleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
  },
});
