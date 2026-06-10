// components/tour/WeatherModal.tsx
// Forecast modal: current conditions + next 24h hourly.
// Desktop = centered card; mobile = fullscreen (matches StepTimeline / app modals).

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { WeatherData, WeatherHour } from '../../services/weather.service';
import { getCondition, resolveIcon } from '../../lib/weather-codes';

interface WeatherModalProps {
  visible: boolean;
  weather: WeatherData | null;
  locationLabel?: string;
  onClose: () => void;
}

/** "2026-06-10T14:00" → "14:00" (no timezone reinterpretation). */
function formatHour(iso: string): string {
  const tIdx = iso.indexOf('T');
  return tIdx >= 0 ? iso.slice(tIdx + 1, tIdx + 6) : iso;
}

/** Slice the next 24 hourly entries starting at the current hour. */
function useHourlySlice(weather: WeatherData | null): WeatherHour[] {
  return useMemo(() => {
    if (!weather) return [];
    const { hourly, current } = weather;
    const curPrefix = current.time.slice(0, 13); // YYYY-MM-DDTHH
    let startIdx = hourly.findIndex((h) => h.time.slice(0, 13) === curPrefix);
    if (startIdx < 0) startIdx = hourly.findIndex((h) => h.time >= current.time);
    if (startIdx < 0) startIdx = 0;
    return hourly.slice(startIdx, startIdx + 24);
  }, [weather]);
}

export function WeatherModal({ visible, weather, locationLabel, onClose }: WeatherModalProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isMobile = Platform.OS !== 'web' || width < 768;
  const hours = useHourlySlice(weather);

  const body = (
    <>
      <View style={styles.header}>
        <View style={styles.headerTitles}>
          <Text style={styles.title}>{t('weather.title')}</Text>
          {locationLabel ? <Text style={styles.subtitle}>{locationLabel}</Text> : null}
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
          <Ionicons name="close" size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      {!weather ? (
        <Text style={styles.unavailable}>{t('weather.unavailable')}</Text>
      ) : (
        <>
          {/* Current conditions */}
          <View style={styles.currentBlock}>
            <Ionicons
              name={resolveIcon(weather.current.code, weather.current.isDay) as any}
              size={64}
              color={getCondition(weather.current.code).color}
            />
            <View style={styles.currentInfo}>
              <Text style={styles.currentTemp}>{weather.current.temp}°</Text>
              <Text style={styles.currentCond}>
                {t(getCondition(weather.current.code).labelKey)}
              </Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>{t('weather.feelsLike')}</Text>
              <Text style={styles.metricValue}>{weather.current.apparentTemp}°</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>{t('weather.humidity')}</Text>
              <Text style={styles.metricValue}>{weather.current.humidity}%</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>{t('weather.wind')}</Text>
              <Text style={styles.metricValue}>{weather.current.windSpeed} km/h</Text>
            </View>
          </View>

          {/* Hourly */}
          <Text style={styles.hourlyHeading}>{t('weather.hourly')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hourlyRow}
          >
            {hours.map((h, i) => (
              <View key={h.time} style={styles.hourCell}>
                <Text style={styles.hourTime}>{i === 0 ? t('weather.now') : formatHour(h.time)}</Text>
                <Ionicons
                  name={resolveIcon(h.code, true) as any}
                  size={24}
                  color={getCondition(h.code).color}
                />
                <Text style={styles.hourTemp}>{h.temp}°</Text>
                <View style={styles.hourPrecip}>
                  <Ionicons name="water-outline" size={11} color="#3B82F6" />
                  <Text style={styles.hourPrecipText}>{h.precipitationProbability}%</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </>
  );

  // Mobile: fullscreen.
  if (isMobile) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.mobileSafe}>
          <ScrollView contentContainerStyle={styles.mobileContent}>{body}</ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  // Desktop web: centered card.
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={() => {}}>
          <ScrollView showsVerticalScrollIndicator={false}>{body}</ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mobileSafe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mobileContent: {
    padding: 20,
    paddingBottom: 40,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 460,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  unavailable: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 24,
  },
  currentBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  currentInfo: {
    flex: 1,
  },
  currentTemp: {
    fontSize: 40,
    fontWeight: '800',
    color: '#111827',
  },
  currentCond: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  hourlyHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  hourlyRow: {
    gap: 8,
    paddingBottom: 4,
  },
  hourCell: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    minWidth: 64,
  },
  hourTime: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  hourTemp: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  hourPrecip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  hourPrecipText: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '500',
  },
});
