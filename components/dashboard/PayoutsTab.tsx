// components/dashboard/PayoutsTab.tsx
// Stripe Connect Express onboarding & dashboard for guides.

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import {
  startOnboarding,
  getOnboardStatus,
  getStripeDashboardUrl,
  NoProfileError,
  StripeNotConfiguredError,
} from '../../services/payouts.service';
import type { StripeOnboardStatus } from '../../types';

const AMBER = '#F59E0B';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';

interface PayoutsTabProps {
  onGoToPayment: () => void;
}

export function PayoutsTab({ onGoToPayment }: PayoutsTabProps) {
  const { t } = useTranslation();

  const [status, setStatus]         = useState<StripeOnboardStatus | null>(null);
  const [noProfile, setNoProfile]   = useState(false);
  const [loading, setLoading]       = useState(true);
  const [working, setWorking]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setNoProfile(false);
      const s = await getOnboardStatus();
      setStatus(s);
    } catch (err) {
      if (err instanceof NoProfileError) {
        setNoProfile(true);
      } else {
        setError(t('payouts.errorLoadStatus', 'No se pudo cargar el estado de pagos. Inténtalo de nuevo.'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(loadStatus);

  const handleStartOnboarding = async () => {
    setWorking(true);
    setError(null);
    try {
      const returnUrl  = `${BASE_URL}/stripe-return`;
      const refreshUrl = `${BASE_URL}/stripe-refresh`;
      const result = await startOnboarding(returnUrl, refreshUrl);
      await Linking.openURL(result.onboardingUrl);
    } catch (err) {
      if (err instanceof StripeNotConfiguredError) {
        setError(t('payouts.errorStripeNotConfigured', 'Stripe no está configurado en el servidor. Contacta con el administrador.'));
      } else {
        setError(t('payouts.errorOnboarding', 'No se pudo iniciar la configuración de Stripe. Inténtalo de nuevo.'));
      }
    } finally {
      setWorking(false);
    }
  };

  const handleOpenDashboard = async () => {
    setWorking(true);
    setError(null);
    try {
      const url = await getStripeDashboardUrl();
      await Linking.openURL(url);
    } catch {
      setError(t('payouts.errorDashboard', 'No se pudo abrir el panel de Stripe. Inténtalo de nuevo.'));
    } finally {
      setWorking(false);
    }
  };

  const isComplete = status?.onboardingComplete ?? false;
  const hasAccount = !!status?.stripeAccountId;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  if (noProfile) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Ionicons name="wallet-outline" size={22} color={AMBER} />
          <View style={styles.headerText}>
            <Text style={styles.title}>{t('payouts.title', 'Cobros')}</Text>
            <Text style={styles.subtitle}>
              {t('payouts.subtitle', 'Recibe tus ganancias como guía directamente en tu cuenta bancaria a través de Stripe.')}
            </Text>
          </View>
        </View>
        <View style={styles.warningBox}>
          <Ionicons name="alert-circle-outline" size={20} color="#92400E" style={{ marginTop: 2 }} />
          <Text style={styles.warningText}>
            {t('payouts.noProfileDesc', 'Para configurar tus cobros primero debes completar tus datos de pago (nombre, IBAN y dirección fiscal).')}
          </Text>
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={onGoToPayment} activeOpacity={0.85}>
          <Ionicons name="card-outline" size={17} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.primaryBtnText}>
            {t('payouts.goToPaymentData', 'Completar datos de pago')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>

      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="wallet-outline" size={22} color={AMBER} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('payouts.title', 'Cobros')}</Text>
          <Text style={styles.subtitle}>
            {t('payouts.subtitle', 'Recibe tus ganancias como guía directamente en tu cuenta bancaria a través de Stripe.')}
          </Text>
        </View>
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {isComplete ? (
        <>
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={28} color="#16A34A" />
            <View style={styles.successText}>
              <Text style={styles.successTitle}>
                {t('payouts.completeTitle', 'Pagos configurados')}
              </Text>
              <Text style={styles.successDesc}>
                {t('payouts.completeDesc', 'Stripe transferirá tu parte automáticamente después de cada donación.')}
              </Text>
            </View>
          </View>

          <InfoRow icon="flash-outline"           text={t('payouts.infoAutomatic', 'Las transferencias son automáticas, sin acción por tu parte.')} />
          <InfoRow icon="shield-checkmark-outline" text={t('payouts.infoSecure',    'Stripe gestiona toda la seguridad y el cumplimiento normativo.')} />
          <InfoRow icon="receipt-outline"          text={t('payouts.infoDashboard', 'Consulta tu saldo, historial y documentos fiscales en tu panel de Stripe.')} />

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleOpenDashboard}
            disabled={working}
            activeOpacity={0.85}
          >
            {working ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="open-outline" size={17} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>
                  {t('payouts.openDashboard', 'Abrir panel de Stripe')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={styles.warningBox}>
            <Ionicons name="information-circle-outline" size={20} color="#92400E" style={{ marginTop: 2 }} />
            <Text style={styles.warningText}>
              {t('payouts.pendingDesc', 'Conecta tu cuenta bancaria con Stripe para empezar a recibir tus ganancias de las donaciones. Es un proceso único gestionado de forma segura por Stripe.')}
            </Text>
          </View>

          <InfoRow icon="person-outline"    text={t('payouts.infoIdentity', 'Stripe verificará tu identidad y los datos de tu cuenta bancaria.')} />
          <InfoRow icon="time-outline"      text={t('payouts.infoOnce',     'La configuración tarda unos 5 minutos y solo hay que hacerla una vez.')} />
          <InfoRow icon="lock-closed-outline" text={t('payouts.infoPrivacy', 'Tus datos bancarios se almacenan de forma segura en Stripe, no en StepUp Tours.')} />

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleStartOnboarding}
            disabled={working}
            activeOpacity={0.85}
          >
            {working ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="card-outline" size={17} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>
                  {hasAccount
                    ? t('payouts.continueSetup', 'Continuar configuración')
                    : t('payouts.startSetup', 'Configurar cobros')}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {hasAccount && (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={loadStatus}
              disabled={working}
            >
              <Ionicons name="refresh-outline" size={15} color={AMBER} style={{ marginRight: 6 }} />
              <Text style={styles.secondaryBtnText}>
                {t('payouts.checkStatus', 'Comprobar estado')}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

function InfoRow({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={15} color={AMBER} style={{ marginTop: 2 }} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingBottom: 32,
  },
  centered: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 24,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
    lineHeight: 18,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  successText: {
    flex: 1,
  },
  successTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#15803D',
    marginBottom: 4,
  },
  successDesc: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 18,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AMBER,
    borderRadius: 10,
    paddingVertical: 13,
    marginTop: 20,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AMBER,
    borderRadius: 10,
    paddingVertical: 11,
    marginTop: 10,
  },
  secondaryBtnText: {
    color: AMBER,
    fontSize: 13,
    fontWeight: '500',
  },
});
