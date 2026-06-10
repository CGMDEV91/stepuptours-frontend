// components/tour/WeatherModal.tsx
// Forecast modal: a tappable 7-day strip (weekly summary) that filters the view
// to the selected day, plus that day's hourly breakdown.
// Desktop = centered card; mobile = fullscreen (matches StepTimeline / app modals).

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import type { WeatherData, WeatherHour, WeatherDay } from '../../services/weather.service';
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

/** Local YYYY-MM-DD for a Date (no UTC shift). */
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * On web, a mouse wheel only scrolls vertically, so horizontal ScrollViews can't
 * be moved with a mouse. This translates vertical wheel movement over the strip
 * into horizontal scroll. No-op on native (touch already scrolls horizontally).
 */
function useWheelToHorizontal(ref: React.RefObject<ScrollView>, active: boolean) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !active) return;
    const node: any = (ref.current as any)?.getScrollableNode?.();
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // already a horizontal gesture
      node.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [ref, active]);
}

export function WeatherModal({ visible, weather, locationLabel, onClose }: WeatherModalProps) {
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const isMobile = Platform.OS !== 'web' || width < 768;

  const todayDate = weather ? weather.current.time.slice(0, 10) : '';
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);

  const dailyScrollRef = useRef<ScrollView>(null);
  const hourlyScrollRef = useRef<ScrollView>(null);
  const scrollActive = visible && !!weather;
  useWheelToHorizontal(dailyScrollRef, scrollActive);
  useWheelToHorizontal(hourlyScrollRef, scrollActive);

  // Reset selection to "today" each time the modal opens for a new tour/day.
  React.useEffect(() => {
    if (visible && todayDate) setSelectedDate(todayDate);
  }, [visible, todayDate]);

  const tomorrowDate = useMemo(() => {
    if (!todayDate) return '';
    const d = new Date(`${todayDate}T00:00:00`);
    d.setDate(d.getDate() + 1);
    return isoDate(d);
  }, [todayDate]);

  const dayLabel = (date: string): string => {
    if (date === todayDate) return t('weather.today');
    if (date === tomorrowDate) return t('weather.tomorrow');
    try {
      return new Date(`${date}T00:00:00`).toLocaleDateString(i18n.language, { weekday: 'short' });
    } catch {
      return date.slice(5); // MM-DD fallback
    }
  };

  const isToday = selectedDate === todayDate;
  const selectedDay: WeatherDay | undefined = weather?.daily.find((d) => d.date === selectedDate);

  // Hourly entries for the selected day (for today: from the current hour onward).
  const hours: WeatherHour[] = useMemo(() => {
    if (!weather) return [];
    let list = weather.hourly.filter((h) => h.time.slice(0, 10) === selectedDate);
    if (isToday) {
      const curPrefix = weather.current.time.slice(0, 13);
      let startIdx = list.findIndex((h) => h.time.slice(0, 13) === curPrefix);
      if (startIdx < 0) startIdx = list.findIndex((h) => h.time >= weather.current.time);
      if (startIdx > 0) list = list.slice(startIdx);
    }
    return list.slice(0, 24);
  }, [weather, selectedDate, isToday]);

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
          {/* Summary block for the selected day */}
          {isToday ? (
            <>
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
            </>
          ) : selectedDay ? (
            <>
              <View style={styles.currentBlock}>
                <Ionicons
                  name={resolveIcon(selectedDay.code, true) as any}
                  size={64}
                  color={getCondition(selectedDay.code).color}
                />
                <View style={styles.currentInfo}>
                  <Text style={styles.currentTemp}>{selectedDay.tempMax}°</Text>
                  <Text style={styles.currentCond}>{t(getCondition(selectedDay.code).labelKey)}</Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>{t('weather.high')}</Text>
                  <Text style={styles.metricValue}>{selectedDay.tempMax}°</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>{t('weather.low')}</Text>
                  <Text style={styles.metricValue}>{selectedDay.tempMin}°</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>{t('weather.rain')}</Text>
                  <Text style={styles.metricValue}>{selectedDay.precipitationProbabilityMax}%</Text>
                </View>
              </View>
            </>
          ) : null}

          {/* 7-day strip (weekly summary + day filter) */}
          <Text style={styles.sectionHeading}>{t('weather.week')}</Text>
          <View style={[styles.scrollWrap, styles.dailyWrap]}>
            <ScrollView
              ref={dailyScrollRef}
              horizontal
              showsHorizontalScrollIndicator
              contentContainerStyle={styles.dailyRow}
            >
              {weather.daily.map((d) => {
                const active = d.date === selectedDate;
                return (
                  <TouchableOpacity
                    key={d.date}
                    style={[styles.dayCell, active && styles.dayCellActive]}
                    onPress={() => setSelectedDate(d.date)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{dayLabel(d.date)}</Text>
                    <Ionicons
                      name={resolveIcon(d.code, true) as any}
                      size={24}
                      color={getCondition(d.code).color}
                    />
                    <Text style={styles.dayTemp}>
                      {d.tempMax}° <Text style={styles.dayTempMin}>{d.tempMin}°</Text>
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {Platform.OS === 'web' && <View pointerEvents="none" style={styles.fadeRight} />}
          </View>

          {/* Hourly for the selected day */}
          <Text style={styles.sectionHeading}>{t('weather.hourly')}</Text>
          <View style={styles.scrollWrap}>
            <ScrollView
              ref={hourlyScrollRef}
              horizontal
              showsHorizontalScrollIndicator
              contentContainerStyle={styles.hourlyRow}
            >
              {hours.map((h, i) => (
                <View key={h.time} style={styles.hourCell}>
                  <Text style={styles.hourTime}>
                    {isToday && i === 0 ? t('weather.now') : formatHour(h.time)}
                  </Text>
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
            {Platform.OS === 'web' && <View pointerEvents="none" style={styles.fadeRight} />}
          </View>
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
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  scrollWrap: {
    position: 'relative',
  },
  dailyWrap: {
    marginBottom: 20,
  },
  fadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 36,
    backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0), rgba(255,255,255,1))',
  },
  dailyRow: {
    gap: 8,
    paddingBottom: 4,
    paddingRight: 24,
  },
  dayCell: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 70,
  },
  dayCellActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  dayLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  dayLabelActive: {
    color: '#2563EB',
  },
  dayTemp: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  dayTempMin: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  hourlyRow: {
    gap: 8,
    paddingBottom: 4,
    paddingRight: 24,
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
