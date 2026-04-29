// components/admin/AnalyticsTab.tsx
// Analytics dashboard tab for the admin panel

import React, { useEffect, useState, useCallback } from 'react';
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
import { Svg, Polyline, Line, Text as SvgText, Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/auth.store';
import {
  fetchAnalyticsSummary,
  fetchTourAnalytics,
  fetchAllBusinessAnalytics,
  type AnalyticsSummary,
  type TourSummary,
  type TourAnalyticsDetail,
  type StepAnalytics,
  type BusinessSummary,
  type DatePoint,
} from '../../services/analytics.service';

const AMBER = '#F59E0B';
const GREEN = '#22C55E';
const RED   = '#EF4444';
const BLUE  = '#3B82F6';

// ── Helpers ───────────────────────────────────────────────────────────────────

type Preset = '7d' | '30d' | '90d';

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getPresetRange(preset: Preset): { from: string; to: string } {
  const to   = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (preset === '7d' ? 7 : preset === '30d' ? 30 : 90) + 1);
  return { from: formatDate(from), to: formatDate(to) };
}

function fmtSecs(s: number): string {
  if (!s || s <= 0) return '—';
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

function dropColor(rate: number): string {
  if (rate < 0.1) return GREEN;
  if (rate < 0.3) return AMBER;
  return RED;
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({
  icon, iconColor, label, value, sub, loading,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: number | string;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={[styles.cardIcon, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={styles.cardLabel}>{label}</Text>
      {loading ? (
        <ActivityIndicator size="small" color={AMBER} style={{ marginTop: 4 }} />
      ) : (
        <>
          <Text style={styles.cardValue}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </Text>
          {sub ? <Text style={styles.cardSub}>{sub}</Text> : null}
        </>
      )}
    </View>
  );
}

// ── Sparkline chart ───────────────────────────────────────────────────────────

function SparklineChart({ data, width }: { data: DatePoint[]; width: number }) {
  if (!data || data.length < 2) {
    return (
      <View style={[styles.chartEmpty, { width }]}>
        <Text style={styles.chartEmptyText}>Not enough data</Text>
      </View>
    );
  }

  const height   = 160;
  const padX     = 12;
  const padY     = 24;
  const chartW   = width - padX * 2;
  const chartH   = height - padY * 2;
  const globalMax = Math.max(...data.map((d) => Math.max(d.views, d.completions, d.abandonments)), 1);

  const toX = (i: number) => padX + (i / (data.length - 1)) * chartW;
  const toY = (v: number) => padY + chartH - (v / globalMax) * chartH;
  const pts  = (key: keyof DatePoint) =>
    data.map((d, i) => `${toX(i)},${toY(d[key] as number)}`).join(' ');

  const labelStep = Math.max(1, Math.floor(data.length / 5));

  return (
    <View style={{ width }}>
      <View style={styles.chartLegend}>
        {[{ color: BLUE, label: 'Views' }, { color: GREEN, label: 'Completions' }, { color: RED, label: 'Abandonments' }].map(
          ({ color, label }) => (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendLabel}>{label}</Text>
            </View>
          ),
        )}
      </View>
      <Svg width={width} height={height}>
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = padY + chartH * (1 - pct);
          return <Line key={pct} x1={padX} y1={y} x2={padX + chartW} y2={y} stroke="#F3F4F6" strokeWidth={1} />;
        })}
        <Polyline points={pts('views')}        fill="none" stroke={BLUE}  strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <Polyline points={pts('completions')}  fill="none" stroke={GREEN} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <Polyline points={pts('abandonments')} fill="none" stroke={RED}   strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {[0, data.length - 1].map((i) => (
          <React.Fragment key={i}>
            <Circle cx={toX(i)} cy={toY(data[i].views)}        r={3} fill={BLUE}  />
            <Circle cx={toX(i)} cy={toY(data[i].completions)}  r={3} fill={GREEN} />
            <Circle cx={toX(i)} cy={toY(data[i].abandonments)} r={3} fill={RED}   />
          </React.Fragment>
        ))}
        {data.map((d, i) => {
          if (i % labelStep !== 0 && i !== data.length - 1) return null;
          return (
            <SvgText key={i} x={toX(i)} y={height - 3} fontSize={9} fill="#9CA3AF" textAnchor="middle">
              {d.date.slice(5)}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

// ── Column header ─────────────────────────────────────────────────────────────

function ColHeader<T extends string>({
  k, label, sortKey, sortAsc, onSort,
}: {
  k: T; label: string; sortKey: T; sortAsc: boolean; onSort: (k: T) => void;
}) {
  const active = sortKey === k;
  return (
    <TouchableOpacity style={styles.thCell} onPress={() => onSort(k)} activeOpacity={0.7}>
      <Text style={[styles.thText, active && styles.thTextActive]}>{label}</Text>
      {active && <Ionicons name={sortAsc ? 'chevron-up' : 'chevron-down'} size={10} color={AMBER} />}
    </TouchableOpacity>
  );
}

// ── Tours table ───────────────────────────────────────────────────────────────

type TourSortKey = 'views' | 'starts' | 'completions' | 'completion_rate' | 'abandonments' | 'avg_step_duration_s' | 'shares';

function ToursTable({
  tours,
  isMobile,
  onOpenTour,
  tourDetailLoading,
}: {
  tours: TourSummary[];
  isMobile: boolean;
  onOpenTour: (tour: TourSummary) => void;
  tourDetailLoading: boolean;
}) {
  const [sortKey, setSortKey] = useState<TourSortKey>('views');
  const [sortAsc, setSortAsc] = useState(false);

  const onSort = (k: TourSortKey) => {
    if (sortKey === k) setSortAsc((v) => !v);
    else { setSortKey(k); setSortAsc(false); }
  };

  const sorted = [...tours].sort((a, b) => {
    const av = (a[sortKey] ?? 0) as number;
    const bv = (b[sortKey] ?? 0) as number;
    return sortAsc ? av - bv : bv - av;
  });

  if (!sorted.length) {
    return (
      <View style={styles.tableEmpty}>
        <Ionicons name="map-outline" size={32} color="#D1D5DB" />
        <Text style={styles.tableEmptyText}>No tour data available yet.</Text>
      </View>
    );
  }

  const hProps = { sortKey, sortAsc, onSort };

  return (
    <View style={styles.table}>
      {/* Header */}
      <View style={[styles.tableRow, styles.tableHeader]}>
        <Text style={[styles.thText, { flex: isMobile ? 2 : 3, paddingLeft: 4 }]}>Tour</Text>
        <ColHeader k="views"           label="Views"  {...hProps} />
        {!isMobile && <ColHeader k="starts"          label="Starts" {...hProps} />}
        {!isMobile && <ColHeader k="completions"     label="Done"   {...hProps} />}
        <ColHeader k="completion_rate" label="Rate"   {...hProps} />
        {!isMobile && <ColHeader k="avg_step_duration_s" label="Avg Time" {...hProps} />}
        {!isMobile && <ColHeader k="abandonments"    label="Drop"   {...hProps} />}
        {!isMobile && <ColHeader k="shares"          label="Share"  {...hProps} />}
        <View style={styles.thCell}><Text style={styles.thText}>Steps</Text></View>
      </View>

      {sorted.map((tour, i) => (
        <View key={tour.tour_id} style={[styles.tableRow, i % 2 === 0 && styles.tableRowEven]}>
          {/* Title */}
          <Text style={[styles.tdCell, { flex: isMobile ? 2 : 3, fontWeight: '500' }]} numberOfLines={1}>
            {tour.title || <Text style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Untitled</Text>}
          </Text>

          {/* Views */}
          <Text style={styles.tdCell}>{tour.views.toLocaleString()}</Text>

          {/* Desktop-only columns */}
          {!isMobile && <Text style={styles.tdCell}>{tour.starts.toLocaleString()}</Text>}
          {!isMobile && <Text style={styles.tdCell}>{tour.completions.toLocaleString()}</Text>}

          {/* Rate */}
          <Text style={[styles.tdCell, { color: tour.completion_rate >= 0.5 ? GREEN : AMBER, fontWeight: '600' }]}>
            {Math.round(tour.completion_rate * 100)}%
          </Text>

          {/* Avg time */}
          {!isMobile && (
            <Text style={[styles.tdCell, { color: '#6B7280' }]}>
              {fmtSecs(tour.avg_step_duration_s ?? 0)}
            </Text>
          )}

          {/* Abandonments */}
          {!isMobile && <Text style={styles.tdCell}>{tour.abandonments.toLocaleString()}</Text>}
          {!isMobile && <Text style={styles.tdCell}>{tour.shares.toLocaleString()}</Text>}

          {/* Steps link */}
          <TouchableOpacity
            style={styles.stepsBtn}
            onPress={() => onOpenTour(tour)}
            activeOpacity={0.7}
            disabled={tourDetailLoading}
          >
            {tourDetailLoading ? (
              <ActivityIndicator size="small" color={AMBER} />
            ) : (
              <>
                <Text style={styles.stepsBtnText}>Steps</Text>
                <Ionicons name="chevron-forward" size={13} color={AMBER} />
              </>
            )}
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ── Step drilldown view ───────────────────────────────────────────────────────

function StepDrilldown({
  detail,
  onBack,
}: {
  detail: TourAnalyticsDetail;
  onBack: () => void;
}) {
  const steps = [...detail.steps].sort((a, b) => a.order - b.order);

  return (
    <View>
      {/* Back + title */}
      <View style={styles.drillHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={16} color={AMBER} />
          <Text style={styles.backBtnText}>Tours</Text>
        </TouchableOpacity>
        <Text style={styles.drillTitle} numberOfLines={1}>{detail.title}</Text>
      </View>

      {/* Mini summary pills */}
      <View style={styles.drillPills}>
        <View style={styles.drillPill}>
          <Ionicons name="eye-outline" size={14} color={BLUE} />
          <Text style={styles.drillPillLabel}>Views</Text>
          <Text style={[styles.drillPillValue, { color: BLUE }]}>{detail.views.toLocaleString()}</Text>
        </View>
        <View style={styles.drillPill}>
          <Ionicons name="checkmark-circle-outline" size={14} color={GREEN} />
          <Text style={styles.drillPillLabel}>Rate</Text>
          <Text style={[styles.drillPillValue, { color: GREEN }]}>
            {Math.round(detail.completion_rate * 100)}%
          </Text>
        </View>
        <View style={styles.drillPill}>
          <Ionicons name="arrow-back-circle-outline" size={14} color={RED} />
          <Text style={styles.drillPillLabel}>Avg drop</Text>
          <Text style={[styles.drillPillValue, { color: RED }]}>
            {Math.round(detail.avg_abandonment_pct)}%
          </Text>
        </View>
      </View>

      {/* Steps table */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Step analytics</Text>

        {!steps.length ? (
          <View style={styles.tableEmpty}>
            <Ionicons name="footsteps-outline" size={32} color="#D1D5DB" />
            <Text style={styles.tableEmptyText}>No step data yet.</Text>
          </View>
        ) : (
          <View style={styles.table}>
            {/* Header */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.thText, { width: 28 }]}>#</Text>
              <Text style={[styles.thText, { flex: 2, paddingLeft: 4 }]}>Step</Text>
              <Text style={styles.thText}>Views</Text>
              <Text style={styles.thText}>Done</Text>
              <Text style={styles.thText}>Avg Time</Text>
              <Text style={styles.thText}>Drop</Text>
            </View>

            {steps.map((step, i) => (
              <View
                key={step.step_id}
                style={[styles.tableRow, i % 2 === 0 && styles.tableRowEven]}
              >
                <Text style={[styles.tdCell, { width: 28, color: '#9CA3AF', fontWeight: '600' }]}>
                  {step.order || i + 1}
                </Text>
                <Text style={[styles.tdCell, { flex: 2, fontWeight: '500' }]} numberOfLines={1}>
                  {step.title}
                </Text>
                <Text style={styles.tdCell}>{step.views.toLocaleString()}</Text>
                <Text style={styles.tdCell}>{step.completions.toLocaleString()}</Text>
                <Text style={[styles.tdCell, { color: '#6B7280' }]}>
                  {fmtSecs(step.avg_duration_seconds)}
                </Text>
                <Text style={[styles.tdCell, { color: dropColor(step.drop_rate), fontWeight: '600' }]}>
                  {step.drop_rate > 0 ? `${Math.round(step.drop_rate * 100)}%` : '—'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ── Business analytics section ────────────────────────────────────────────────

function BusinessSection({
  isAdmin,
  businesses,
  bizLoading,
  bizError,
}: {
  isAdmin: boolean;
  businesses: BusinessSummary[];
  bizLoading: boolean;
  bizError: string | null;
}) {
  if (!isAdmin) {
    // Non-admin: premium placeholder
    return (
      <View style={[styles.section, styles.premiumSection]}>
        <View style={styles.premiumHeader}>
          <Ionicons name="star-outline" size={16} color="#B45309" />
          <Text style={styles.premiumTitle}>Business Analytics</Text>
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumBadgeText}>PREMIUM</Text>
          </View>
        </View>
        <Text style={styles.premiumBody}>
          Per-business metrics (step views, link clicks, CTR, average time on step) are available to businesses with an active premium subscription.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Business Analytics</Text>

      {bizLoading ? (
        <View style={styles.chartLoader}>
          <ActivityIndicator size="large" color={AMBER} />
        </View>
      ) : bizError ? (
        <View style={styles.tableEmpty}>
          <Ionicons name="alert-circle-outline" size={24} color={RED} />
          <Text style={[styles.tableEmptyText, { color: RED }]}>{bizError}</Text>
        </View>
      ) : !businesses.length ? (
        <View style={styles.tableEmpty}>
          <Ionicons name="business-outline" size={32} color="#D1D5DB" />
          <Text style={styles.tableEmptyText}>No business data yet.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ minWidth: 680 }}>
            {/* Header */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.thText, { flex: 2, paddingLeft: 4 }]}>Business</Text>
              <Text style={styles.thText}>Step Views</Text>
              <Text style={styles.thText}>Web</Text>
              <Text style={styles.thText}>Phone</Text>
              <Text style={styles.thText}>Maps</Text>
              <Text style={styles.thText}>CTR</Text>
              <Text style={styles.thText}>Avg Time</Text>
            </View>

            {businesses.map((biz, i) => (
              <View key={biz.business_id} style={[styles.tableRow, i % 2 === 0 && styles.tableRowEven]}>
                <Text style={[styles.tdCell, { flex: 2, fontWeight: '500' }]} numberOfLines={1}>
                  {biz.name}
                </Text>
                <Text style={styles.tdCell}>{biz.step_views.toLocaleString()}</Text>
                <Text style={styles.tdCell}>{biz.website_clicks.toLocaleString()}</Text>
                <Text style={styles.tdCell}>{biz.phone_clicks.toLocaleString()}</Text>
                <Text style={styles.tdCell}>{biz.maps_clicks.toLocaleString()}</Text>
                <Text style={[styles.tdCell, { color: biz.click_through_rate >= 0.2 ? GREEN : AMBER, fontWeight: '600' }]}>
                  {Math.round(biz.click_through_rate * 100)}%
                </Text>
                <Text style={[styles.tdCell, { color: '#6B7280' }]}>
                  {fmtSecs(biz.avg_time_on_step_seconds)}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ── Main AnalyticsTab ─────────────────────────────────────────────────────────

export function AnalyticsTab() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roles?.includes('administrator') ?? false;

  const [preset, setPreset] = useState<Preset>('7d');

  // Overview data
  const [summary, setSummary]   = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Tour detail drilldown
  const [selectedTour, setSelectedTour]           = useState<TourAnalyticsDetail | null>(null);
  const [tourDetailLoading, setTourDetailLoading] = useState(false);
  const [tourDetailError, setTourDetailError]     = useState<string | null>(null);

  // Business analytics (admin only)
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [bizLoading, setBizLoading] = useState(false);
  const [bizError, setBizError]     = useState<string | null>(null);

  const { from, to } = getPresetRange(preset);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAnalyticsSummary(from, to);
      setSummary(data);
    } catch {
      setError('Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  const loadBusinesses = useCallback(async () => {
    if (!isAdmin) return;
    setBizLoading(true);
    setBizError(null);
    try {
      const data = await fetchAllBusinessAnalytics(from, to);
      setBusinesses(data);
    } catch {
      setBizError('Failed to load business data.');
    } finally {
      setBizLoading(false);
    }
  }, [from, to, isAdmin]);

  // Reload everything when preset changes; reset drilldown
  useEffect(() => {
    setSelectedTour(null);
    void loadSummary();
    void loadBusinesses();
  }, [loadSummary, loadBusinesses]);

  const handleOpenTour = async (tour: TourSummary) => {
    setTourDetailLoading(true);
    setTourDetailError(null);
    try {
      const detail = await fetchTourAnalytics(tour.tour_id, from, to);
      setSelectedTour(detail);
    } catch {
      setTourDetailError('Failed to load step data.');
    } finally {
      setTourDetailLoading(false);
    }
  };

  const handleBack = () => setSelectedTour(null);

  const site       = summary?.site;
  const tours      = summary?.tours ?? [];
  const dateSeries = summary?.date_series ?? [];
  const chartWidth = Math.min(width - (isMobile ? 48 : 80), 860);

  const presets: { key: Preset; label: string }[] = [
    { key: '7d', label: '7d' }, { key: '30d', label: '30d' }, { key: '90d', label: '90d' },
  ];

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{t('admin.tabs.analytics')}</Text>
        <View style={styles.presetRow}>
          {presets.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.presetBtn, preset === key && styles.presetBtnActive]}
              onPress={() => setPreset(key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.presetLabel, preset === key && styles.presetLabelActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => { void loadSummary(); void loadBusinesses(); }}
            style={styles.refreshBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={16} color={AMBER} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.dateRange}>{from} → {to}</Text>

      {/* ── Error banner ── */}
      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={18} color={RED} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadSummary} activeOpacity={0.8}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── OVERVIEW or DRILLDOWN ── */}
      {selectedTour ? (
        // Step drilldown
        <>
          {tourDetailError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={RED} />
              <Text style={styles.errorText}>{tourDetailError}</Text>
            </View>
          ) : null}
          <StepDrilldown detail={selectedTour} onBack={handleBack} />
        </>
      ) : (
        // Overview
        <>
          {/* Summary cards */}
          <View style={[styles.cardsRow, isMobile && styles.cardsGrid]}>
            <SummaryCard
              icon="eye-outline" iconColor={BLUE} label="Total Views"
              value={site?.total_views ?? 0}
              sub={site ? `${site.anon_views.toLocaleString()} anonymous` : undefined}
              loading={loading}
            />
            <SummaryCard
              icon="checkmark-circle-outline" iconColor={GREEN} label="Completions"
              value={tours.reduce((acc, t) => acc + t.completions, 0)}
              loading={loading}
            />
            <SummaryCard
              icon="arrow-back-circle-outline" iconColor={RED} label="Abandonments"
              value={tours.reduce((acc, t) => acc + t.abandonments, 0)}
              sub={tours.length ? `avg ${Math.round(tours.reduce((acc, t) => acc + t.avg_abandonment_pct, 0) / (tours.length || 1))}% progress` : undefined}
              loading={loading}
            />
            <SummaryCard
              icon="person-add-outline" iconColor={AMBER} label="New Registrations"
              value={site?.new_registrations ?? 0}
              sub={site ? `${site.total_searches.toLocaleString()} searches` : undefined}
              loading={loading}
            />
          </View>

          {/* Traffic chart */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Traffic over time</Text>
            {loading ? (
              <View style={styles.chartLoader}><ActivityIndicator size="large" color={AMBER} /></View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <SparklineChart data={dateSeries} width={chartWidth} />
              </ScrollView>
            )}
          </View>

          {/* Tours table */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Tour performance</Text>
              {tourDetailLoading && <ActivityIndicator size="small" color={AMBER} style={{ marginLeft: 8 }} />}
            </View>
            {tourDetailError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={RED} />
                <Text style={[styles.errorText, { fontSize: 12 }]}>{tourDetailError}</Text>
              </View>
            ) : null}
            {loading ? (
              <View style={styles.chartLoader}><ActivityIndicator size="large" color={AMBER} /></View>
            ) : (
              <ToursTable
                tours={tours}
                isMobile={isMobile}
                onOpenTour={handleOpenTour}
                tourDetailLoading={tourDetailLoading}
              />
            )}
          </View>
        </>
      )}

      {/* ── Business analytics — always visible ── */}
      <BusinessSection
        isAdmin={isAdmin}
        businesses={businesses}
        bizLoading={bizLoading}
        bizError={bizError}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    flexWrap: 'wrap',
    gap: 8,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  presetBtnActive: { backgroundColor: AMBER, borderColor: AMBER },
  presetLabel: { fontSize: 12, fontWeight: '600', color: '#374151' },
  presetLabelActive: { color: '#FFFFFF' },
  refreshBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  dateRange: { fontSize: 11, color: '#9CA3AF', marginBottom: 16 },

  // Error
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 13, color: '#DC2626' },
  retryText: { fontSize: 13, fontWeight: '600', color: AMBER },

  // Cards
  cardsRow: {
    flexDirection: 'row', gap: 12, marginBottom: 16,
  },
  cardsGrid: {
    flexWrap: 'wrap',
  },
  card: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    padding: 14, gap: 4,
  },
  cardIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  cardLabel: { fontSize: 11, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  cardValue: { fontSize: 22, fontWeight: '700', color: '#111827' },
  cardSub: { fontSize: 11, color: '#9CA3AF' },

  // Section
  section: {
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    padding: 16, marginBottom: 16,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },

  // Chart
  chartLoader: { height: 140, justifyContent: 'center', alignItems: 'center' },
  chartEmpty: { height: 140, justifyContent: 'center', alignItems: 'center' },
  chartEmptyText: { fontSize: 13, color: '#9CA3AF' },
  chartLegend: { flexDirection: 'row', gap: 14, marginBottom: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500' },

  // Table
  table: { width: '100%' },
  tableEmpty: { paddingVertical: 32, alignItems: 'center', gap: 8 },
  tableEmptyText: { fontSize: 13, color: '#9CA3AF' },
  tableHeader: { backgroundColor: '#F9FAFB', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', borderRadius: 8 },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6',
  },
  tableRowEven: { backgroundColor: '#FAFAFA' },
  thCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: 48 },
  thText: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: 0.3 },
  thTextActive: { color: AMBER },
  tdCell: { flex: 1, fontSize: 13, color: '#374151', minWidth: 48 },

  // Steps button
  stepsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB', minWidth: 64,
  },
  stepsBtnText: { fontSize: 12, fontWeight: '600', color: AMBER },

  // Drilldown
  drillHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB',
  },
  backBtnText: { fontSize: 13, fontWeight: '600', color: AMBER },
  drillTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827' },
  drillPills: { flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  drillPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  drillPillLabel: { fontSize: 12, color: '#6B7280' },
  drillPillValue: { fontSize: 15, fontWeight: '700' },

  // Business premium
  premiumSection: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  premiumHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  premiumTitle: { fontSize: 14, fontWeight: '700', color: '#B45309', flex: 1 },
  premiumBadge: { backgroundColor: AMBER, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  premiumBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  premiumBody: { fontSize: 13, color: '#78350F', lineHeight: 19 },
});
