// components/tour/WeatherChip.tsx
// Compact, tappable current-weather indicator for the tour detail stats row.
// Presentational: the page owns the fetch and passes `weather` down.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { WeatherData } from '../../services/weather.service';
import { getCondition, resolveIcon } from '../../lib/weather-codes';

interface WeatherChipProps {
  weather: WeatherData;
  onPress: () => void;
}

export function WeatherChip({ weather, onPress }: WeatherChipProps) {
  const { t } = useTranslation();
  const { current } = weather;
  const cond = getCondition(current.code);
  const icon = resolveIcon(current.code, current.isDay);

  return (
    <TouchableOpacity
      style={styles.chip}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${t('weather.title')}: ${current.temp}° ${t(cond.labelKey)}. ${t('weather.tapForMore')}`}
    >
      <Ionicons name={icon as any} size={26} color={cond.color} />
      <View style={styles.textCol}>
        <View style={styles.topRow}>
          <Text style={styles.temp}>{current.temp}°</Text>
          <Text style={styles.label} numberOfLines={1}>
            {t(cond.labelKey)}
          </Text>
        </View>
        <Text style={styles.hint} numberOfLines={1}>
          {t('weather.tapForMore')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  textCol: {
    gap: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  temp: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  label: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  hint: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '600',
  },
});
