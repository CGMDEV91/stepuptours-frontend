// components/ui/Flag.tsx
// Single source of truth for flag styling across the app: rounded corners +
// a thin border, matching the flags shown on tour cards. Wrap
// react-native-country-flag so every flag (navbar, language pickers, profile,
// register, translation pages, rankings, cards) looks identical.

import React from 'react';
import { StyleSheet } from 'react-native';
import CountryFlag from 'react-native-country-flag';

interface FlagProps {
  /** ISO 3166 country code expected by react-native-country-flag (e.g. "ES"). */
  code: string;
  /** Flag height in px. */
  size?: number;
}

export function Flag({ code, size = 16 }: FlagProps) {
  const radius = Math.max(2, Math.round(size * 0.18));
  return (
    <CountryFlag isoCode={code} size={size} style={[styles.flag, { borderRadius: radius }]} />
  );
}

const styles = StyleSheet.create({
  flag: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.18)',
  },
});

export default Flag;
