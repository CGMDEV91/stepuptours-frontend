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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Svg, Polyline, Line, Text as SvgText, Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import {
  fetchAnalyticsSummary,
  type AnalyticsSummary,
  type TourSummary,
  type DatePoint,
} from '../../services/analytics.service';

const AMBER  = '#F59E0B';
const GREEN  = '#22C55E';
const RED    = '#EF4444';
const BLUE   = '#3B82F6';
const GREY   = '#E5E7EB';

// ── Date range helpers ────────────────────────────────────────────────────────

type Preset = '7d' | '30d' | '90d';

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getPresetRange(preset: Preset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  from.setDate(from.getDate() - days + 1);
  return { from: formatDate(from), to: formatDate(to) };
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface SummaryCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: number | string;
  sub?: string;
  loading?: boolean;
}

function SummaryCard({ icon, iconColor, label, value, sub, loading }: SummaryCardProps) {
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
          <Text style={styles.cardValue}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
          {sub ? <Text style={styles.cardSub}>{sub}</Text> : null}
        </>
      )}
    </View>
  );
}

// ── Sparkline chart ───────────────────────────────────────────────────────────

interface SparklineChartProps {
  data: DatePoint[];
  width: number;
}

function SparklineChart({ data, width }: SparklineChartProps) {
  if (!data || data.length < 2) {
    return (
      <View style={[styles.chartEmpty, { width }]}>
        <Text style={styles.chartEmptyText}>Not enough data</Text>
      </View>
    );
  }

  const height = 140;
  const paddingX = 10;
  const paddingY = 20;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  const maxViews       = Math.max(...data.map((d) => d.views), 1);
  const maxCompletions = Math.max(...data.map((d) => d.completions), 1);
  const maxAbandon     = Math.max(...data.map((d) => d.abandonments), 1);
  const globalMax      = Math.max(maxViews, maxCompletions, maxAbandon, 1);

  const toX = (i: number) => paddingX + (i / (data.length - 1)) * chartW;
  const toY = (v: number) => paddingY + chartH - (v / globalMax) * chartH;

  const toPoints = (key: keyof DatePoint) =>
    data.map((d, i) => `${toX(i)},${toY(d[key] as number)}`).join(' ');

  // Show only a few date labels to avoid crowding
  const labelStep = Math.max(1, Math.floor(data.length / 4));

  return (
    <View style={{ width }}>
      {/* Legend */}
      <View style={styles.chartLegend}>
        {[
          { color: BLUE,  label: 'Views' },
          { color: GREEN, label: 'Completions' },
          { color: RED,   label: 'Abandonments' },
        ].map(({ color, label }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <Svg width={width} height={height}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = paddingY + chartH * (1 - pct);
          return (
            <Line
              key={pct}
              x1={paddingX}
              y1={y}
              x2={paddingX + chartW}
              y2={y}
              stroke="#F3F4F6"
              strokeWidth={1}
            />
          );
        })}

        {/* Lines */}
        <Polyline points={toPoints('views')}       fill="none" stroke={BLUE}  strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <Polyline points={toPoints('completions')} fill="none" stroke={GREEN} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <Polyline points={toPoints('abandonments')}fill="none" stroke={RED}   strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* Dots at first and last */}
        {[0, data.length - 1].map((i) => (
          <React.Fragment key={i}>
            <Circle cx={toX(i)} cy={toY(data[i].views)}        r={3} fill={BLUE}  />
            <Circle cx={toX(i)} cy={toY(data[i].completions)}  r={3} fill={GREEN} />
            <Circle cx={toX(i)} cy={toY(data[i].abandonments)} r={3} fill={RED}   />
          </React.Fragment>
        ))}

        {/* Date labels */}
        {data.map((d, i) => {
          if (i % labelStep !== 0 && i !== data.length - 1) return null;
          return (
            <SvgText
              key={i}
              x={toX(i)}
              y={height - 2}
              fontSize={9}
              fill="#9CA3AF"
              textAnchor="middle"
            >
              {d.date.slice(5)} {/* MM-DD */}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

// ── Top tours table ───────────────────────────────────────────────────────────

type SortKey = 'views' | 'completions' | 'completion_rate' | 'abandonments' | 'shares';

interface TopToursTableProps {
  tours: TourSummary[];
}

function TopToursTable({ tours }: TopToursTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('views');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...tours].sort((a, b) => {
    const delta = (a[sortKey] as number) - (b[sortKey] as number);
    return sortAsc ? delta : -delta;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const ColHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <TouchableOpacity
      style={styles.thCell}
      onPress={() => toggleSort(k)}
      activeOpacity={0.7}
    >
      <Text style={styles.thText}>{label}</Text>
      {sortKey === k && (
        <Ionicons
          name={sortAsc ? 'chevron-up' : 'chevron-down'}
          size={10}
          color="#9CA3AF"
        />
      )}
    </TouchableOpacity>
  );

  if (!sorted.length) {
    return (
      <View style={styles.tableEmpty}>
        <Text style={styles.tableEmptyText}>No tour data available yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.table}>
      {/* Header */}
      <View style={[styles.tableRow, styles.tableHeader]}>
        <Text style={[styles.thText, { flex: 2 }]}>Tour</Text>
        <ColHeader k="views"           label="Views" />
        <ColHeader k="completions"     label="Done" />
        <ColHeader k="completion_rate" label="Rate" />
        <ColHeader k="abandonments"    label="Drop" />
        <ColHeader k="shares"          label="Share" />
      </View>

      {sorted.map((tour, i) => (
        <View
          key={tour.tour_id}
          style={[styles.tableRow, i % 2 === 0 && styles.tableRowEven]}
        >
          <Text style={[styles.tdCell, { flex: 2 }]} numberOfLines={1}>
            {tour.title}
          </Text>
          <Text style={styles.tdCell}>{tour.views.toLocaleString()}</Text>
          <Text style={styles.tdCell}>{tour.completions.toLocaleString()}</Text>
          <Text style={[styles.tdCell, { color: tour.completion_rate >= 0.5 ? GREEN : AMBER }]}>
            {Math.round(tour.completion_rate * 100)}%
          </Text>
          <Text style={styles.tdCell}>{tour.abandonments.toLocaleString()}</Text>
          <Text style={styles.tdCell}>{tour.shares.toLocaleString()}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Main AnalyticsTab ─────────────────────────────────────────────────────────

export function AnalyticsTab() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [preset, setPreset]               = useState<Preset>('30d');
  const [summary, setSummary]             = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const { from, to } = getPresetRange(preset);

  const load = useCallback(async () => {
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

  useEffect(() => { void load(); }, [load]);

  const site = summary?.site;
  const tours = summary?.tours ?? [];
  const dateSeries = summary?.date_series ?? [];

  // Chart width: account for padding
  const chartWidth = Math.min(width - 64, 860);

  const presets: { key: Preset; label: string }[] = [
    { key: '7d',  label: '7d' },
    { key: '30d', label: '30d' },
    { key: '90d', label: '90d' },
  ];

  return (
    <View style={styles.container}>
      {/* Header row */}
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
              <Text style={[styles.presetLabel, preset === key && styles.presetLabelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={load} style={styles.refreshBtn} activeOpacity={0.8}>
            <Ionicons name="refresh-outline" size={16} color={AMBER} />
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
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Summary cards */}
      <View style={[styles.cardsRow, isMobile && styles.cardsCol]}>
        <SummaryCard
          icon="eye-outline"
          iconColor={BLUE}
          label="Total Views"
          value={site?.total_views ?? 0}
          sub={site ? `${site.anon_views.toLocaleString()} anonymous` : undefined}
          loading={loading}
        />
        <SummaryCard
          icon="checkmark-circle-outline"
          iconColor={GREEN}
          label="Completions"
          value={tours.reduce((acc, t) => acc + t.completions, 0)}
          loading={loading}
        />
        <SummaryCard
          icon="arrow-back-circle-outline"
          iconColor={RED}
          label="Abandonments"
          value={tours.reduce((acc, t) => acc + t.abandonments, 0)}
          sub={
            tours.length
              ? `avg ${Math.round(
                  tours.reduce((acc, t) => acc + t.avg_abandonment_pct, 0) / (tours.length || 1)
                )}% progress`
              : undefined
          }
          loading={loading}
        />
        <SummaryCard
          icon="person-add-outline"
          iconColor={AMBER}
          label="New Registrations"
          value={site?.new_registrations ?? 0}
          sub={site ? `${site.total_searches.toLocaleString()} searches` : undefined}
          loading={loading}
        />
      </View>

      {/* Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Traffic over time</Text>
        {loading ? (
          <View style={styles.chartLoader}>
            <ActivityIndicator size="large" color={AMBER} />
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <SparklineChart data={dateSeries} width={chartWidth} />
          </ScrollView>
        )}
      </View>

      {/* Top tours table */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tour performance</Text>
        {loading ? (
          <View style={styles.chartLoader}>
            <ActivityIndicator size="large" color={AMBER} />
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TopToursTable tours={tours} />
          </ScrollView>
        )}
      </View>

      {/* Business metrics placeholder */}
      <View style={[styles.section, styles.premiumSection]}>
        <View style={styles.premiumHeader}>
          <Ionicons name="star-outline" size={16} color="#B45309" />
          <Text style={styles.premiumTitle}>Business Analytics</Text>
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumBadgeText}>PREMIUM</Text>
          </View>
        </View>
        <Text style={styles.premiumBody}>
          Per-business metrics (step views, link clicks, CTR, average time on step) are available to businesses with an active premium subscription. They can access their own dashboard from the business management page.
        </Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32,
  },
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
  presetBtnActive: {
    backgroundColor: AMBER,
    borderColor: AMBER,
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  presetLabelActive: {
    color: '#FFFFFF',
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateRange: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
    color: AMBER,
  },

  // Summary cards
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  cardsCol: {
    flexDirection: 'column',
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 4,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  cardSub: {
    fontSize: 11,
    color: '#9CA3AF',
  },

  // Chart
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  chartLoader: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartEmpty: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartEmptyText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  chartLegend: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Table
  table: {
    minWidth: 600,
  },
  tableEmpty: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  tableEmptyText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  tableHeader: {
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  tableRowEven: {
    backgroundColor: '#FAFAFA',
  },
  thCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minWidth: 56,
  },
  thText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  tdCell: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    minWidth: 56,
  },

  // Premium section
  premiumSection: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  premiumTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B45309',
    flex: 1,
  },
  premiumBadge: {
    backgroundColor: '#F59E0B',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  premiumBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  premiumBody: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 19,
  },
});
