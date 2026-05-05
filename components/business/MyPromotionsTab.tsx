// components/business/MyPromotionsTab.tsx

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  Modal,
  Pressable,
  ScrollView,
  Switch,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  getPromotionsByUser,
  removePromotion,
  setSlotAutoRenewal,
} from '../../services/business-promotion.service';
import type { BusinessPromotion, PromotionStatus, PromotionTargetType } from '../../types';

const GREEN = '#10B981';
const GREEN_DARK = '#059669';

interface MyPromotionsTabProps {
  userId: string;
  businessId?: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function StatusBadge({ status }: { status: PromotionStatus }) {
  const { t } = useTranslation();
  const config: Record<PromotionStatus, { bg: string; text: string; labelKey: string }> = {
    active:  { bg: '#D1FAE5', text: '#065F46', labelKey: 'business.myPromotions.statusActive' },
    trial:   { bg: '#FEF3C7', text: '#92400E', labelKey: 'business.myPromotions.statusTrial' },
    expired: { bg: '#F3F4F6', text: '#6B7280', labelKey: 'business.myPromotions.statusExpired' },
  };
  const c = config[status] ?? config.expired;
  return (
    <View style={{ backgroundColor: c.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: c.text }}>{t(c.labelKey)}</Text>
    </View>
  );
}

function TypeBadge({ type }: { type: PromotionTargetType }) {
  const { t } = useTranslation();
  const isTour = type === 'tour_detail';
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: isTour ? '#EFF6FF' : '#F0FDF4',
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
    }}>
      <Ionicons
        name={isTour ? 'map-outline' : 'location-outline'}
        size={11}
        color={isTour ? '#1D4ED8' : GREEN_DARK}
      />
      <Text style={{ fontSize: 11, fontWeight: '600', color: isTour ? '#1D4ED8' : GREEN_DARK }}>
        {isTour ? t('business.myPromotions.typeTour') : t('business.myPromotions.typeStep')}
      </Text>
    </View>
  );
}

function PlanBadge({ planType }: { planType: string | null }) {
  const { t } = useTranslation();
  if (!planType) return null;
  const isAnnual = planType === 'business_annual';
  return (
    <View style={{
      backgroundColor: isAnnual ? '#EDE9FE' : '#E0F2FE',
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
    }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: isAnnual ? '#5B21B6' : '#0369A1' }}>
        {isAnnual ? t('business.myPromotions.planAnnual') : t('business.myPromotions.planMonthly')}
      </Text>
    </View>
  );
}

interface CancelModalProps {
  visible: boolean;
  promotion: BusinessPromotion | null;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function CancelModal({ visible, promotion, onConfirm, onCancel, loading }: CancelModalProps) {
  const { t } = useTranslation();
  const hasSubscription = !!promotion?.subscriptionId;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.modalBox} onPress={() => {}}>
          <View style={styles.modalIconRow}>
            <View style={styles.modalIconBg}>
              <Ionicons name="close-circle-outline" size={24} color="#EF4444" />
            </View>
          </View>
          <Text style={styles.modalTitle}>{t('business.myPromotions.cancelModalTitle')}</Text>
          <Text style={styles.modalBody}>
            {t('business.myPromotions.cancelModalBody', { name: promotion?.targetName ?? '' })}
            {'\n'}
            {hasSubscription
              ? t('business.myPromotions.cancelModalBodySub')
              : t('business.myPromotions.cancelModalBodyNoSub')}
          </Text>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalBtnCancel} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.modalBtnCancelText}>{t('business.myPromotions.cancelModalKeep')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtnDelete, loading && { opacity: 0.6 }]}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.modalBtnDeleteText}>{t('business.myPromotions.cancelModalConfirm')}</Text>
              }
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function MyPromotionsTab({ userId, businessId }: MyPromotionsTabProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [promotions, setPromotions]     = useState<BusinessPromotion[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | PromotionStatus>('all');
  const [cancelTarget, setCancelTarget] = useState<BusinessPromotion | null>(null);
  const [cancelling, setCancelling]     = useState(false);
  const [renewalLoading, setRenewalLoading] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await getPromotionsByUser(userId);
      const filtered = businessId ? all.filter((p) => p.businessId === businessId) : all;
      setPromotions(filtered);
    } catch {
      setError(t('business.myPromotions.loadError'));
    } finally {
      setLoading(false);
    }
  }, [userId, businessId, t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await removePromotion(cancelTarget.id);
      setPromotions((prev) => prev.filter((p) => p.id !== cancelTarget.id));
      setCancelTarget(null);
    } catch {
      setError(t('business.myPromotions.cancelError'));
    } finally {
      setCancelling(false);
    }
  };

  const handleToggleRenewal = async (p: BusinessPromotion, value: boolean) => {
    setRenewalLoading((prev) => ({ ...prev, [p.id]: true }));
    try {
      await setSlotAutoRenewal(p.id, value);
      setPromotions((prev) =>
        prev.map((promo) =>
          promo.id === p.id ? { ...promo, subscriptionAutoRenewal: value } : promo
        )
      );
    } catch {
      setError(t('business.myPromotions.renewalError'));
    } finally {
      setRenewalLoading((prev) => ({ ...prev, [p.id]: false }));
    }
  };

  const displayed = promotions.filter(
    (p) => filterStatus === 'all' || p.status === filterStatus,
  );

  const filterLabels: Record<string, string> = {
    all:     t('business.myPromotions.filterAll'),
    active:  t('business.myPromotions.filterActive'),
    trial:   t('business.myPromotions.filterTrial'),
    expired: t('business.myPromotions.filterExpired'),
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.heading}>{t('business.myPromotions.title')}</Text>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {(['all', 'active', 'trial', 'expired'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, filterStatus === s && styles.filterChipActive]}
            onPress={() => setFilterStatus(s)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterChipText, filterStatus === s && styles.filterChipTextActive]}>
              {filterLabels[s]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {displayed.length === 0 && (
        <View style={styles.emptyBox}>
          <Ionicons name="megaphone-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>{t('business.myPromotions.emptyTitle')}</Text>
          <Text style={styles.emptySubtitle}>{t('business.myPromotions.emptySubtitle')}</Text>
        </View>
      )}

      {isDesktop ? (
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            {[
              t('business.myPromotions.colName'),
              t('business.myPromotions.colType'),
              t('business.myPromotions.colStart'),
              t('business.myPromotions.colStatus'),
              t('business.myPromotions.colPlan'),
              t('business.myPromotions.colExpiry'),
              t('business.myPromotions.colAutoRenewal'),
              '',
            ].map((h, i) => (
              <Text key={i} style={styles.tableHeaderCell}>{h}</Text>
            ))}
          </View>
          {displayed.map((p) => {
            const canRenew = p.status === 'active' && !!p.subscriptionId;
            const renewBusy = !!renewalLoading[p.id];
            return (
              <View key={p.id} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{p.targetName}</Text>
                <View style={[styles.tableCell, { flex: 1 }]}>
                  <TypeBadge type={p.targetType} />
                </View>
                <Text style={[styles.tableCell, { flex: 1.2, color: '#6B7280' }]}>{formatDate(p.startDate)}</Text>
                <View style={[styles.tableCell, { flex: 1 }]}>
                  <StatusBadge status={p.status} />
                </View>
                <View style={[styles.tableCell, { flex: 1 }]}>
                  <PlanBadge planType={p.subscriptionPlanType} />
                </View>
                <Text style={[styles.tableCell, { flex: 1.2, color: '#6B7280' }]}>
                  {p.subscriptionEndDate ? formatDate(p.subscriptionEndDate) : (p.expiryDate ? formatDate(p.expiryDate) : '—')}
                </Text>
                <View style={[styles.tableCell, { flex: 1.2 }]}>
                  {canRenew ? (
                    renewBusy ? (
                      <ActivityIndicator size="small" color={GREEN} />
                    ) : (
                      <Switch
                        value={p.subscriptionAutoRenewal ?? false}
                        onValueChange={(val) => handleToggleRenewal(p, val)}
                        trackColor={{ false: '#E5E7EB', true: GREEN }}
                        thumbColor="#FFFFFF"
                      />
                    )
                  ) : (
                    <Text style={{ fontSize: 12, color: '#9CA3AF' }}>—</Text>
                  )}
                </View>
                <View style={[styles.tableCell, { flex: 1 }]}>
                  {p.status !== 'expired' && (
                    <TouchableOpacity
                      onPress={() => setCancelTarget(p)}
                      style={styles.cancelBtn}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.cancelBtnText}>{t('business.myPromotions.cancel')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {displayed.map((p) => {
            const canRenew = p.status === 'active' && !!p.subscriptionId;
            const renewBusy = !!renewalLoading[p.id];
            return (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardName} numberOfLines={1}>{p.targetName}</Text>
                  <StatusBadge status={p.status} />
                </View>
                <View style={styles.cardMetaRow}>
                  <TypeBadge type={p.targetType} />
                  {p.subscriptionPlanType && <PlanBadge planType={p.subscriptionPlanType} />}
                  <Text style={styles.cardMeta}>{t('business.myPromotions.dateFrom')} {formatDate(p.startDate)}</Text>
                </View>

                <View style={styles.cardMetaRow}>
                  {p.subscriptionEndDate ? (
                    <Text style={styles.cardMeta}>{t('business.myPromotions.dateExpiry')} {formatDate(p.subscriptionEndDate)}</Text>
                  ) : p.expiryDate ? (
                    <Text style={styles.cardMeta}>{t('business.myPromotions.dateTrial')} {formatDate(p.expiryDate)}</Text>
                  ) : null}
                </View>

                {canRenew && (
                  <View style={styles.renewalRow}>
                    <Text style={styles.renewalLabel}>{t('business.myPromotions.autoRenewal')}</Text>
                    {renewBusy ? (
                      <ActivityIndicator size="small" color={GREEN} />
                    ) : (
                      <Switch
                        value={p.subscriptionAutoRenewal ?? false}
                        onValueChange={(val) => handleToggleRenewal(p, val)}
                        trackColor={{ false: '#E5E7EB', true: GREEN }}
                        thumbColor="#FFFFFF"
                      />
                    )}
                  </View>
                )}

                {p.status !== 'expired' && (
                  <TouchableOpacity
                    style={styles.cancelBtnFull}
                    onPress={() => setCancelTarget(p)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                    <Text style={styles.cancelBtnFullText}>{t('business.myPromotions.cancelPromotion')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      <CancelModal
        visible={!!cancelTarget}
        promotion={cancelTarget}
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelTarget(null)}
        loading={cancelling}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 60, alignItems: 'center' },
  heading: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { color: '#DC2626', fontSize: 13 },
  filterRow: { marginBottom: 14 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginRight: 8,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  filterChipActive: { backgroundColor: GREEN, borderColor: GREEN },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterChipTextActive: { color: '#fff' },
  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptySubtitle: { fontSize: 13, color: '#6B7280', textAlign: 'center', maxWidth: 280 },

  table: {
    borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    overflow: 'hidden', backgroundColor: '#fff',
  },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  tableHeader: { backgroundColor: '#F9FAFB' },
  tableHeaderCell: {
    flex: 1, fontSize: 11, fontWeight: '600', color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  tableCell: { flex: 1, fontSize: 13, color: '#111827' },
  cancelBtn: {
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start',
  },
  cancelBtnText: { fontSize: 12, fontWeight: '600', color: '#DC2626' },

  card: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', padding: 14, gap: 8,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardMeta: { fontSize: 12, color: '#6B7280' },
  renewalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  renewalLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  cancelBtnFull: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 10,
    paddingVertical: 9, backgroundColor: '#FEF2F2',
  },
  cancelBtnFullText: { fontSize: 13, fontWeight: '600', color: '#DC2626' },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalBox: {
    width: '100%', maxWidth: 400, backgroundColor: '#fff',
    borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16, shadowRadius: 24, elevation: 10,
  },
  modalIconRow: { alignItems: 'center', marginBottom: 8 },
  modalIconBg: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  modalBody: {
    fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginTop: 6,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtnCancel: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center',
  },
  modalBtnCancelText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  modalBtnDelete: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#EF4444', alignItems: 'center',
  },
  modalBtnDeleteText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
