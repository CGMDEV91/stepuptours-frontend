// components/business/BusinessAnalyticsTab.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  fetchBusinessAnalytics,
  fetchTourAnalytics,
  type BusinessAnalytics,
  type TourAnalyticsDetail,
} from '../../services/analytics.service';
import {
  type Preset,
  getPresetRange,
  fmtSecs,
  InfoTooltip,
  SummaryCard,
  StepDrilldown,
} from '../admin/AnalyticsTab';

const GREEN  = '#10B981';
const GREEN_DARK = '#059669';
const BLUE   = '#3B82F6';
const AMBER  = '#F59E0B';
const PURPLE = '#8B5CF6';
const RED    = '#EF4444';

// Top-tours table column widths
const TTC = {
  tour:  { flex: 1, minWidth: 120 } as const,
  views: { width: 90 }             as const,
  ctr:   { width: 72 }             as const,
  btn:   { width: 96 }             as const,
};
const TOP_TOURS_MIN_W = 120 + 90 + 72 + 96 + 32;

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  businessId: string;
}

export function BusinessAnalyticsTab({ businessId }: Props) {
  const { t, i18n } = useTranslation();
  const { width }   = useWindowDimensions();
  const isMobile    = width < 600;
  const langcode    = i18n.language;

  const [preset, setPreset]                       = useState<Preset>('30d');
  const [data, setData]                           = useState<BusinessAnalytics | null>(null);
  const [loading, setLoading]                     = useState(false);
  const [error, setError]                         = useState<string | null>(null);
  const [subscriptionRequired, setSubRequired]    = useState(false);
  const [selectedTour, setSelectedTour]           = useState<TourAnalyticsDetail | null>(null);
  const [tourLoading, setTourLoading]             = useState(false);
  const [tourError, setTourError]                 = useState<string | null>(null);

  const { from, to } = getPresetRange(preset);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSubRequired(false);
    try {
      const result = await fetchBusinessAnalytics(businessId, from, to, langcode);
      setData(result);
    } catch (e: any) {
      if (e?.status === 403 || e?.message === 'subscription_required') {
        setSubRequired(true);
      } else {
        setError(t('common.errorLoading') ?? 'Failed to load analytics data.');
      }
    } finally {
      setLoading(false);
    }
  }, [businessId, from, to, langcode]);

  useEffect(() => {
    setSelectedTour(null);
    void load();
  }, [load]);

  const handleOpenTour = async (tourId: string) => {
    setTourLoading(true);
    setTourError(null);
    try {
      const detail = await fetchTourAnalytics(tourId, from, to, langcode);
      setSelectedTour(detail);
    } catch {
      setTourError(t('common.errorLoading') ?? 'Failed to load tour data.');
    } finally {
      setTourLoading(false);
    }
  };

  const containerWidth = isMobile ? width - 32 : Math.min(width * 0.9, 860) - 32;

  const presets: { key: Preset; label: string }[] = [
    { key: '7d',  label: t('business.analytics.preset.7d')  },
    { key: '30d', label: t('business.analytics.preset.30d') },
    { key: '90d', label: t('business.analytics.preset.90d') },
    { key: 'all', label: t('business.analytics.preset.all') },
  ];

  // ── Subscription required ─────────────────────────────────────────────────
  if (subscriptionRequired) {
    return (
      <View style={styles.upgradeBox}>
        <View style={styles.upgradeIconRow}>
          <Ionicons name="star-outline" size={28} color="#B45309" />
        </View>
        <Text style={styles.upgradeTitle}>{t('business.analytics.upgradeTitle')}</Text>
        <Text style={styles.upgradeBody}>{t('business.analytics.upgradeBody')}</Text>
      </View>
    );
  }

  // ── Tour drilldown view ───────────────────────────────────────────────────
  if (selectedTour) {
    return (
      <View>
        <StepDrilldown
          detail={selectedTour}
          onBack={() => setSelectedTour(null)}
          containerWidth={containerWidth}
        />
      </View>
    );
  }

  // ── Main view ─────────────────────────────────────────────────────────────
  return (
    <View>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{t('business.analytics.title')}</Text>
        <View style={styles.presetRow}>
          {presets.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.presetBtn, preset === key && styles.presetBtnActive]}
              onPress={() => setPreset(key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.presetLabel, preset === key && styles.presetLabelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={load} style={styles.refreshBtn} activeOpacity={0.8}>
            <Ionicons name="refresh-outline" size={16} color={GREEN} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.dateRange}>{from} → {to}</Text>

      {/* Error */}
      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={18} color={RED} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} activeOpacity={0.8}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Summary cards */}
      <View style={[styles.cardsRow, isMobile && styles.cardsGrid]}>
        <SummaryCard
          icon="eye-outline"
          iconColor={BLUE}
          label={t('business.analytics.cards.stepViews')}
          tooltip={t('business.analytics.cards.stepViewsTooltip')}
          value={data?.step_views ?? 0}
          loading={loading}
        />
        <SummaryCard
          icon="link-outline"
          iconColor={GREEN}
          label={t('business.analytics.cards.linkClicks')}
          tooltip={t('business.analytics.cards.linkClicksTooltip')}
          value={data?.total_link_clicks ?? 0}
          loading={loading}
        />
        <SummaryCard
          icon="trending-up-outline"
          iconColor={PURPLE}
          label={t('business.analytics.cards.ctr')}
          tooltip={t('business.analytics.cards.ctrTooltip')}
          value={data && data.click_through_rate != null && !isNaN(data.click_through_rate)
            ? `${Math.round(data.click_through_rate * 100)}%`
            : '—'}
          sub={data && data.click_through_rate != null && !isNaN(data.click_through_rate)
            ? (data.click_through_rate >= 0.2 ? '✓ Good CTR' : 'Below 20%')
            : undefined}
          loading={loading}
        />
        <SummaryCard
          icon="time-outline"
          iconColor={AMBER}
          label={t('business.analytics.cards.avgTime')}
          tooltip={t('business.analytics.cards.avgTimeTooltip')}
          value={data ? fmtSecs(data.avg_time_on_step_seconds) : '—'}
          loading={loading}
        />
      </View>

      {/* Click breakdown */}
      {(data || loading) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('business.analytics.breakdown.title')}</Text>
          {loading ? (
            <View style={styles.loaderRow}>
              <ActivityIndicator size="small" color={GREEN} />
            </View>
          ) : (
            <View style={styles.pillsRow}>
              <View style={styles.pill}>
                <Ionicons name="globe-outline" size={16} color={BLUE} />
                <Text style={styles.pillLabel}>{t('business.analytics.breakdown.website')}</Text>
                <Text style={[styles.pillValue, { color: BLUE }]}>
                  {(data?.website_clicks ?? 0).toLocaleString()}
                </Text>
              </View>
              <View style={styles.pill}>
                <Ionicons name="call-outline" size={16} color={GREEN} />
                <Text style={styles.pillLabel}>{t('business.analytics.breakdown.phone')}</Text>
                <Text style={[styles.pillValue, { color: GREEN }]}>
                  {(data?.phone_clicks ?? 0).toLocaleString()}
                </Text>
              </View>
              <View style={styles.pill}>
                <Ionicons name="map-outline" size={16} color={AMBER} />
                <Text style={styles.pillLabel}>{t('business.analytics.breakdown.maps')}</Text>
                <Text style={[styles.pillValue, { color: AMBER }]}>
                  {(data?.maps_clicks ?? 0).toLocaleString()}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Top tours */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>{t('business.analytics.topTours.title')}</Text>
          {tourLoading && <ActivityIndicator size="small" color={GREEN} style={{ marginLeft: 8 }} />}
        </View>

        {tourError ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={RED} />
            <Text style={[styles.errorText, { fontSize: 12 }]}>{tourError}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loaderRow}>
            <ActivityIndicator size="large" color={GREEN} />
          </View>
        ) : !data?.top_tours?.length ? (
          <View style={styles.tableEmpty}>
            <Ionicons name="map-outline" size={32} color="#D1D5DB" />
            <Text style={styles.tableEmptyText}>{t('business.analytics.topTours.noData')}</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            // @ts-ignore — className valid on RN Web
            className="analytics-table-scroll"
            style={{ width: '100%' }}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            <View style={{ minWidth: TOP_TOURS_MIN_W }}>
              {/* Header */}
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.thText, TTC.tour]}>
                  {t('business.analytics.topTours.colTour')}
                </Text>
                <View style={[styles.thCell, TTC.views]}>
                  <Text style={styles.thText}>{t('business.analytics.topTours.colViews')}</Text>
                  <InfoTooltip text={t('business.analytics.cards.stepViewsTooltip')} />
                </View>
                <View style={[styles.thCell, TTC.ctr]}>
                  <Text style={styles.thText}>{t('business.analytics.topTours.colCTR')}</Text>
                  <InfoTooltip text={t('business.analytics.cards.ctrTooltip')} />
                </View>
                <View style={[styles.thCell, TTC.btn]} />
              </View>

              {/* Rows */}
              {data.top_tours.map((tour, i) => (
                <View
                  key={tour.tour_id}
                  style={[styles.tableRow, i % 2 === 0 && styles.tableRowEven]}
                >
                  <Text
                    style={[styles.tdCell, TTC.tour, { fontWeight: '500' }]}
                    numberOfLines={2}
                  >
                    {tour.tour_title || '–'}
                  </Text>
                  <Text style={[styles.tdCell, TTC.views]}>
                    {tour.step_views.toLocaleString()}
                  </Text>
                  <Text style={[
                    styles.tdCell, TTC.ctr,
                    { color: (tour.ctr ?? 0) >= 0.2 ? GREEN : AMBER, fontWeight: '600' },
                  ]}>
                    {tour.ctr != null && !isNaN(tour.ctr) ? `${Math.round(tour.ctr * 100)}%` : '—'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.detailsBtn, TTC.btn]}
                    onPress={() => handleOpenTour(tour.tour_id)}
                    disabled={tourLoading}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.detailsBtnText}>{t('common.details') ?? 'Details'}</Text>
                    <Ionicons name="chevron-forward" size={13} color={GREEN_DARK} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* No data fallback */}
      {!loading && !error && data && data.step_views === 0 && (
        <View style={styles.noDataBox}>
          <Ionicons name="bar-chart-outline" size={32} color="#D1D5DB" />
          <Text style={styles.noDataText}>{t('business.analytics.noData')}</Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 4, flexWrap: 'wrap', gap: 8,
  },
  heading: { fontSize: 18, fontWeight: '700', color: '#111827' },
  presetRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  presetBtn: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16,
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF',
  },
  presetBtnActive: { backgroundColor: GREEN, borderColor: GREEN },
  presetLabel: { fontSize: 11, fontWeight: '600', color: '#374151' },
  presetLabelActive: { color: '#FFFFFF' },
  refreshBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  dateRange: { fontSize: 11, color: '#9CA3AF', marginBottom: 12 },

  // Error
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 13, color: '#DC2626' },
  retryText: { fontSize: 13, fontWeight: '600', color: GREEN },

  // Cards
  cardsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  cardsGrid: { flexWrap: 'wrap' },

  // Section
  section: {
    backgroundColor: '#FFFFFF', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    padding: 16, marginBottom: 16,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },

  // Loader
  loaderRow: { height: 60, justifyContent: 'center', alignItems: 'center' },

  // Click breakdown pills
  pillsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  pill: {
    flex: 1, minWidth: 100,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F9FAFB', borderRadius: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  pillLabel: { flex: 1, fontSize: 13, color: '#6B7280', fontWeight: '500' },
  pillValue: { fontSize: 16, fontWeight: '700' },

  // Table
  tableEmpty: { paddingVertical: 32, alignItems: 'center', gap: 8 },
  tableEmptyText: { fontSize: 13, color: '#9CA3AF' },
  tableHeader: {
    backgroundColor: '#F9FAFB', borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB', borderRadius: 8,
  },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6',
  },
  tableRowEven: { backgroundColor: '#FAFAFA' },
  thCell: { flexDirection: 'row', alignItems: 'flex-start', gap: 3, paddingRight: 4 },
  thText: {
    fontSize: 11, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase' as const, letterSpacing: 0.3,
  },
  tdCell: { fontSize: 13, color: '#374151', paddingRight: 4 },

  // Details button
  detailsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, borderColor: '#A7F3D0', backgroundColor: '#ECFDF5',
  },
  detailsBtnText: { fontSize: 12, fontWeight: '600', color: GREEN_DARK },

  // No data
  noDataBox: {
    alignItems: 'center', gap: 10, paddingVertical: 40,
    backgroundColor: '#FFFFFF', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  noDataText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 24 },

  // Subscription required / upgrade banner
  upgradeBox: {
    alignItems: 'center', gap: 12, paddingVertical: 48, paddingHorizontal: 24,
    backgroundColor: '#FFFBEB', borderRadius: 16,
    borderWidth: 1, borderColor: '#FDE68A',
    marginTop: 8,
  },
  upgradeIconRow: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center',
  },
  upgradeTitle: {
    fontSize: 17, fontWeight: '700', color: '#92400E', textAlign: 'center',
  },
  upgradeBody: {
    fontSize: 14, color: '#78350F', textAlign: 'center', lineHeight: 22,
    maxWidth: 320,
  },
});
