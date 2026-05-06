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
const MAX_FREE_SLOTS = 2;

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

// ── Slot picker modal ─────────────────────────────────────────────────────────

interface SlotModalProps {
  visible: boolean;
  tour: TourWithSlots | null;
  currentPromos: BusinessPromotion[];
  businessId: string | null;
  onSelectSlot: (targetType: PromotionTargetType, targetId: string) => void;
  onClose: () => void;
}

function SlotModal({ visible, tour, currentPromos, businessId, onSelectSlot, onClose }: SlotModalProps) {
  const { t } = useTranslation();
  if (!tour) return null;

  const isAlreadyMineDetail = currentPromos.some(
    (p) => p.targetType === 'tour_detail' && p.targetId === tour.tourId && p.businessId === businessId && p.status !== 'expired'
  );

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalBox} onPress={() => {}}>
          <Text style={styles.modalTitle}>{t('business.findTours.slotModalTitle')}</Text>
          <Text style={styles.modalSubtitle} numberOfLines={2}>{tour.tourTitle}</Text>

          {/* Tour-detail slot */}
          {isAlreadyMineDetail ? (
            <View style={[styles.slotBtn, styles.slotBtnDisabled]}>
              <Ionicons name="map-outline" size={20} color="#9CA3AF" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.slotBtnTitle, styles.slotBtnTitleDisabled]}>{t('business.findTours.slotTourPage')}</Text>
                <Text style={styles.slotBtnHint}>{t('business.findTours.slotTourPageHint')}</Text>
              </View>
              <View style={styles.mineBadge}><Text style={styles.mineBadgeText}>{t('business.findTours.slotAlreadyMine')}</Text></View>
            </View>
          ) : tour.detailOccupied ? (
            <View style={[styles.slotBtn, styles.slotBtnDisabled]}>
              <Ionicons name="map-outline" size={20} color="#9CA3AF" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.slotBtnTitle, styles.slotBtnTitleDisabled]}>{t('business.findTours.slotTourPage')}</Text>
                <Text style={styles.slotBtnHint}>{t('business.findTours.slotOccupiedHint')}</Text>
              </View>
              <View style={styles.occupiedBadge}><Text style={styles.occupiedBadgeText}>{t('business.findTours.slotOccupied')}</Text></View>
            </View>
          ) : tour.hasDetailSlot ? (
            <TouchableOpacity
              style={styles.slotBtn}
              onPress={() => onSelectSlot('tour_detail', tour.tourId)}
              activeOpacity={0.8}
            >
              <Ionicons name="map-outline" size={20} color={GREEN_DARK} />
              <View style={{ flex: 1 }}>
                <Text style={styles.slotBtnTitle}>{t('business.findTours.slotTourPage')}</Text>
                <Text style={styles.slotBtnHint}>{t('business.findTours.slotTourPageHint')}</Text>
              </View>
              <Ionicons name="add-circle-outline" size={22} color={GREEN} />
            </TouchableOpacity>
          ) : null}

          {/* Step slots — available */}
          {tour.availableStepSlots.map((step) => {
            const isAlreadyMineStep = currentPromos.some(
              (p) => p.targetType === 'tour_step' && p.targetId === step.stepId && p.businessId === businessId && p.status !== 'expired'
            );
            if (isAlreadyMineStep) {
              return (
                <View key={step.stepId} style={[styles.slotBtn, styles.slotBtnDisabled]}>
                  <Ionicons name="location-outline" size={20} color="#9CA3AF" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.slotBtnTitle, styles.slotBtnTitleDisabled]}>
                      {t('business.findTours.stepLabel', { order: step.order, title: step.stepTitle })}
                    </Text>
                    <Text style={styles.slotBtnHint}>{t('business.findTours.slotStepHint')}</Text>
                  </View>
                  <View style={styles.mineBadge}><Text style={styles.mineBadgeText}>{t('business.findTours.slotAlreadyMine')}</Text></View>
                </View>
              );
            }
            return (
              <TouchableOpacity
                key={step.stepId}
                style={styles.slotBtn}
                onPress={() => onSelectSlot('tour_step', step.stepId)}
                activeOpacity={0.8}
              >
                <Ionicons name="location-outline" size={20} color={GREEN_DARK} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.slotBtnTitle}>
                    {t('business.findTours.stepLabel', { order: step.order, title: step.stepTitle })}
                  </Text>
                  <Text style={styles.slotBtnHint}>{t('business.findTours.slotStepHint')}</Text>
                </View>
                <Ionicons name="add-circle-outline" size={22} color={GREEN} />
              </TouchableOpacity>
            );
          })}

          {/* Step slots — occupied by another business */}
          {tour.occupiedStepSlots.map((step) => (
            <View key={step.stepId} style={[styles.slotBtn, styles.slotBtnDisabled]}>
              <Ionicons name="location-outline" size={20} color="#9CA3AF" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.slotBtnTitle, styles.slotBtnTitleDisabled]}>
                  {t('business.findTours.stepLabel', { order: step.order, title: step.stepTitle })}
                </Text>
                <Text style={styles.slotBtnHint}>{t('business.findTours.slotOccupiedHint')}</Text>
              </View>
              <View style={styles.occupiedBadge}><Text style={styles.occupiedBadgeText}>{t('business.findTours.slotOccupied')}</Text></View>
            </View>
          ))}

          <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.modalCancelText}>{t('business.findTours.cancel')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

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

                {/* Paid plan cards */}
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

              {/* Selected plan summary */}
              {selectedOption && (
                <View style={checkoutStyles.summaryBox}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={checkoutStyles.summaryTitle}>
                      {selectedOption === 'trial' ? t('business.findTours.trialOptionTitle') : (selectedPlan?.title ?? '')}
                    </Text>
                    <Text style={checkoutStyles.summaryPrice}>
                      {selectedOption === 'trial'
                        ? t('business.findTours.trialOptionFree')
                        : `${selectedPlan?.price.toFixed(2) ?? ''} €`}
                      {selectedOption !== 'trial' && selectedPlan && (
                        <Text style={checkoutStyles.summaryCycle}> / {cyclePriceUnit(selectedPlan.billingCycle, t)}</Text>
                      )}
                    </Text>
                  </View>
                </View>
              )}

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
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginBottom: 8 }}>
                <Ionicons name="lock-closed-outline" size={13} color="#6B7280" />
                <Text style={{ fontSize: 12, color: '#6B7280' }}>{t('business.findTours.securePayment')}</Text>
              </View>
              <View style={{ minHeight: 400, width: '100%' }}>
                <EmbeddedCheckoutProvider
                  stripe={getStripePromise()}
                  options={{ clientSecret, onComplete: handleComplete }}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </View>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setStep('plan-picker')} activeOpacity={0.8}>
                <Text style={styles.modalCancelText}>{t('business.findTours.backToPlans')}</Text>
              </TouchableOpacity>
            </>
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

  const [search, setSearch]     = useState('');
  const [tours, setTours]       = useState<TourWithSlots[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [businesses, setBusinesses]               = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness]   = useState<Business | null>(null);
  const [bizPickerVisible, setBizPickerVisible]   = useState(false);

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentPromos, setCurrentPromos] = useState<BusinessPromotion[]>([]);

  const [slotTour, setSlotTour]           = useState<TourWithSlots | null>(null);
  const [slotModalVisible, setSlotModalVisible] = useState(false);
  const [addError, setAddError]           = useState<string | null>(null);

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

  const handleOpenSlotModal = (tour: TourWithSlots) => {
    if (!selectedBusiness) return;
    setSlotTour(tour);
    setAddError(null);
    setSlotModalVisible(true);
  };

  const handleSelectSlot = (targetType: PromotionTargetType, targetId: string) => {
    if (!selectedBusiness || !slotTour) return;
    setSlotModalVisible(false);
    setPendingSlot({
      tourTitle: slotTour.tourTitle,
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
  };

  // Trial exhausted = user has ever created >= MAX_FREE_SLOTS promos (including expired)
  const trialEverExhausted = currentPromos.length >= MAX_FREE_SLOTS;
  const activePromoCount   = currentPromos.filter((p) => p.status !== 'expired').length;

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

      <View style={{ gap: 12, marginTop: 8 }}>
        {tours.map((tour) => {
          const totalSlots = (tour.hasDetailSlot ? 1 : 0) + tour.availableStepSlots.length;
          return (
            <View key={tour.tourId} style={styles.tourCard}>
              <View style={styles.tourCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tourTitle} numberOfLines={1}>{tour.tourTitle}</Text>
                  {tour.city && (
                    <View style={styles.cityRow}>
                      <Ionicons name="location-outline" size={13} color="#6B7280" />
                      <Text style={styles.cityText}>{tour.city}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.slotCountBadge}>
                  <Text style={styles.slotCountText}>{t('business.findTours.slots', { count: totalSlots })}</Text>
                </View>
              </View>

              <View style={styles.slotPillRow}>
                {tour.hasDetailSlot && (
                  <View style={styles.slotPill}>
                    <Ionicons name="map-outline" size={12} color={GREEN_DARK} />
                    <Text style={styles.slotPillText}>{t('business.findTours.typeTour')}</Text>
                  </View>
                )}
                {tour.availableStepSlots.slice(0, 3).map((s) => (
                  <View key={s.stepId} style={styles.slotPill}>
                    <Ionicons name="location-outline" size={12} color={GREEN_DARK} />
                    <Text style={styles.slotPillText}>{t('business.findTours.typeStep')} {s.order}</Text>
                  </View>
                ))}
                {tour.availableStepSlots.length > 3 && (
                  <View style={styles.slotPill}>
                    <Text style={styles.slotPillText}>+{tour.availableStepSlots.length - 3}</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[styles.addToTourBtn, !selectedBusiness && styles.addToTourBtnDisabled]}
                onPress={() => handleOpenSlotModal(tour)}
                disabled={!selectedBusiness}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={trialEverExhausted ? 'card-outline' : 'add-circle-outline'}
                  size={16}
                  color={selectedBusiness ? '#fff' : '#9CA3AF'}
                />
                <Text style={[styles.addToTourBtnText, !selectedBusiness && { color: '#9CA3AF' }]}>
                  {trialEverExhausted
                    ? t('business.findTours.advertiseWithSub')
                    : t('business.findTours.advertiseHere')}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {addError && (
        <View style={[styles.errorBox, { marginTop: 8 }]}>
          <Text style={styles.errorText}>{addError}</Text>
        </View>
      )}

      <SlotModal
        visible={slotModalVisible}
        tour={slotTour}
        currentPromos={currentPromos}
        businessId={selectedBusiness?.id ?? null}
        onSelectSlot={handleSelectSlot}
        onClose={() => { setSlotModalVisible(false); setAddError(null); }}
      />

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

  summaryBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 12,
    marginBottom: 12,
    width: '100%',
  },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  summaryPrice: { fontSize: 16, fontWeight: '700', color: GREEN_DARK },
  summaryCycle: { fontSize: 12, fontWeight: '400', color: '#6B7280' },

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
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB', padding: 14, gap: 10,
  },
  tourCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tourTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  cityText: { fontSize: 12, color: '#6B7280' },
  slotCountBadge: {
    backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1, borderColor: '#A7F3D0',
  },
  slotCountText: { fontSize: 12, fontWeight: '600', color: GREEN_DARK },
  slotPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slotPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F0FDF4', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#BBF7D0',
  },
  slotPillText: { fontSize: 11, fontWeight: '600', color: GREEN_DARK },
  addToTourBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: GREEN, borderRadius: 10, paddingVertical: 10,
  },
  addToTourBtnDisabled: { backgroundColor: '#F3F4F6' },
  addToTourBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

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
  slotBtnDisabled: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
  slotBtnTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  slotBtnTitleDisabled: { color: '#9CA3AF' },
  slotBtnHint: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  occupiedBadge: {
    backgroundColor: '#FEE2E2', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2,
  },
  occupiedBadgeText: { fontSize: 11, fontWeight: '600', color: '#DC2626' },
  mineBadge: {
    backgroundColor: '#ECFDF5', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2,
  },
  mineBadgeText: { fontSize: 11, fontWeight: '600', color: GREEN_DARK },

  modalCancelBtn: {
    alignItems: 'center', paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#E5E7EB', width: '100%',
  },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
});
