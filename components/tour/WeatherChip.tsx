// components/tour/WeatherChip.tsx
// Compact, tappable current-weather indicator for the tour detail stats row.
// Handles loading / error / ready states. Presentational: the page owns the
// fetch and retry, and passes status + data down.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { WeatherData } from '../../services/weather.service';
import { getCondition, resolveIcon } from '../../lib/weather-codes';

type WeatherChipStatus = 'loading' | 'error' | 'ready';

interface WeatherChipProps {
  status: WeatherChipStatus;
  weather?: WeatherData | null;
  /** Open the forecast modal (ready state). */
  onPress: () => void;
  /** Retry the fetch (error state). */
  onRetry: () => void;
}

export function WeatherChip({ status, weather, onPress, onRetry }: WeatherChipProps) {
  const { t } = useTranslation();

  // Loading: spinner + message.
  if (status === 'loading' || !weather) {
    return (
      <View style={[styles.chip, styles.chipNeutral]}>
        <ActivityIndicator size="small" color="#6B7280" />
        <Text style={styles.loadingText} numberOfLines={1}>
          {t('weather.loading')}
        </Text>
      </View>
    );
  }

  // Error: reload icon + retry affordance.
  if (status === 'error') {
    return (
      <TouchableOpacity
        style={[styles.chip, styles.chipError]}
        onPress={onRetry}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${t('weather.couldNotLoad')}. ${t('weather.retry')}`}
      >
        <Ionicons name="refresh" size={22} color="#DC2626" />
        <View style={styles.textCol}>
          <Text style={styles.errorTitle} numberOfLines={1}>
            {t('weather.couldNotLoad')}
          </Text>
          <Text style={styles.errorRetry} numberOfLines={1}>
            {t('weather.retry')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // Ready: current weather, tappable to open the modal.
  const { current } = weather;
  const cond = getCondition(current.code);
  const icon = resolveIcon(current.code, current.isDay);

  return (
    <TouchableOpacity
      style={[styles.chip, styles.chipReady]}
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
  },
  chipReady: {
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  chipNeutral: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    paddingRight: 12,
  },
  chipError: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    paddingRight: 12,
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
  loadingText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  errorRetry: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
});
