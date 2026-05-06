// components/business/FindToursTab.tsx
// Permite al usuario business buscar tours y añadir su negocio a slots disponibles.
// Trial: hasta 2 slots gratis durante 7 días (sin tarjeta).
// Al superar el trial: selector de plan (29€/mes | 249€/año) + Stripe EmbeddedCheckout inline.

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  Modal,
  Pressable,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter, usePathname } from 'expo-router';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from '@stripe/react-stripe-js';
import {
  getAvailableTourSlots,
  addPromotion,
  getPromotionsByUser,
  createSlotCheckoutSession,
  confirmSlotPromotion,
} from '../../services/business-promotion.service';
import { getSubscriptionPlans } from '../../services/dashboard.service';
import { getCheckoutSessionStatus } from '../../services/subscription.service';
import { getStripePromise } from '../../lib/stripe';
import { getBusinessesByAuthor } from '../../services/business.service';
import type { Business, TourWithSlots, BusinessPromotion, SubscriptionPlan, PromotionTargetType } from '../../types';

const GREEN      = '#10B981';
const GREEN_DARK = '#059669';
const AMBER      = '#F59E0B';
const MAX_FREE_SLOTS = 2;
const SLOTS_PER_LOCATION = 3;
const PAGE_SIZE = 10;

interface FindToursTabProps {
  userId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cycleLabel(billingCycle: string, t: (k: string) => string): string {
  if (billingCycle === 'monthly') return t('subscription.monthly');
  if (billingCycle === 'annual')  return t('subscription.annual');
  return billingCycle;
}

function cyclePriceUnit(billingCycle: string, t: (k: string) => string): string {
  if (billingCycle === 'monthly') return t('subscription.month');
  if (billingCycle === 'annual')  return t('subscription.year');
  return billingCycle;
}

// ── Slot box ─────────────────────────────────────────────────────────────────

type SlotBoxState = 'free' | 'mine' | 'occupied';

interface SlotBoxProps {
  state: SlotBoxState;
  onPress?: () => void;
  disabled?: boolean;
}

function SlotBox({ state, onPress, disabled }: SlotBoxProps) {
  if (state === 'occupied') {
    return (
      <View style={slotBoxStyles.boxOccupied}>
        <Ionicons name="storefront-outline" size={14} color="#9CA3AF" />
      </View>
    );
  }
  if (state === 'mine') {
    return (
      <View style={slotBoxStyles.boxMine}>
        <Ionicons name="storefront" size={14} color="#fff" />
      </View>
    );
  }
  return (
    <TouchableOpacity
      style={[slotBoxStyles.boxFree, disabled && slotBoxStyles.boxFreeDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Ionicons name="add" size={16} color={disabled ? '#9CA3AF' : GREEN_DARK} />
    </TouchableOpacity>
  );
}

const slotBoxStyles = StyleSheet.create({
  boxFree: {
    width: 40, height: 40, borderRadius: 10,
    borderWidth: 1.5, borderColor: GREEN, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F0FDF4',
  },
  boxFreeDisabled: {
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  boxMine: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: GREEN,
    alignItems: 'center', justifyContent: 'center',
  },
  boxOccupied: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },
});

// ── Slot row (one location: tour page OR a step) ──────────────────────────────

interface SlotRowProps {
  icon: 'map-outline' | 'location-outline';
  label: string;
  hint: string;
  state: SlotBoxState;  // state of the first slot (from backend data)
  onAddSlot: () => void;
  disabled: boolean;
}

function SlotRow({ icon, label, hint, state, onAddSlot, disabled }: SlotRowProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 600;

  const freeCount = state === 'occupied' ? 0 : state === 'mine' ? SLOTS_PER_LOCATION - 1 : SLOTS_PER_LOCATION;

  const boxes: SlotBoxState[] = [state];
  for (let i = 1; i < SLOTS_PER_LOCATION; i++) {
    boxes.push(state === 'occupied' ? 'occupied' : 'free');
  }

  return (
    <View style={[slotRowStyles.row, isMobile && slotRowStyles.rowMobile]}>
      <View style={slotRowStyles.labelCol}>
        <View style={slotRowStyles.labelRow}>
          <Ionicons name={icon} size={14} color={state === 'occupied' ? '#9CA3AF' : GREEN_DARK} />
          <Text style={[slotRowStyles.label, state === 'occupied' && slotRowStyles.labelDisabled]} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Text style={slotRowStyles.hint} numberOfLines={1}>{hint}</Text>
      </View>

      <View style={[slotRowStyles.boxesCol, isMobile && slotRowStyles.boxesColMobile]}>
        {boxes.map((boxState, i) => (
          <SlotBox
            key={i}
            state={boxState}
            onPress={boxState === 'free' ? onAddSlot : undefined}
            disabled={disabled || boxState !== 'free'}
          />
        ))}
        <View style={[slotRowStyles.freeBadge, freeCount === 0 && slotRowStyles.freeBadgeFull]}>
          <Text style={[slotRowStyles.freeBadgeText, freeCount === 0 && slotRowStyles.freeBadgeTextFull]}>
            {freeCount}/{SLOTS_PER_LOCATION}
          </Text>
        </View>
      </View>
    </View>
  );
}

const slotRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6',
  },
  rowMobile: {
    flexDirection: 'column', alignItems: 'flex-start',
  },
  labelCol: { flex: 1, minWidth: 0, gap: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#111827', flexShrink: 1 },
  labelDisabled: { color: '#9CA3AF' },
  hint: { fontSize: 11, color: '#9CA3AF' },
  boxesCol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  boxesColMobile: { paddingLeft: 20, paddingTop: 6 },
  freeBadge: {
    backgroundColor: '#D1FAE5', borderRadius: 20,
    paddingHorizontal: 7, paddingVertical: 2, marginLeft: 2,
  },
  freeBadgeFull: { backgroundColor: '#F3F4F6' },
  freeBadgeText: { fontSize: 11, fontWeight: '700', color: GREEN_DARK },
  freeBadgeTextFull: { color: '#9CA3AF' },
});

// ── Plan + checkout modal ─────────────────────────────────────────────────────

type CheckoutStep = 'plan-picker' | 'loading' | 'checkout' | 'confirming' | 'error';

interface SlotCheckoutModalProps {
  visible: boolean;
  slotData: { tourTitle: string; targetType: PromotionTargetType; targetId: string; businessId: string } | null;
  plans: SubscriptionPlan[];
  trialEverExhausted: boolean;
  onSuccess: (promo: BusinessPromotion) => void;
  onClose: () => void;
}

function SlotCheckoutModal({ visible, slotData, plans, trialEverExhausted, onSuccess, onClose }: SlotCheckoutModalProps) {
  const { t } = useTranslation();
  const [step, setStep]                         = useState<CheckoutStep>('plan-picker');
  const [selectedOption, setSelectedOption]     = useState<string | null>(null);
  const [clientSecret, setClientSecret]         = useState<string | null>(null);
  const [sessionId, setSessionId]               = useState<string | null>(null);
  const [error, setError]                       = useState('');

  useEffect(() => {
    if (visible) {
      setStep('plan-picker');
      setSelectedOption(!trialEverExhausted ? 'trial' : (plans.length > 0 ? plans[0].id : null));
      setClientSecret(null);
      setSessionId(null);
      setError('');
    }
  }, [visible, plans, trialEverExhausted]);

  const selectedPlan = plans.find((p) => p.id === selectedOption) ?? null;

  const handleConfirm = async () => {
    if (!slotData || !selectedOption) return;
    if (selectedOption === 'trial') {
      setStep('loading');
      try {
        const promo = await addPromotion({
          businessId: slotData.businessId,
          targetType: slotData.targetType,
          targetId: slotData.targetId,
        });
        onSuccess(promo);
      } catch (err: any) {
        setError(err?.response?.data?.message ?? err?.message ?? t('business.findTours.slotError'));
        setStep('error');
      }
    } else {
      handleStartCheckout();
    }
  };

  const handleStartCheckout = async () => {
    if (!selectedPlan || !slotData) return;
    setStep('loading');
    setError('');
    try {
      const result = await createSlotCheckoutSession(selectedPlan.id, {
        businessId: slotData.businessId,
        targetType: slotData.targetType,
        targetId: slotData.targetId,
      });
      setClientSecret(result.clientSecret);
      setSessionId(result.checkoutSessionId);
      setStep('checkout');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? t('business.findTours.paymentError'));
      setStep('error');
    }
  };

  const handleComplete = async () => {
    if (!sessionId || !slotData) return;
    setStep('confirming');
    try {
      const status = await getCheckoutSessionStatus(sessionId);
      if (status.status === 'complete') {
        const promo = await confirmSlotPromotion(sessionId, {
          businessId: slotData.businessId,
          targetType: slotData.targetType,
          targetId: slotData.targetId,
        });
        onSuccess(promo);
      } else {
        setError(t('business.findTours.paymentIncomplete'));
        setStep('error');
      }
    } catch (err: any) {
      setError(err?.message ?? t('business.findTours.confirmError'));
      setStep('error');
    }
  };

  if (!visible || !slotData) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={step === 'plan-picker' ? onClose : undefined}>
      <Pressable style={styles.modalBackdrop} onPress={step === 'plan-picker' ? onClose : undefined}>
        <Pressable style={[styles.modalBox, step === 'checkout' && styles.modalBoxWide]} onPress={() => {}}>

          {step === 'plan-picker' && (
            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }} contentContainerStyle={{ gap: 0 }}>
              {/* Header */}
              <View style={checkoutStyles.header}>
                <Ionicons name="megaphone-outline" size={28} color={GREEN} />
              </View>
              <Text style={styles.modalTitle}>{t('business.findTours.chooseYourPlan')}</Text>
              <Text style={[styles.modalSubtitle, { marginBottom: 16 }]} numberOfLines={2}>
                {slotData.tourTitle}
              </Text>

              {/* Plan cards */}
              <View style={checkoutStyles.planList}>
                {/* Trial card — only when trial still available */}
                {!trialEverExhausted && (
                  <TouchableOpacity
                    style={[checkoutStyles.planCard, selectedOption === 'trial' && checkoutStyles.planCardSelected]}
                    onPress={() => setSelectedOption('trial')}
                    activeOpacity={0.8}
                  >
                    <View style={checkoutStyles.planCardRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={checkoutStyles.planCardName}>{t('business.findTours.trialOptionTitle')}</Text>
                        <Text style={checkoutStyles.planCardCycle}>{t('business.findTours.trialOptionSub')}</Text>
                      </View>
                      <View style={checkoutStyles.planCardPriceCol}>
                        <Text style={[checkoutStyles.planCardPrice, selectedOption === 'trial' && checkoutStyles.planCardPriceSelected]}>
                          {t('business.findTours.trialOptionFree')}
                        </Text>
                        <Text style={checkoutStyles.planCardPriceUnit}>{t('business.findTours.trialOptionDays')}</Text>
                      </View>
                      <View style={[checkoutStyles.radio, selectedOption === 'trial' && checkoutStyles.radioSelected]}>
                        {selectedOption === 'trial' && <View style={checkoutStyles.radioDot} />}
                      </View>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Paid plan cards — skip if already shown as selected via trial above */}
                {plans.map((plan) => {
                  const isSelected = selectedOption === plan.id;
                  const isAnnual   = plan.billingCycle === 'annual';
                  return (
                    <TouchableOpacity
                      key={plan.id}
                      style={[checkoutStyles.planCard, isSelected && checkoutStyles.planCardSelected]}
                      onPress={() => setSelectedOption(plan.id)}
                      activeOpacity={0.8}
                    >
                      <View style={checkoutStyles.planCardRow}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={checkoutStyles.planCardName}>{plan.title}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <Text style={checkoutStyles.planCardCycle}>{cycleLabel(plan.billingCycle, t)}</Text>
                            {isAnnual && (
                              <View style={checkoutStyles.savingBadge}>
                                <Text style={checkoutStyles.savingBadgeText}>{t('business.findTours.planSaving')}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View style={checkoutStyles.planCardPriceCol}>
                          <Text style={[checkoutStyles.planCardPrice, isSelected && checkoutStyles.planCardPriceSelected]}>
                            {plan.price.toFixed(2)} €
                          </Text>
                          <Text style={checkoutStyles.planCardPriceUnit}>/ {cyclePriceUnit(plan.billingCycle, t)}</Text>
                        </View>
                        <View style={[checkoutStyles.radio, isSelected && checkoutStyles.radioSelected]}>
                          {isSelected && <View style={checkoutStyles.radioDot} />}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[checkoutStyles.payBtn, !selectedOption && checkoutStyles.payBtnDisabled]}
                onPress={handleConfirm}
                disabled={!selectedOption}
                activeOpacity={0.85}
              >
                {selectedOption === 'trial' ? (
                  <>
                    <Ionicons name="gift-outline" size={18} color="#fff" />
                    <Text style={checkoutStyles.payBtnText}>{t('business.findTours.confirmPlan')}</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="card-outline" size={18} color="#fff" />
                    <Text style={checkoutStyles.payBtnText}>
                      {t('business.findTours.payBtn', { price: selectedPlan ? selectedPlan.price.toFixed(2) : '' })}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={[styles.modalCancelBtn, { marginTop: 4 }]} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.modalCancelText}>{t('business.findTours.cancel')}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {step === 'loading' && (
            <>
              <ActivityIndicator size="large" color={GREEN} style={{ marginVertical: 32 }} />
              <Text style={{ color: '#6B7280', textAlign: 'center' }}>
                {selectedOption === 'trial'
                  ? t('business.findTours.addingTrial')
                  : t('business.findTours.preparingPayment')}
              </Text>
            </>
          )}

          {step === 'checkout' && clientSecret && Platform.OS === 'web' && (
            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
              {/* Checkout header with close button */}
              <View style={checkoutStyles.checkoutHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="lock-closed-outline" size={13} color="#6B7280" />
                  <Text style={{ fontSize: 12, color: '#6B7280' }}>{t('business.findTours.securePayment')}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setStep('plan-picker')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <View style={{ minHeight: 400, width: '100%' }}>
                <EmbeddedCheckoutProvider
                  stripe={getStripePromise()}
                  options={{ clientSecret, onComplete: handleComplete }}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </View>
            </ScrollView>
          )}

          {step === 'checkout' && Platform.OS !== 'web' && (
            <>
              <Ionicons name="phone-portrait-outline" size={40} color="#9CA3AF" style={{ alignSelf: 'center', marginVertical: 16 }} />
              <Text style={{ color: '#6B7280', textAlign: 'center', paddingHorizontal: 16 }}>
                {t('business.findTours.paymentWebOnly')}
              </Text>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.modalCancelText}>{t('business.findTours.cancel')}</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'confirming' && (
            <>
              <ActivityIndicator size="large" color={GREEN} style={{ marginVertical: 32 }} />
              <Text style={{ color: '#6B7280', textAlign: 'center' }}>{t('business.findTours.activatingSlot')}</Text>
            </>
          )}

          {step === 'error' && (
            <>
              <View style={{ alignItems: 'center', marginVertical: 16 }}>
                <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
              </View>
              <Text style={{ color: '#DC2626', textAlign: 'center', marginBottom: 16 }}>{error}</Text>
              <TouchableOpacity style={checkoutStyles.payBtn} onPress={() => setStep('plan-picker')} activeOpacity={0.85}>
                <Text style={checkoutStyles.payBtnText}>{t('business.findTours.retryBtn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.modalCancelText}>{t('business.findTours.cancel')}</Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Tab principal ─────────────────────────────────────────────────────────────

export function FindToursTab({ userId }: FindToursTabProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const pathname = usePathname();
  const langcode = pathname.split('/').filter(Boolean)[0] ?? 'es';

  const [search, setSearch]     = useState('');
  const [tours, setTours]       = useState<TourWithSlots[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [businesses, setBusinesses]               = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness]   = useState<Business | null>(null);
  const [bizPickerVisible, setBizPickerVisible]   = useState(false);

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentPromos, setCurrentPromos] = useState<BusinessPromotion[]>([]);

  const [expandedTourId, setExpandedTourId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount]     = useState(PAGE_SIZE);

  const [pendingSlot, setPendingSlot] = useState<{
    tourTitle: string;
    targetType: PromotionTargetType;
    targetId: string;
    businessId: string;
  } | null>(null);
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const [bizList, promos, planList] = await Promise.all([
        getBusinessesByAuthor(userId).catch(() => []),
        getPromotionsByUser(userId).catch(() => []),
        getSubscriptionPlans(['business_monthly', 'business_annual']).catch(() => []),
      ]);
      setBusinesses(bizList);
      if (bizList.length > 0) setSelectedBusiness(bizList[0]);
      setCurrentPromos(promos);
      setPlans(planList);
    })();
  }, [userId]);

  const searchTours = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    setVisibleCount(PAGE_SIZE);
    try {
      const results = await getAvailableTourSlots({ search: query });
      setTours(results);
    } catch {
      setError(t('business.findTours.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchTours(search), 400);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search, searchTours]);

  const handleSelectSlot = (tour: TourWithSlots, targetType: PromotionTargetType, targetId: string) => {
    if (!selectedBusiness) return;
    setPendingSlot({
      tourTitle: tour.tourTitle,
      targetType,
      targetId,
      businessId: selectedBusiness.id,
    });
    setCheckoutModalVisible(true);
  };

  const handleCheckoutSuccess = async (promo: BusinessPromotion) => {
    setCurrentPromos((prev) => [...prev, promo]);
    setCheckoutModalVisible(false);
    setPendingSlot(null);
    await searchTours(search);
    router.push(`/${langcode}/business-dashboard?tab=my-promotions` as any);
  };

  const trialEverExhausted = currentPromos.length >= MAX_FREE_SLOTS;
  const activePromoCount   = currentPromos.filter((p) => p.status !== 'expired').length;

  const toggleExpand = (tourId: string) => {
    setExpandedTourId((prev) => (prev === tourId ? null : tourId));
  };

  return (
    <View>
      {businesses.length > 1 && (
        <View style={styles.bizSelector}>
          <Text style={styles.bizSelectorLabel}>{t('business.findTours.advertiseAs')}</Text>
          <TouchableOpacity
            style={styles.bizSelectorBtn}
            onPress={() => setBizPickerVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.bizSelectorBtnText} numberOfLines={1}>
              {selectedBusiness?.name ?? t('business.findTours.selectBusiness')}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

      {/* Trial banner */}
      <View style={[styles.trialBanner, trialEverExhausted && styles.trialBannerFull]}>
        <Ionicons
          name={trialEverExhausted ? 'warning-outline' : 'information-circle-outline'}
          size={16}
          color={trialEverExhausted ? '#92400E' : '#065F46'}
        />
        <Text style={[styles.trialText, trialEverExhausted && styles.trialTextFull]}>
          {trialEverExhausted
            ? t('business.findTours.trialFull', { used: activePromoCount, max: MAX_FREE_SLOTS })
            : t('business.findTours.trialAvailable', { used: currentPromos.length, max: MAX_FREE_SLOTS })}
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchField}
            placeholder={t('business.findTours.searchPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading && <View style={styles.center}><ActivityIndicator color={GREEN} size="large" /></View>}

      {!loading && tours.length === 0 && !error && (
        <View style={styles.emptyBox}>
          <Ionicons name="search-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>{t('business.findTours.emptyTitle')}</Text>
          <Text style={styles.emptySubtitle}>{t('business.findTours.emptySubtitle')}</Text>
        </View>
      )}

      <View style={{ gap: 16, marginTop: 8 }}>
        {tours.slice(0, visibleCount).map((tour) => {
          const isExpanded = expandedTourId === tour.tourId;

          const isAlreadyMineDetail = currentPromos.some(
            (p) => p.targetType === 'tour_detail' && p.targetId === tour.tourId
              && p.businessId === selectedBusiness?.id && p.status !== 'expired'
          );

          const totalFreeSlots =
            (tour.hasDetailSlot && !tour.detailOccupied ? SLOTS_PER_LOCATION : 0) +
            tour.availableStepSlots.length * SLOTS_PER_LOCATION;

          // All step data merged for the expanded view
          const allSteps: Array<{ stepId: string; stepTitle: string; order: number; inAvailable: boolean; inOccupied: boolean }> = [
            ...tour.availableStepSlots.map((s) => ({ ...s, inAvailable: true, inOccupied: false })),
            ...tour.occupiedStepSlots.map((s) => ({ ...s, inAvailable: false, inOccupied: true })),
          ].sort((a, b) => a.order - b.order);

          return (
            <View key={tour.tourId} style={styles.tourCard}>
              {/* Card header row */}
              <TouchableOpacity
                style={styles.tourCardHeader}
                onPress={() => toggleExpand(tour.tourId)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.tourTitle} numberOfLines={1}>{tour.tourTitle}</Text>
                  {tour.city && (
                    <View style={styles.cityRow}>
                      <Ionicons name="location-outline" size={13} color="#6B7280" />
                      <Text style={styles.cityText}>{tour.city}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.slotSummaryBadge}>
                  <Text style={styles.slotSummaryText}>
                    {totalFreeSlots} {t('business.findTours.slotsAvailable')}
                  </Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#9CA3AF"
                />
              </TouchableOpacity>

              {/* Expanded slot grid */}
              {isExpanded && (
                <View style={styles.slotGrid}>
                  {/* Tour page slot */}
                  {(tour.hasDetailSlot || tour.detailOccupied) && (
                    <SlotRow
                      icon="map-outline"
                      label={t('business.findTours.slotTourPage')}
                      hint={t('business.findTours.slotTourPageHint')}
                      state={
                        isAlreadyMineDetail ? 'mine'
                        : tour.detailOccupied ? 'occupied'
                        : 'free'
                      }
                      onAddSlot={() => handleSelectSlot(tour, 'tour_detail', tour.tourId)}
                      disabled={!selectedBusiness}
                    />
                  )}

                  {/* Step slots */}
                  {allSteps.map((step) => {
                    const isAlreadyMineStep = currentPromos.some(
                      (p) => p.targetType === 'tour_step' && p.targetId === step.stepId
                        && p.businessId === selectedBusiness?.id && p.status !== 'expired'
                    );
                    const stepState: SlotBoxState =
                      isAlreadyMineStep ? 'mine'
                      : step.inOccupied ? 'occupied'
                      : 'free';

                    return (
                      <SlotRow
                        key={step.stepId}
                        icon="location-outline"
                        label={t('business.findTours.stepLabel', { order: step.order, title: step.stepTitle })}
                        hint={t('business.findTours.slotStepHint')}
                        state={stepState}
                        onAddSlot={() => handleSelectSlot(tour, 'tour_step', step.stepId)}
                        disabled={!selectedBusiness}
                      />
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {tours.length > visibleCount && (
        <View style={styles.loadMoreContainer}>
          <TouchableOpacity
            style={styles.loadMoreBtn}
            onPress={() => setVisibleCount((c) => c + PAGE_SIZE)}
            activeOpacity={0.8}
          >
            <Text style={styles.loadMoreText}>{t('home.loadMore')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <SlotCheckoutModal
        visible={checkoutModalVisible}
        slotData={pendingSlot}
        plans={plans}
        trialEverExhausted={trialEverExhausted}
        onSuccess={handleCheckoutSuccess}
        onClose={() => { setCheckoutModalVisible(false); setPendingSlot(null); }}
      />

      {bizPickerVisible && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setBizPickerVisible(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setBizPickerVisible(false)}>
            <Pressable style={styles.modalBox} onPress={() => {}}>
              <Text style={styles.modalTitle}>{t('business.findTours.selectBizTitle')}</Text>
              {businesses.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.slotBtn, selectedBusiness?.id === b.id && styles.slotBtnSelected]}
                  onPress={() => { setSelectedBusiness(b); setBizPickerVisible(false); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="storefront-outline" size={20} color={GREEN_DARK} />
                  <Text style={styles.slotBtnTitle}>{b.name}</Text>
                  {selectedBusiness?.id === b.id && (
                    <Ionicons name="checkmark-circle" size={20} color={GREEN} />
                  )}
                </TouchableOpacity>
              ))}
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

// ── Checkout-modal specific styles ────────────────────────────────────────────

const checkoutStyles = StyleSheet.create({
  header: { alignItems: 'center', paddingVertical: 4, marginBottom: 4 },

  checkoutHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 12, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    width: '100%',
  },

  planList: { gap: 10, marginBottom: 14, width: '100%' },

  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  planCardSelected: {
    borderColor: GREEN,
    backgroundColor: '#ECFDF5',
  },
  planCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planCardName:  { fontSize: 15, fontWeight: '700', color: '#111827' },
  planCardCycle: { fontSize: 12, color: '#6B7280' },
  savingBadge: {
    backgroundColor: '#D1FAE5',
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  savingBadgeText: { fontSize: 10, fontWeight: '700', color: GREEN_DARK },

  planCardPriceCol: { alignItems: 'flex-end' },
  planCardPrice:  { fontSize: 16, fontWeight: '700', color: '#374151' },
  planCardPriceSelected: { color: GREEN_DARK },
  planCardPriceUnit: { fontSize: 11, color: '#9CA3AF' },

  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: GREEN },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: GREEN },

  payBtn: {
    backgroundColor: GREEN, borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, width: '100%',
  },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ── Main styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: { paddingVertical: 48, alignItems: 'center' },

  bizSelector: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  bizSelectorLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  bizSelectorBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff',
  },
  bizSelectorBtnText: { fontSize: 14, color: '#111827', flex: 1 },

  trialBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#ECFDF5', borderRadius: 10, padding: 10, marginBottom: 12,
    borderWidth: 1, borderColor: '#A7F3D0',
  },
  trialBannerFull: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  trialText: { fontSize: 13, color: '#065F46', flex: 1 },
  trialTextFull: { color: '#92400E' },

  searchRow: { marginBottom: 12 },
  searchInput: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 8,
    backgroundColor: '#fff',
  },
  searchField: {
    flex: 1, fontSize: 14, color: '#111827',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { color: '#DC2626', fontSize: 13 },

  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptySubtitle: { fontSize: 13, color: '#6B7280', textAlign: 'center', maxWidth: 280 },

  tourCard: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  tourCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 16,
  },
  tourTitle: { fontSize: 15, fontWeight: '700', color: '#111827', lineHeight: 20 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  cityText: { fontSize: 12, color: '#6B7280' },

  slotSummaryBadge: {
    backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, borderColor: '#A7F3D0',
  },
  slotSummaryText: { fontSize: 12, fontWeight: '700', color: GREEN_DARK },

  slotGrid: {
    paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    backgroundColor: '#FAFAFA',
  },

  loadMoreContainer: {
    paddingTop: 16, paddingBottom: 8, alignItems: 'center',
  },
  loadMoreBtn: {
    backgroundColor: AMBER, paddingHorizontal: 32, paddingVertical: 12,
    borderRadius: 24, minWidth: 160, alignItems: 'center',
  },
  loadMoreText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalBox: {
    width: '100%', maxWidth: 420, backgroundColor: '#fff',
    borderRadius: 20, padding: 24, gap: 10, alignItems: 'center',
    maxHeight: '85%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16, shadowRadius: 24, elevation: 10,
  },
  modalBoxWide: { maxWidth: 600 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: -4 },

  slotBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, width: '100%',
    borderRadius: 12, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#A7F3D0',
  },
  slotBtnSelected: { borderColor: GREEN, backgroundColor: '#ECFDF5' },
  slotBtnTitle: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },

  modalCancelBtn: {
    alignItems: 'center', paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#E5E7EB', width: '100%',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
});
