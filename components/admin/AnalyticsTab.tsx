// components/admin/AnalyticsTab.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  Modal,
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
  type BusinessSummary,
  type DatePoint,
} from '../../services/analytics.service';

const AMBER  = '#F59E0B';
const GREEN  = '#22C55E';
const RED    = '#EF4444';
const BLUE   = '#3B82F6';
const PURPLE = '#8B5CF6';

// ── Helpers ───────────────────────────────────────────────────────────────────

export type Preset = '7d' | '30d' | '90d' | 'all';

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function getPresetRange(preset: Preset): { from: string; to: string } {
  const to   = new Date();
  const from = new Date();
  if (preset === 'all') return { from: '2020-01-01', to: formatDate(to) };
  from.setDate(from.getDate() - (preset === '7d' ? 7 : preset === '30d' ? 30 : 90) + 1);
  return { from: formatDate(from), to: formatDate(to) };
}

export function fmtSecs(s: number): string {
  if (!s || s <= 0) return '—';
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

function dropColor(rate: number): string {
  if (rate < 0.1) return GREEN;
  if (rate < 0.3) return AMBER;
  return RED;
}

// ── Column width constants ────────────────────────────────────────────────────
// Widths sized to fit the longest translated header text (Spanish) at fontSize 11
// Rule of thumb: ~7.5px per character + 8px padding + 16px if tooltip icon present

// Tour performance table
const TC = {
  tour:      { flex: 1, minWidth: 120 } as const,
  views:     { width: 72 }  as const,
  starts:    { width: 76 }  as const,
  done:      { width: 114 } as const,
  rate:      { width: 84 }  as const,
  avgTime:   { width: 124 } as const,
  abandoned: { width: 108 } as const,
  shared:    { width: 120 } as const,
  steps:     { width: 80 }  as const,
};
const TOUR_TABLE_MIN_W = 120 + 72 + 76 + 114 + 84 + 124 + 108 + 120 + 80 + 32;

// Step drilldown table — first col flex, fixed cols sized to header text
const SC = {
  order:   { width: 32 }  as const,
  step:    { flex: 1, minWidth: 80 } as const,   // flex, texto wrappea si es largo
  views:   { width: 88 }  as const,
  done:    { width: 126 } as const,
  avgTime: { width: 136 } as const,
  drop:    { width: 104 } as const,
};
const STEP_TABLE_MIN_W = 32 + 80 + 88 + 126 + 136 + 104 + 32;

// Business table — same pattern
const BC = {
  name:      { flex: 1, minWidth: 100 } as const,
  stepViews: { width: 118 } as const,
  web:       { width: 60 }  as const,
  phone:     { width: 90 }  as const,
  maps:      { width: 72 }  as const,
  ctr:       { width: 72 }  as const,
  avgTime:   { width: 136 } as const,
};
const BIZ_TABLE_MIN_W = 100 + 118 + 60 + 90 + 72 + 72 + 136 + 32;

// ── InfoTooltip — tap/click to open, tap/click outside to close ───────────────

export function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);

  return (
      <>
        <TouchableOpacity
            onPress={() => setVisible((v) => !v)}
            style={styles.tooltipTrigger}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="information-circle-outline" size={13} color="#9CA3AF" />
        </TouchableOpacity>

        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={() => setVisible(false)}
        >
          <TouchableOpacity
              style={styles.tooltipOverlay}
              onPress={() => setVisible(false)}
              activeOpacity={1}
          >
            <View style={styles.tooltipBoxModal}>
              <Text style={styles.tooltipText}>{text}</Text>
            </View>
          </TouchableOpacity>
        </Modal>
      </>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────

export function SummaryCard({
                       icon, iconColor, label, value, sub, loading, tooltip,
                     }: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: number | string;
  sub?: string;
  loading?: boolean;
  tooltip?: string;
}) {
  return (
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={[styles.cardIcon, { backgroundColor: `${iconColor}18` }]}>
            <Ionicons name={icon} size={20} color={iconColor} />
          </View>
          {tooltip ? <InfoTooltip text={tooltip} /> : null}
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

// ── Help collapsible ──────────────────────────────────────────────────────────

function HelpCollapsible() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
      <View style={styles.helpSection}>
        <TouchableOpacity style={styles.helpHeader} onPress={() => setOpen((v) => !v)} activeOpacity={0.8}>
          <View style={styles.helpHeaderLeft}>
            <Ionicons name="help-circle-outline" size={15} color="#B45309" />
            <Text style={styles.helpTitle}>{t('admin.analytics.help.title')}</Text>
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color="#B45309" />
        </TouchableOpacity>
        {open ? <Text style={styles.helpBody}>{t('admin.analytics.help.body')}</Text> : null}
      </View>
  );
}

// ── Sparkline chart ───────────────────────────────────────────────────────────

function SparklineChart({
                          data, width, noDataLabel, legendLabels,
                        }: {
  data: DatePoint[];
  width: number;
  noDataLabel: string;
  legendLabels: { views: string; completions: string; abandonments: string };
}) {
  if (!data || data.length < 2) {
    return (
        <View style={[styles.chartEmpty, { width }]}>
          <Text style={styles.chartEmptyText}>{noDataLabel}</Text>
        </View>
    );
  }

  const height    = 160;
  const padLeft   = 40;
  const padRight  = 12;
  const padTop    = 10;
  const padBottom = 20;
  const chartW    = width - padLeft - padRight;
  const chartH    = height - padTop - padBottom;
  const globalMax = Math.max(...data.map((d) => Math.max(d.views, d.completions, d.abandonments)), 1);

  const toX = (i: number) => padLeft + (i / (data.length - 1)) * chartW;
  const toY = (v: number) => padTop + chartH - (v / globalMax) * chartH;
  const pts  = (key: keyof DatePoint) =>
      data.map((d, i) => `${toX(i)},${toY(d[key] as number)}`).join(' ');

  const labelStep = Math.max(1, Math.floor(data.length / 5));
  const yTicks    = [0, 0.25, 0.5, 0.75, 1];

  const series = [
    { color: BLUE,  label: legendLabels.views,        key: 'views'        },
    { color: GREEN, label: legendLabels.completions,   key: 'completions'  },
    { color: RED,   label: legendLabels.abandonments,  key: 'abandonments' },
  ] as const;

  return (
      <View style={{ width }}>
        <View style={styles.chartLegend}>
          {series.map(({ color, label }) => (
              <View key={label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.legendLabel}>{label}</Text>
              </View>
          ))}
        </View>
        <Svg width={width} height={height}>
          {yTicks.map((pct) => {
            const y   = padTop + chartH * (1 - pct);
            const val = Math.round(globalMax * pct);
            return (
                <React.Fragment key={pct}>
                  <Line x1={padLeft} y1={y} x2={padLeft + chartW} y2={y} stroke="#F3F4F6" strokeWidth={1} />
                  <SvgText x={padLeft - 4} y={y + 4} fontSize={8} fill="#9CA3AF" textAnchor="end">
                    {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val)}
                  </SvgText>
                </React.Fragment>
            );
          })}
          {series.map(({ color, key }) => (
              <Polyline key={key} points={pts(key)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
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

// ── Column header (with optional tooltip) ────────────────────────────────────

function ColHeader<T extends string>({
                                       k, label, sortKey, sortAsc, onSort, tooltip, colStyle,
                                     }: {
  k: T;
  label: string;
  sortKey: T;
  sortAsc: boolean;
  onSort: (k: T) => void;
  tooltip?: string;
  colStyle: object;
}) {
  const active = sortKey === k;
  return (
      <TouchableOpacity
          style={[styles.thCell, colStyle]}
          onPress={() => onSort(k)}
          activeOpacity={0.7}
      >
        <Text style={[styles.thText, active && styles.thTextActive]}>{label}</Text>
        {active && <Ionicons name={sortAsc ? 'chevron-up' : 'chevron-down'} size={10} color={AMBER} />}
        {tooltip ? <InfoTooltip text={tooltip} /> : null}
      </TouchableOpacity>
  );
}

// ── Tours table ───────────────────────────────────────────────────────────────

type TourSortKey = 'views' | 'starts' | 'completions' | 'completion_rate' | 'abandonments' | 'avg_step_duration_s' | 'shares';

function ToursTable({
                      tours, onOpenTour, tourDetailLoading, containerWidth,
                    }: {
  tours: TourSummary[];
  onOpenTour: (tour: TourSummary) => void;
  tourDetailLoading: boolean;
  containerWidth: number;
}) {
  const { t } = useTranslation();
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
          <Text style={styles.tableEmptyText}>{t('admin.analytics.tourTable.noData')}</Text>
        </View>
    );
  }

  const hProps = { sortKey, sortAsc, onSort };

  return (
      <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          // @ts-ignore — className is valid on RN Web
          className="analytics-table-scroll"
          style={{ width: '100%' }}
          contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={{ minWidth: TOUR_TABLE_MIN_W }}>
          {/* Header row */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <View style={[styles.thCell, TC.tour]}>
              <Text style={styles.thText}>{t('admin.analytics.tourTable.colTour')}</Text>
            </View>
            <ColHeader k="views"               label={t('admin.analytics.tourTable.colViews')}     colStyle={TC.views}     {...hProps} />
            <ColHeader k="starts"              label={t('admin.analytics.tourTable.colStarts')}    colStyle={TC.starts}    {...hProps} />
            <ColHeader k="completions"         label={t('admin.analytics.tourTable.colDone')}      colStyle={TC.done}      {...hProps} />
            <ColHeader k="completion_rate"     label={t('admin.analytics.tourTable.colRate')}      colStyle={TC.rate}      tooltip={t('admin.analytics.tourTable.colRateTooltip')}      {...hProps} />
            <ColHeader k="avg_step_duration_s" label={t('admin.analytics.tourTable.colAvgTime')}   colStyle={TC.avgTime}   tooltip={t('admin.analytics.tourTable.colAvgTimeTooltip')}   {...hProps} />
            <ColHeader k="abandonments"        label={t('admin.analytics.tourTable.colAbandoned')} colStyle={TC.abandoned} tooltip={t('admin.analytics.tourTable.colAbandonedTooltip')} {...hProps} />
            <ColHeader k="shares"              label={t('admin.analytics.tourTable.colShared')}    colStyle={TC.shared}    tooltip={t('admin.analytics.tourTable.colSharedTooltip')}    {...hProps} />
            <View style={[styles.thCell, TC.steps]}>
              <Text style={styles.thText}>{t('admin.analytics.tourTable.colSteps')}</Text>
            </View>
          </View>

          {sorted.map((tour, i) => (
              <View key={tour.tour_id} style={[styles.tableRow, styles.tableRowTop, i % 2 === 0 && styles.tableRowEven]}>
                <Text style={[styles.tdCell, styles.tdTourTitle, TC.tour]}>{tour.title || '–'}</Text>
                <Text style={[styles.tdCell, TC.views]}>{tour.views.toLocaleString()}</Text>
                <Text style={[styles.tdCell, TC.starts]}>{tour.starts.toLocaleString()}</Text>
                <Text style={[styles.tdCell, TC.done]}>{tour.completions.toLocaleString()}</Text>
                <Text style={[styles.tdCell, TC.rate, { color: tour.completion_rate >= 0.5 ? GREEN : AMBER, fontWeight: '600' }]}>
                  {Math.min(100, Math.round(tour.completion_rate * 100))}%
                </Text>
                <Text style={[styles.tdCell, TC.avgTime, { color: '#6B7280' }]}>{fmtSecs(tour.avg_step_duration_s ?? 0)}</Text>
                <Text style={[styles.tdCell, TC.abandoned]}>{tour.abandonments.toLocaleString()}</Text>
                <Text style={[styles.tdCell, TC.shared]}>{tour.shares.toLocaleString()}</Text>
                <TouchableOpacity
                    style={[styles.stepsBtn, TC.steps]}
                    onPress={() => onOpenTour(tour)}
                    activeOpacity={0.7}
                    disabled={tourDetailLoading}
                >
                  {tourDetailLoading ? (
                      <ActivityIndicator size="small" color={AMBER} />
                  ) : (
                      <>
                        <Text style={styles.stepsBtnText}>{t('admin.analytics.tourTable.colSteps')}</Text>
                        <Ionicons name="chevron-forward" size={13} color={AMBER} />
                      </>
                  )}
                </TouchableOpacity>
              </View>
          ))}
        </View>
      </ScrollView>
  );
}

// ── Step drilldown view ───────────────────────────────────────────────────────

export function StepDrilldown({ detail, onBack, containerWidth }: { detail: TourAnalyticsDetail; onBack: () => void; containerWidth: number }) {
  const { t } = useTranslation();
  const steps = [...detail.steps].sort((a, b) => a.order - b.order);

  return (
      <View>
        <View style={styles.drillHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={16} color={AMBER} />
            <Text style={styles.backBtnText}>{t('admin.analytics.tourTable.title')}</Text>
          </TouchableOpacity>
          <Text style={styles.drillTitle}>{detail.title}</Text>
        </View>

        <View style={styles.drillPills}>
          <View style={styles.drillPill}>
            <Ionicons name="eye-outline" size={14} color={BLUE} />
            <Text style={styles.drillPillLabel}>{t('admin.analytics.drilldown.views')}</Text>
            <Text style={[styles.drillPillValue, { color: BLUE }]}>{detail.views.toLocaleString()}</Text>
          </View>
          <View style={styles.drillPill}>
            <Ionicons name="checkmark-circle-outline" size={14} color={GREEN} />
            <Text style={styles.drillPillLabel}>{t('admin.analytics.drilldown.rate')}</Text>
            <Text style={[styles.drillPillValue, { color: GREEN }]}>
              {Math.min(100, Math.round(detail.completion_rate * 100))}%
            </Text>
          </View>
          <View style={styles.drillPill}>
            <Ionicons name="arrow-back-circle-outline" size={14} color={RED} />
            <View style={styles.drillPillLabelRow}>
              <Text style={styles.drillPillLabel}>{t('admin.analytics.drilldown.avgDrop')}</Text>
              <InfoTooltip text={t('admin.analytics.drilldown.avgDropTooltip')} />
            </View>
            <Text style={[styles.drillPillValue, { color: RED }]}>{Math.round(detail.avg_abandonment_pct)}%</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.analytics.stepTable.title')}</Text>
          {!steps.length ? (
              <View style={styles.tableEmpty}>
                <Ionicons name="footsteps-outline" size={32} color="#D1D5DB" />
                <Text style={styles.tableEmptyText}>{t('admin.analytics.stepTable.noData')}</Text>
              </View>
          ) : (
              <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator
                  // @ts-ignore — className is valid on RN Web
                  className="analytics-table-scroll"
                  style={{ width: '100%' }}
                  contentContainerStyle={{ flexGrow: 1 }}
              >
                <View style={{ width: Math.max(containerWidth, STEP_TABLE_MIN_W), flex: 1 }}>
                  <View style={[styles.tableRow, styles.tableHeader]}>
                    <Text style={[styles.thText, SC.order]}>{t('admin.analytics.stepTable.colOrder')}</Text>
                    <Text style={[styles.thText, SC.step, { paddingLeft: 4 }]}>{t('admin.analytics.stepTable.colStep')}</Text>
                    <View style={[styles.thCell, SC.views]}>
                      <Text style={styles.thText}>{t('admin.analytics.stepTable.colViews')}</Text>
                      <InfoTooltip text={t('admin.analytics.stepTable.colViewsTooltip')} />
                    </View>
                    <View style={[styles.thCell, SC.done]}>
                      <Text style={styles.thText}>{t('admin.analytics.stepTable.colDone')}</Text>
                      <InfoTooltip text={t('admin.analytics.stepTable.colDoneTooltip')} />
                    </View>
                    <View style={[styles.thCell, SC.avgTime]}>
                      <Text style={styles.thText}>{t('admin.analytics.stepTable.colAvgTime')}</Text>
                      <InfoTooltip text={t('admin.analytics.stepTable.colAvgTimeTooltip')} />
                    </View>
                    <View style={[styles.thCell, SC.drop]}>
                      <Text style={styles.thText}>{t('admin.analytics.stepTable.colDrop')}</Text>
                      <InfoTooltip text={t('admin.analytics.stepTable.colDropTooltip')} />
                    </View>
                  </View>

                  {steps.map((step, i) => (
                      <View key={step.step_id} style={[styles.tableRow, styles.tableRowTop, i % 2 === 0 && styles.tableRowEven]}>
                        <Text style={[styles.tdCell, SC.order, { color: '#9CA3AF', fontWeight: '600' }]}>{step.order || i + 1}</Text>
                        <Text style={[styles.tdCell, SC.step, { fontWeight: '500' }]} numberOfLines={2}>{step.title}</Text>
                        <Text style={[styles.tdCell, SC.views]}>{step.views.toLocaleString()}</Text>
                        <Text style={[styles.tdCell, SC.done]}>{step.completions.toLocaleString()}</Text>
                        <Text style={[styles.tdCell, SC.avgTime, { color: '#6B7280' }]}>{fmtSecs(step.avg_duration_seconds)}</Text>
                        <Text style={[styles.tdCell, SC.drop, { color: dropColor(step.drop_rate), fontWeight: '600' }]}>
                          {step.drop_rate > 0 ? `${Math.min(100, Math.round(step.drop_rate * 100))}%` : '—'}
                        </Text>
                      </View>
                  ))}
                </View>
              </ScrollView>
          )}
        </View>
      </View>
  );
}

// ── Business analytics section ────────────────────────────────────────────────

function BusinessSection({
                           isAdmin, businesses, bizLoading, bizError, containerWidth,
                         }: {
  isAdmin: boolean;
  businesses: BusinessSummary[];
  bizLoading: boolean;
  bizError: string | null;
  containerWidth: number;
}) {
  const { t } = useTranslation();

  if (!isAdmin) {
    return (
        <View style={[styles.section, styles.premiumSection]}>
          <View style={styles.premiumHeader}>
            <Ionicons name="star-outline" size={16} color="#B45309" />
            <Text style={styles.premiumTitle}>{t('admin.analytics.business.premiumTitle')}</Text>
            <View style={styles.premiumBadge}><Text style={styles.premiumBadgeText}>PREMIUM</Text></View>
          </View>
          <Text style={styles.premiumBody}>{t('admin.analytics.business.premiumBody')}</Text>
        </View>
    );
  }

  return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('admin.analytics.business.title')}</Text>
        {bizLoading ? (
            <View style={styles.chartLoader}><ActivityIndicator size="large" color={AMBER} /></View>
        ) : bizError ? (
            <View style={styles.tableEmpty}>
              <Ionicons name="alert-circle-outline" size={24} color={RED} />
              <Text style={[styles.tableEmptyText, { color: RED }]}>{bizError}</Text>
            </View>
        ) : !businesses.length ? (
            <View style={styles.tableEmpty}>
              <Ionicons name="business-outline" size={32} color="#D1D5DB" />
              <Text style={styles.tableEmptyText}>{t('admin.analytics.business.noData')}</Text>
            </View>
        ) : (
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                // @ts-ignore — className is valid on RN Web
                className="analytics-table-scroll"
                style={{ width: '100%' }}
                contentContainerStyle={{ flexGrow: 1 }}
            >
              <View style={{ width: Math.max(containerWidth, BIZ_TABLE_MIN_W), flex: 1 }}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.thText, BC.name]}>{t('admin.analytics.business.colBusiness')}</Text>
                  <View style={[styles.thCell, BC.stepViews]}>
                    <Text style={styles.thText}>{t('admin.analytics.business.colStepViews')}</Text>
                    <InfoTooltip text={t('admin.analytics.business.colStepViewsTooltip')} />
                  </View>
                  <Text style={[styles.thText, BC.web]}>{t('admin.analytics.business.colWeb')}</Text>
                  <Text style={[styles.thText, BC.phone]}>{t('admin.analytics.business.colPhone')}</Text>
                  <Text style={[styles.thText, BC.maps]}>{t('admin.analytics.business.colMaps')}</Text>
                  <View style={[styles.thCell, BC.ctr]}>
                    <Text style={styles.thText}>{t('admin.analytics.business.colCTR')}</Text>
                    <InfoTooltip text={t('admin.analytics.business.colCTRTooltip')} />
                  </View>
                  <View style={[styles.thCell, BC.avgTime]}>
                    <Text style={styles.thText}>{t('admin.analytics.business.colAvgTime')}</Text>
                    <InfoTooltip text={t('admin.analytics.business.colAvgTimeTooltip')} />
                  </View>
                </View>
                {businesses.map((biz, i) => (
                    <View key={biz.business_id} style={[styles.tableRow, i % 2 === 0 && styles.tableRowEven]}>
                      <Text style={[styles.tdCell, BC.name, { fontWeight: '500' }]} numberOfLines={2}>{biz.name}</Text>
                      <Text style={[styles.tdCell, BC.stepViews]}>{biz.step_views.toLocaleString()}</Text>
                      <Text style={[styles.tdCell, BC.web]}>{biz.website_clicks.toLocaleString()}</Text>
                      <Text style={[styles.tdCell, BC.phone]}>{biz.phone_clicks.toLocaleString()}</Text>
                      <Text style={[styles.tdCell, BC.maps]}>{biz.maps_clicks.toLocaleString()}</Text>
                      <Text style={[styles.tdCell, BC.ctr, { color: biz.click_through_rate >= 0.2 ? GREEN : AMBER, fontWeight: '600' }]}>
                        {Math.round(biz.click_through_rate * 100)}%
                      </Text>
                      <Text style={[styles.tdCell, BC.avgTime, { color: '#6B7280' }]}>{fmtSecs(biz.avg_time_on_step_seconds)}</Text>
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
  const { t, i18n } = useTranslation();
  const { width }   = useWindowDimensions();
  const isMobile    = width < 768;
  const user        = useAuthStore((s) => s.user);
  const isAdmin     = user?.roles?.includes('administrator') ?? false;
  const langcode    = i18n.language;

  const [preset, setPreset] = useState<Preset>('all');

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [selectedTour, setSelectedTour]           = useState<TourAnalyticsDetail | null>(null);
  const [tourDetailLoading, setTourDetailLoading] = useState(false);
  const [tourDetailError, setTourDetailError]     = useState<string | null>(null);

  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [bizLoading, setBizLoading] = useState(false);
  const [bizError, setBizError]     = useState<string | null>(null);

  const { from, to } = getPresetRange(preset);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAnalyticsSummary(from, to, undefined, langcode);
      setSummary(data);
    } catch {
      setError('Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  }, [from, to, langcode]);

  const loadBusinesses = useCallback(async () => {
    if (!isAdmin) return;
    setBizLoading(true);
    setBizError(null);
    try {
      const data = await fetchAllBusinessAnalytics(from, to, langcode);
      setBusinesses(data);
    } catch {
      setBizError('Failed to load business data.');
    } finally {
      setBizLoading(false);
    }
  }, [from, to, isAdmin, langcode]);

  useEffect(() => {
    setSelectedTour(null);
    void loadSummary();
    void loadBusinesses();
  }, [loadSummary, loadBusinesses]);

  const handleOpenTour = async (tour: TourSummary) => {
    setTourDetailLoading(true);
    setTourDetailError(null);
    try {
      const detail = await fetchTourAnalytics(tour.tour_id, from, to, langcode);
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
  const chartWidth = isMobile
      ? width - 48
      : width * 0.9 - 80;
  // Width available inside a section card: container 90% - outer padding 80 - card padding 32
  const sectionInnerWidth = isMobile
      ? width - 48 - 32
      : width * 0.9 - 80 - 32;

  const presets: { key: Preset; label: string }[] = [
    { key: '7d',  label: t('admin.analytics.preset.7d')  },
    { key: '30d', label: t('admin.analytics.preset.30d') },
    { key: '90d', label: t('admin.analytics.preset.90d') },
    { key: 'all', label: t('admin.analytics.preset.all') },
  ];

  return (
      // @ts-ignore — className valid on RN Web
      <View style={styles.container} className={!isMobile ? 'analytics-container-desktop' : undefined}>
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

        {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={RED} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={loadSummary} activeOpacity={0.8}>
                <Text style={styles.retryText}>{t('common.retry')}</Text>
              </TouchableOpacity>
            </View>
        ) : null}

        {selectedTour ? (
            <>
              {tourDetailError ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle-outline" size={18} color={RED} />
                    <Text style={styles.errorText}>{tourDetailError}</Text>
                  </View>
              ) : null}
              <StepDrilldown detail={selectedTour} onBack={handleBack} containerWidth={sectionInnerWidth} />
            </>
        ) : (
            <>
              <HelpCollapsible />

              {/* Summary cards */}
              <View style={[styles.cardsRow, isMobile && styles.cardsGrid]}>
                <SummaryCard
                    icon="eye-outline" iconColor={BLUE}
                    label={t('admin.analytics.cards.totalViews')}
                    tooltip={t('admin.analytics.cards.totalViewsTooltip')}
                    value={site?.total_views ?? 0}
                    sub={site ? t('admin.analytics.cards.anonSub', { n: site.anon_views.toLocaleString() }) : undefined}
                    loading={loading}
                />
                <SummaryCard
                    icon="checkmark-circle-outline" iconColor={GREEN}
                    label={t('admin.analytics.cards.completions')}
                    tooltip={t('admin.analytics.cards.completionsTooltip')}
                    value={tours.reduce((acc, tour) => acc + tour.completions, 0)}
                    loading={loading}
                />
                <SummaryCard
                    icon="arrow-back-circle-outline" iconColor={RED}
                    label={t('admin.analytics.cards.abandonments')}
                    tooltip={t('admin.analytics.cards.abandonmentsTooltip')}
                    value={tours.reduce((acc, tour) => acc + tour.abandonments, 0)}
                    sub={tours.length
                        ? t('admin.analytics.cards.avgProgressSub', {
                          pct: Math.round(tours.reduce((acc, tour) => acc + tour.avg_abandonment_pct, 0) / tours.length),
                        })
                        : undefined}
                    loading={loading}
                />
                <SummaryCard
                    icon="person-add-outline" iconColor={AMBER}
                    label={t('admin.analytics.cards.newRegistrations')}
                    tooltip={t('admin.analytics.cards.newRegistrationsTooltip')}
                    value={site?.new_registrations ?? 0}
                    sub={site ? t('admin.analytics.cards.searchesSub', { n: site.total_searches.toLocaleString() }) : undefined}
                    loading={loading}
                />
                <SummaryCard
                    icon="people-outline" iconColor={PURPLE}
                    label={t('admin.analytics.cards.totalUsers')}
                    tooltip={t('admin.analytics.cards.totalUsersTooltip')}
                    value={site?.total_users ?? 0}
                    loading={loading}
                />
              </View>

              {/* Traffic chart */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('admin.analytics.chart.title')}</Text>
                {loading ? (
                    <View style={styles.chartLoader}><ActivityIndicator size="large" color={AMBER} /></View>
                ) : (
                    <SparklineChart
                        data={dateSeries}
                        width={chartWidth}
                        noDataLabel={t('admin.analytics.chart.noData')}
                        legendLabels={{
                          views:        t('admin.analytics.chart.legendViews'),
                          completions:  t('admin.analytics.chart.legendCompletions'),
                          abandonments: t('admin.analytics.chart.legendAbandonments'),
                        }}
                    />
                )}
              </View>

              {/* Tours table */}
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>{t('admin.analytics.tourTable.title')}</Text>
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
                        onOpenTour={handleOpenTour}
                        tourDetailLoading={tourDetailLoading}
                        containerWidth={sectionInnerWidth}
                    />
                )}
              </View>
            </>
        )}

        <BusinessSection
            isAdmin={isAdmin}
            businesses={businesses}
            bizLoading={bizLoading}
            bizError={bizError}
            containerWidth={sectionInnerWidth}
        />
      </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { paddingBottom: 32, width: '100%' },

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
  presetBtnActive: { backgroundColor: AMBER, borderColor: AMBER },
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
  retryText: { fontSize: 13, fontWeight: '600', color: AMBER },

  // Help
  helpSection: {
    backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1,
    borderRadius: 12, padding: 14, marginBottom: 16,
  },
  helpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  helpHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  helpTitle: { fontSize: 13, fontWeight: '700', color: '#B45309' },
  helpBody: { fontSize: 12, color: '#78350F', lineHeight: 18, marginTop: 8 },

  // Tooltip
  tooltipTrigger: { padding: 2 },
  tooltipOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  tooltipBoxModal: {
    maxWidth: 280, backgroundColor: '#1F2937', borderRadius: 10,
    padding: 14, marginHorizontal: 24,
  },
  tooltipText: { color: '#F9FAFB', fontSize: 13, lineHeight: 19 },

  // Cards
  cardsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  cardsGrid: { flexWrap: 'wrap' },
  card: {
    flex: 1, minWidth: 130, backgroundColor: '#FFFFFF',
    borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, gap: 4,
  },
  cardTopRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 4,
  },
  cardIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardLabel: {
    fontSize: 11, fontWeight: '600', color: '#6B7280',
    textTransform: 'uppercase' as const, letterSpacing: 0.5,
  },
  cardValue: { fontSize: 22, fontWeight: '700', color: '#111827' },
  cardSub: { fontSize: 11, color: '#9CA3AF' },

  // Section
  section: {
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1,
    borderColor: '#E5E7EB', padding: 16, marginBottom: 16,
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
  tableRowTop: { alignItems: 'flex-start' },
  tableRowEven: { backgroundColor: '#FAFAFA' },
  thCell: { flexDirection: 'row', alignItems: 'flex-start', gap: 3, paddingRight: 4, flexWrap: 'wrap' },
  thText: {
    fontSize: 11, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase' as const, letterSpacing: 0.3,
  },
  thTextActive: { color: AMBER },
  tdCell: { fontSize: 13, color: '#374151', paddingRight: 4 },
  tdTourTitle: { fontWeight: '500' },

  // Steps button
  stepsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB',
  },
  stepsBtnText: { fontSize: 12, fontWeight: '600', color: AMBER },

  // Drilldown
  drillHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
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
  drillPillLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
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