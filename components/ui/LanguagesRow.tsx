// components/ui/LanguagesRow.tsx
// Row of flags representing the languages a tour is available in.
// Uses the shared <Flag> component so the style matches everywhere.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Flag } from './Flag';
import { langCodeToCountryCode } from '../../services/language.service';

interface LanguagesRowProps {
  langs: string[];
  /** Flag height in px. */
  size?: number;
  /** Max flags to show before collapsing into "+N". */
  max?: number;
}

export function LanguagesRow({ langs, size = 16, max = 6 }: LanguagesRowProps) {
  if (!langs || langs.length === 0) return null;

  const visible = langs.length > max ? langs.slice(0, max - 1) : langs;
  const overflow = langs.length > max ? langs.length - visible.length : 0;

  return (
    <View style={styles.row}>
      {visible.map((lang) => (
        <Flag key={lang} code={langCodeToCountryCode(lang)} size={size} />
      ))}
      {overflow > 0 && (
        <Text style={[styles.more, { fontSize: Math.max(10, size - 5) }]}>
          +{overflow}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  more: {
    color: '#6B7280',
    fontWeight: '700',
    marginLeft: 2,
  },
});
