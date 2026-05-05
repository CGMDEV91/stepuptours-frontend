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
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

// ── Slot picker modal ─────────────────────────────────────────────────────────

interface SlotModalProps {
  visible: boolean;
  tour: TourWithSlots | null;
  onSelectSlot: (targetType: PromotionTargetType, targetId: string) => void;
  onClose: () => void;
  adding: boolean;
}

function SlotModal({ visible, tour, onSelectSlot, onClose, adding }: SlotModalProps) {
  if (!tour) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalBox} onPress={() => {}}>
          <Text style={styles.modalTitle}>Selecciona dónde publicitarte</Text>
          <Text style={styles.modalSubtitle} numberOfLines={2}>{tour.tourTitle}</Text>

          {tour.hasDetailSlot && (
            <TouchableOpacity
              style={styles.slotBtn}
              onPress={() => onSelectSlot('tour_detail', tour.tourId)}
              disabled={adding}
              activeOpacity={0.8}
            >
              <Ionicons name="map-outline" size={20} color={GREEN_DARK} />
              <View style={{ flex: 1 }}>
                <Text style={styles.slotBtnTitle}>Página del tour</Text>
                <Text style={styles.slotBtnHint}>Aparece en la descripción principal del tour</Text>
              </View>
              {adding
                ? <ActivityIndicator size="small" color={GREEN} />
                : <Ionicons name="add-circle-outline" size={22} color={GREEN} />}
            </TouchableOpacity>
          )}

          {tour.availableStepSlots.map((step) => (
            <TouchableOpacity
              key={step.stepId}
              style={styles.slotBtn}
              onPress={() => onSelectSlot('tour_step', step.stepId)}
              disabled={adding}
              activeOpacity={0.8}
            >
              <Ionicons name="location-outline" size={20} color={GREEN_DARK} />
              <View style={{ flex: 1 }}>
                <Text style={styles.slotBtnTitle}>Paso {step.order}: {step.stepTitle}</Text>
                <Text style={styles.slotBtnHint}>Aparece en este paso del tour</Text>
              </View>
              {adding
                ? <ActivityIndicator size="small" color={GREEN} />
                : <Ionicons name="add-circle-outline" size={22} color={GREEN} />}
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.modalCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Plan + checkout modal (cuando trial agotado) ──────────────────────────────

type CheckoutStep = 'plan-picker' | 'loading' | 'checkout' | 'confirming' | 'error';

interface SlotCheckoutModalProps {
  visible: boolean;
  slotData: { tourTitle: string; targetType: PromotionTargetType; targetId: string; businessId: string } | null;
  plans: SubscriptionPlan[];
  onSuccess: (promo: BusinessPromotion) => void;
  onClose: () => void;
}

function SlotCheckoutModal({ visible, slotData, plans, onSuccess, onClose }: SlotCheckoutModalProps) {
  const [step, setStep]                   = useState<CheckoutStep>('plan-picker');
  const [selectedPlan, setSelectedPlan]   = useState<SubscriptionPlan | null>(null);
  const [clientSecret, setClientSecret]   = useState<string | null>(null);
  const [sessionId, setSessionId]         = useState<string | null>(null);
  const [error, setError]                 = useState('');

  // Reset on open
  useEffect(() => {
    if (visible) {
      setStep('plan-picker');
      setSelectedPlan(plans.length > 0 ? plans[0] : null);
      setClientSecret(null);
      setSessionId(null);
      setError('');
    }
  }, [visible, plans]);

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
      setError(err?.response?.data?.error ?? err.message ?? 'Error al iniciar el pago.');
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
        setError('El pago no se completó. Inténtalo de nuevo.');
        setStep('error');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error al confirmar la promoción.');
      setStep('error');
    }
  };

  if (!visible || !slotData) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={step === 'plan-picker' ? onClose : undefined}>
        <Pressable style={[styles.modalBox, step === 'checkout' && styles.modalBoxWide]} onPress={() => {}}>

          {/* Plan picker */}
          {step === 'plan-picker' && (
            <>
              <View style={styles.checkoutHeader}>
                <Ionicons name="megaphone-outline" size={28} color={GREEN} />
              </View>
              <Text style={styles.modalTitle}>Elige tu plan de publicidad</Text>
              <Text style={styles.modalSubtitle} numberOfLines={2}>{slotData.tourTitle}</Text>

              <View style={{ gap: 10, width: '100%' }}>
                {plans.map((plan) => {
                  const isSelected = selectedPlan?.id === plan.id;
                  return (
                    <TouchableOpacity
                      key={plan.id}
                      style={[styles.planCard, isSelected && styles.planCardSelected]}
                      onPress={() => setSelectedPlan(plan)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planCardTitle}>{plan.title}</Text>
                        <Text style={styles.planCardCycle}>
                          {plan.billingCycle === 'monthly' ? 'Mensual' : 'Anual'}
                          {plan.billingCycle === 'annual' && (
                            <Text style={styles.planCardSaving}> · Ahorra 99€</Text>
                          )}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.planCardPrice, isSelected && { color: GREEN_DARK }]}>
                          {plan.price.toFixed(2)} €
                        </Text>
                        <Text style={styles.planCardPriceUnit}>
                          / {plan.billingCycle === 'monthly' ? 'mes' : 'año'}
                        </Text>
                      </View>
                      <View style={[styles.planRadio, isSelected && styles.planRadioSelected]}>
                        {isSelected && <View style={styles.planRadioDot} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.checkoutBtn, !selectedPlan && { opacity: 0.5 }]}
                onPress={handleStartCheckout}
                disabled={!selectedPlan}
                activeOpacity={0.85}
              >
                <Ionicons name="card-outline" size={18} color="#fff" />
                <Text style={styles.checkoutBtnText}>
                  Pagar {selectedPlan ? `${selectedPlan.price.toFixed(2)} €` : ''}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Loading checkout session */}
          {step === 'loading' && (
            <>
              <ActivityIndicator size="large" color={GREEN} style={{ marginVertical: 32 }} />
              <Text style={{ color: '#6B7280', textAlign: 'center' }}>Preparando el pago…</Text>
            </>
          )}

          {/* Stripe EmbeddedCheckout */}
          {step === 'checkout' && clientSecret && Platform.OS === 'web' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginBottom: 8 }}>
                <Ionicons name="lock-closed-outline" size={13} color="#6B7280" />
                <Text style={{ fontSize: 12, color: '#6B7280' }}>Pago seguro con Stripe</Text>
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
                <Text style={styles.modalCancelText}>← Volver a planes</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Checkout en nativo (no disponible) */}
          {step === 'checkout' && Platform.OS !== 'web' && (
            <>
              <Ionicons name="phone-portrait-outline" size={40} color="#9CA3AF" style={{ alignSelf: 'center', marginVertical: 16 }} />
              <Text style={{ color: '#6B7280', textAlign: 'center', paddingHorizontal: 16 }}>
                El pago está disponible en la versión web.
              </Text>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.modalCancelText}>Cerrar</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Confirmando */}
          {step === 'confirming' && (
            <>
              <ActivityIndicator size="large" color={GREEN} style={{ marginVertical: 32 }} />
              <Text style={{ color: '#6B7280', textAlign: 'center' }}>Activando tu slot publicitario…</Text>
            </>
          )}

          {/* Error */}
          {step === 'error' && (
            <>
              <View style={{ alignItems: 'center', marginVertical: 16 }}>
                <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
              </View>
              <Text style={{ color: '#DC2626', textAlign: 'center', marginBottom: 16 }}>{error}</Text>
              <TouchableOpacity style={styles.checkoutBtn} onPress={() => setStep('plan-picker')} activeOpacity={0.85}>
                <Text style={styles.checkoutBtnText}>Volver a intentarlo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
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
  const { width } = useWindowDimensions();

  const [search, setSearch]     = useState('');
  const [tours, setTours]       = useState<TourWithSlots[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [businesses, setBusinesses]               = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness]   = useState<Business | null>(null);
  const [bizPickerVisible, setBizPickerVisible]   = useState(false);

  // Planes cargados una sola vez
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);

  // Estado trial: promotions activas
  const [currentPromos, setCurrentPromos] = useState<BusinessPromotion[]>([]);

  // Modal selección de slot (trial)
  const [slotTour, setSlotTour]           = useState<TourWithSlots | null>(null);
  const [slotModalVisible, setSlotModalVisible] = useState(false);
  const [adding, setAdding]               = useState(false);
  const [addError, setAddError]           = useState<string | null>(null);

  // Modal checkout (cuando trial agotado)
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
      setError('Error al buscar tours. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchTours(search), 400);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search, searchTours]);

  const handleOpenSlotModal = (tour: TourWithSlots) => {
    if (!selectedBusiness) return;
    const activePromos = currentPromos.filter((p) => p.status !== 'expired');
    if (activePromos.length >= MAX_FREE_SLOTS) {
      // Trial agotado → abrir checkout modal (necesitamos saber qué slot)
      // Guardamos el tour para que el usuario elija dentro del SlotCheckoutModal
      // simplificación: abrimos slot picker primero y luego checkout
      setSlotTour(tour);
      setAddError(null);
      setSlotModalVisible(true);
    } else {
      setSlotTour(tour);
      setAddError(null);
      setSlotModalVisible(true);
    }
  };

  const handleSelectSlot = async (targetType: PromotionTargetType, targetId: string) => {
    if (!selectedBusiness || !slotTour) return;
    const activePromos = currentPromos.filter((p) => p.status !== 'expired');

    // Trial disponible → añadir gratis
    if (activePromos.length < MAX_FREE_SLOTS) {
      setAdding(true);
      setAddError(null);
      try {
        const newPromo = await addPromotion({
          businessId: selectedBusiness.id,
          targetType,
          targetId,
        });
        setCurrentPromos((prev) => [...prev, newPromo]);
        setSlotModalVisible(false);
        await searchTours(search);
      } catch (err: any) {
        const code = err?.response?.data?.error;
        if (code === 'TRIAL_LIMIT_REACHED') {
          // Race condition: abrimos checkout en su lugar
          setSlotModalVisible(false);
          setPendingSlot({ tourTitle: slotTour.tourTitle, targetType, targetId, businessId: selectedBusiness.id });
          setCheckoutModalVisible(true);
        } else {
          setAddError('Error al añadir el slot. Inténtalo de nuevo.');
        }
      } finally {
        setAdding(false);
      }
    } else {
      // Trial agotado → checkout
      setSlotModalVisible(false);
      setPendingSlot({ tourTitle: slotTour.tourTitle, targetType, targetId, businessId: selectedBusiness.id });
      setCheckoutModalVisible(true);
    }
  };

  const handleCheckoutSuccess = async (promo: BusinessPromotion) => {
    setCurrentPromos((prev) => [...prev, promo]);
    setCheckoutModalVisible(false);
    setPendingSlot(null);
    await searchTours(search);
  };

  const activePromoCount = currentPromos.filter((p) => p.status !== 'expired').length;

  return (
    <View>
      {/* Selector de negocio */}
      {businesses.length > 1 && (
        <View style={styles.bizSelector}>
          <Text style={styles.bizSelectorLabel}>Publicitar como:</Text>
          <TouchableOpacity
            style={styles.bizSelectorBtn}
            onPress={() => setBizPickerVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.bizSelectorBtnText} numberOfLines={1}>
              {selectedBusiness?.name ?? 'Selecciona un negocio'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

      {/* Banner trial */}
      <View style={[styles.trialBanner, activePromoCount >= MAX_FREE_SLOTS && styles.trialBannerFull]}>
        <Ionicons
          name={activePromoCount >= MAX_FREE_SLOTS ? 'warning-outline' : 'information-circle-outline'}
          size={16}
          color={activePromoCount >= MAX_FREE_SLOTS ? '#92400E' : '#065F46'}
        />
        <Text style={[styles.trialText, activePromoCount >= MAX_FREE_SLOTS && styles.trialTextFull]}>
          {activePromoCount >= MAX_FREE_SLOTS
            ? `Trial agotado (${activePromoCount}/${MAX_FREE_SLOTS} slots). Los nuevos slots requieren suscripción (29€/mes o 249€/año).`
            : `Plan gratuito: ${activePromoCount}/${MAX_FREE_SLOTS} slots usados · 7 días de prueba · sin tarjeta`}
        </Text>
      </View>

      {/* Buscador */}
      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchField}
            placeholder="Buscar tours por nombre o ciudad..."
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
          <Text style={styles.emptyTitle}>No se encontraron tours</Text>
          <Text style={styles.emptySubtitle}>Prueba a buscar por nombre de tour o ciudad.</Text>
        </View>
      )}

      {/* Lista de tours */}
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
                  <Text style={styles.slotCountText}>{totalSlots} slots</Text>
                </View>
              </View>

              <View style={styles.slotPillRow}>
                {tour.hasDetailSlot && (
                  <View style={styles.slotPill}>
                    <Ionicons name="map-outline" size={12} color={GREEN_DARK} />
                    <Text style={styles.slotPillText}>Tour</Text>
                  </View>
                )}
                {tour.availableStepSlots.slice(0, 3).map((s) => (
                  <View key={s.stepId} style={styles.slotPill}>
                    <Ionicons name="location-outline" size={12} color={GREEN_DARK} />
                    <Text style={styles.slotPillText}>Paso {s.order}</Text>
                  </View>
                ))}
                {tour.availableStepSlots.length > 3 && (
                  <View style={styles.slotPill}>
                    <Text style={styles.slotPillText}>+{tour.availableStepSlots.length - 3} más</Text>
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
                  name={activePromoCount >= MAX_FREE_SLOTS ? 'card-outline' : 'add-circle-outline'}
                  size={16}
                  color={selectedBusiness ? '#fff' : '#9CA3AF'}
                />
                <Text style={[styles.addToTourBtnText, !selectedBusiness && { color: '#9CA3AF' }]}>
                  {activePromoCount >= MAX_FREE_SLOTS ? 'Publicitar (con suscripción)' : 'Publicitar aquí'}
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

      {/* Modal selección de slot */}
      <SlotModal
        visible={slotModalVisible}
        tour={slotTour}
        onSelectSlot={handleSelectSlot}
        onClose={() => { setSlotModalVisible(false); setAddError(null); }}
        adding={adding}
      />

      {/* Modal checkout (plan picker + Stripe) */}
      <SlotCheckoutModal
        visible={checkoutModalVisible}
        slotData={pendingSlot}
        plans={plans}
        onSuccess={handleCheckoutSuccess}
        onClose={() => { setCheckoutModalVisible(false); setPendingSlot(null); }}
      />

      {/* Business picker */}
      {bizPickerVisible && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setBizPickerVisible(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setBizPickerVisible(false)}>
            <Pressable style={styles.modalBox} onPress={() => {}}>
              <Text style={styles.modalTitle}>Selecciona tu negocio</Text>
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

  // Modales
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalBox: {
    width: '100%', maxWidth: 420, backgroundColor: '#fff',
    borderRadius: 20, padding: 24, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16, shadowRadius: 24, elevation: 10,
  },
  modalBoxWide: { maxWidth: 600 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: -4 },

  slotBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderRadius: 12, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#A7F3D0',
  },
  slotBtnSelected: { borderColor: GREEN, backgroundColor: '#ECFDF5' },
  slotBtnTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  slotBtnHint: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  modalCancelBtn: {
    alignItems: 'center', paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#E5E7EB', marginTop: 4,
  },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },

  // Checkout modal
  checkoutHeader: { alignItems: 'center', paddingVertical: 4 },
  planCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff',
  },
  planCardSelected: { borderColor: GREEN, backgroundColor: '#ECFDF5' },
  planCardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  planCardCycle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  planCardSaving: { color: GREEN_DARK, fontWeight: '600' },
  planCardPrice: { fontSize: 16, fontWeight: '700', color: '#374151' },
  planCardPriceUnit: { fontSize: 11, color: '#9CA3AF' },
  planRadio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center',
  },
  planRadioSelected: { borderColor: GREEN },
  planRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: GREEN },
  checkoutBtn: {
    backgroundColor: GREEN, borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  checkoutBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
