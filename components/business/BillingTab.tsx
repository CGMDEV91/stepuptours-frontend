// components/business/BillingTab.tsx

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
  Switch,
  Modal,
  Pressable,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getPaymentHistoryByUser } from '../../services/dashboard.service';
import {
  getPromotionsByUser,
  removePromotion,
  setSlotAutoRenewal,
} from '../../services/business-promotion.service';
import type { BusinessPromotion, PromotionTargetType, SubscriptionPayment } from '../../types';

const GREEN      = '#10B981';
const GREEN_DARK = '#059669';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
        {isTour ? t('business.billing.typeTour') : t('business.billing.typeStep')}
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
        {isAnnual ? t('business.billing.planAnnual') : t('business.billing.planMonthly')}
      </Text>
    </View>
  );
}

function SubStatusBadge({ status }: { status: string | null }) {
  const { t } = useTranslation();
  if (!status) return null;
  const map: Record<string, { bg: string; text: string; labelKey: string }> = {
    active:    { bg: '#D1FAE5', text: '#065F46', labelKey: 'business.billing.statusActive' },
    cancelled: { bg: '#FEF3C7', text: '#92400E', labelKey: 'business.billing.statusCancelled' },
    expired:   { bg: '#F3F4F6', text: '#6B7280', labelKey: 'business.billing.statusExpired' },
  };
  const c = map[status] ?? { bg: '#F3F4F6', text: '#6B7280', labelKey: '' };
  const label = c.labelKey ? t(c.labelKey) : status;
  return (
    <View style={{ backgroundColor: c.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: c.text }}>{label}</Text>
    </View>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const config: Record<string, { bg: string; text: string; labelKey: string }> = {
    succeeded: { bg: '#D1FAE5', text: '#065F46', labelKey: 'business.billing.payStatusPaid' },
    succeed:   { bg: '#D1FAE5', text: '#065F46', labelKey: 'business.billing.payStatusPaid' },
    failed:    { bg: '#FEE2E2', text: '#991B1B', labelKey: 'business.billing.payStatusFailed' },
    refunded:  { bg: '#E0E7FF', text: '#3730A3', labelKey: 'business.billing.payStatusRefunded' },
  };
  const c = config[status] ?? { bg: '#F3F4F6', text: '#6B7280', labelKey: '' };
  const label = c.labelKey ? t(c.labelKey) : status;
  return (
    <View style={{ backgroundColor: c.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: c.text }}>{label}</Text>
    </View>
  );
}

// ── Cancel confirmation modal ─────────────────────────────────────────────────

interface CancelSlotModalProps {
  visible: boolean;
  promotion: BusinessPromotion | null;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}

function CancelSlotModal({ visible, promotion, onConfirm, onClose, loading }: CancelSlotModalProps) {
  const { t } = useTranslation();
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.modalBox} onPress={() => {}}>
          <View style={styles.modalIconRow}>
            <View style={styles.modalIconBg}>
              <Ionicons name="close-circle-outline" size={24} color="#EF4444" />
            </View>
          </View>
          <Text style={styles.modalTitle}>{t('business.billing.cancelSlotTitle')}</Text>
          <Text style={styles.modalBody}>
            {t('business.billing.cancelSlotBody', { name: promotion?.targetName ?? '' })}
          </Text>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalBtnBack} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.modalBtnBackText}>{t('business.billing.cancelSlotKeep')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtnDo, loading && { opacity: 0.6 }]}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.modalBtnDoText}>{t('business.billing.cancelSlotConfirm')}</Text>
              }
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Section 1: Active slot subscriptions ─────────────────────────────────────

interface SlotSubscriptionsSectionProps {
  userId: string;
}

function SlotSubscriptionsSection({ userId }: SlotSubscriptionsSectionProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [promotions, setPromotions] = useState<BusinessPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renewalLoading, setRenewalLoading] = useState<Record<string, boolean>>({});
  const [cancelTarget, setCancelTarget] = useState<BusinessPromotion | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await getPromotionsByUser(userId);
      const withSub = all.filter(
        (p) => p.subscriptionId !== null &&
               (p.subscriptionStatus === 'active' || p.subscriptionStatus === 'cancelled'),
      );
      setPromotions(withSub);
    } catch {
      setError(t('business.billing.slotLoadError'));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
      setError(t('business.billing.renewalError'));
    } finally {
      setRenewalLoading((prev) => ({ ...prev, [p.id]: false }));
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await removePromotion(cancelTarget.id);
      setPromotions((prev) => prev.filter((p) => p.id !== cancelTarget.id));
      setCancelTarget(null);
    } catch {
      setError(t('business.billing.cancelError'));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      <Text style={styles.sectionTitle}>{t('business.billing.sectionSlots')}</Text>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading && <ActivityIndicator color={GREEN} style={{ marginVertical: 16 }} />}

      {!loading && promotions.length === 0 && (
        <View style={styles.emptyBox}>
          <Ionicons name="megaphone-outline" size={40} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>{t('business.billing.emptySlots')}</Text>
          <Text style={styles.emptySubtitle}>{t('business.billing.emptySlotsSubtitle')}</Text>
        </View>
      )}

      {!loading && promotions.length > 0 && (
        isDesktop ? (
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              {[
                t('business.billing.colSlot'),
                t('business.billing.colType'),
                t('business.billing.colPlan'),
                t('business.billing.colStatus'),
                t('business.billing.colExpiry'),
                t('business.billing.colAutoRenewal'),
                t('business.billing.colActions'),
              ].map((h) => (
                <Text key={h} style={styles.tableHeaderCell}>{h}</Text>
              ))}
            </View>
            {promotions.map((p) => {
              const renewBusy = !!renewalLoading[p.id];
              return (
                <View key={p.id} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{p.targetName}</Text>
                  <View style={[styles.tableCell, { flex: 1 }]}>
                    <TypeBadge type={p.targetType} />
                  </View>
                  <View style={[styles.tableCell, { flex: 1.2 }]}>
                    <PlanBadge planType={p.subscriptionPlanType} />
                  </View>
                  <View style={[styles.tableCell, { flex: 1 }]}>
                    <SubStatusBadge status={p.subscriptionStatus} />
                  </View>
                  <Text style={[styles.tableCell, { flex: 1.2, color: '#6B7280' }]}>
                    {formatDate(p.subscriptionEndDate)}
                  </Text>
                  <View style={[styles.tableCell, { flex: 1.2 }]}>
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
                  <View style={[styles.tableCell, { flex: 1.2 }]}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => setCancelTarget(p)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.cancelBtnText}>{t('business.billing.cancelSlot')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {promotions.map((p) => {
              const renewBusy = !!renewalLoading[p.id];
              return (
                <View key={p.id} style={styles.slotCard}>
                  <View style={styles.slotCardTop}>
                    <Text style={styles.slotCardName} numberOfLines={1}>{p.targetName}</Text>
                    <SubStatusBadge status={p.subscriptionStatus} />
                  </View>
                  <View style={styles.slotCardMeta}>
                    <TypeBadge type={p.targetType} />
                    {p.subscriptionPlanType && <PlanBadge planType={p.subscriptionPlanType} />}
                  </View>
                  {p.subscriptionEndDate && (
                    <Text style={styles.slotCardDate}>
                      {t('business.billing.expiresOn', { date: formatDate(p.subscriptionEndDate) })}
                    </Text>
                  )}
                  <View style={styles.renewalRow}>
                    <Text style={styles.renewalLabel}>{t('business.billing.autoRenewal')}</Text>
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
                  <TouchableOpacity
                    style={styles.cancelBtnFull}
                    onPress={() => setCancelTarget(p)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                    <Text style={styles.cancelBtnFullText}>{t('business.billing.cancelSlot')}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )
      )}

      <CancelSlotModal
        visible={!!cancelTarget}
        promotion={cancelTarget}
        onConfirm={handleConfirmCancel}
        onClose={() => setCancelTarget(null)}
        loading={cancelling}
      />
    </>
  );
}

// ── Section 2: Payment history ────────────────────────────────────────────────

function PaymentHistorySection({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPaymentHistoryByUser(userId)
      .then(setPayments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <>
      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>{t('business.billing.sectionPayments')}</Text>

      {loading && <ActivityIndicator color={GREEN} style={{ marginVertical: 16 }} />}

      {!loading && payments.length === 0 && (
        <View style={styles.emptyBox}>
          <Ionicons name="receipt-outline" size={40} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>{t('business.billing.emptyPayments')}</Text>
          <Text style={styles.emptySubtitle}>{t('business.billing.emptyPaymentsSubtitle')}</Text>
        </View>
      )}

      {!loading && payments.length > 0 && (
        isDesktop ? (
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              {[
                t('business.billing.colDate'),
                t('business.billing.colPlan'),
                t('business.billing.colPeriod'),
                t('business.billing.colAmount'),
                t('business.billing.colPayStatus'),
              ].map((h) => (
                <Text key={h} style={styles.tableHeaderCell}>{h}</Text>
              ))}
            </View>
            {payments.map((p) => (
              <View key={p.id} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 1 }]}>{formatDate(p.periodStart)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{p.planTitle}</Text>
                <Text style={[styles.tableCell, { flex: 1.8, color: '#6B7280', fontSize: 12 }]}>
                  {formatDate(p.periodStart)} → {formatDate(p.periodEnd)}
                </Text>
                <Text style={[styles.tableCell, { flex: 1, fontWeight: '700' }]}>
                  {p.amount.toFixed(2)} €
                </Text>
                <View style={[styles.tableCell, { flex: 1 }]}>
                  <PaymentStatusBadge status={p.status} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {payments.map((p) => (
              <View key={p.id} style={styles.payCard}>
                <View style={styles.payCardTop}>
                  <Text style={styles.payCardDesc} numberOfLines={1}>{p.planTitle}</Text>
                  <Text style={styles.payCardAmount}>{p.amount.toFixed(2)} €</Text>
                </View>
                <View style={styles.payCardBottom}>
                  <Text style={styles.payCardMeta}>
                    {formatDate(p.periodStart)} → {formatDate(p.periodEnd)}
                  </Text>
                  <PaymentStatusBadge status={p.status} />
                </View>
              </View>
            ))}
          </View>
        )
      )}
    </>
  );
}

// ── Tab principal ─────────────────────────────────────────────────────────────

interface BillingTabProps {
  userId: string;
}

export function BillingTab({ userId }: BillingTabProps) {
  const { t } = useTranslation();
  return (
    <View style={{ paddingBottom: 32 }}>
      <Text style={styles.heading}>{t('business.billing.title')}</Text>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={18} color="#0369A1" />
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>{t('business.billing.infoTitle')}</Text>
          <Text style={styles.infoText}>{t('business.billing.infoText')}</Text>
        </View>
      </View>

      <SlotSubscriptionsSection userId={userId} />
      <PaymentHistorySection userId={userId} />
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 12 },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#E0F2FE', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#BAE6FD', marginBottom: 20,
  },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#0369A1', marginBottom: 2 },
  infoText: { fontSize: 12, color: '#075985', lineHeight: 17 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { color: '#DC2626', fontSize: 13 },

  emptyBox: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#374151' },
  emptySubtitle: { fontSize: 13, color: '#6B7280', textAlign: 'center', maxWidth: 280 },

  table: {
    borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    overflow: 'hidden', backgroundColor: '#fff', marginBottom: 8,
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

  slotCard: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', padding: 14, gap: 8,
  },
  slotCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  slotCardName: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1 },
  slotCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  slotCardDate: { fontSize: 12, color: '#6B7280' },
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

  payCard: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', padding: 14, gap: 8,
  },
  payCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payCardDesc: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  payCardAmount: { fontSize: 16, fontWeight: '800', color: '#111827' },
  payCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payCardMeta: { fontSize: 12, color: '#6B7280' },

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
  modalBtnBack: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center',
  },
  modalBtnBackText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  modalBtnDo: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#EF4444', alignItems: 'center',
  },
  modalBtnDoText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
