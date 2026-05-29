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
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as ExpoLinking from 'expo-linking';
import {
  startOnboarding,
  getOnboardStatus,
  getStripeDashboardUrl,
  getPayouts,
  StripeNotConfiguredError,
} from '../../services/payouts.service';
import type { StripeOnboardStatus, Payout } from '../../types';
import { formatDateTime } from '../../lib/date-format';

const AMBER = '#F59E0B';

const STATUS: Record<Payout['status'], { bg: string; fg: string; dot: string; key: string; def: string }> = {
  succeeded: { bg: '#ECFDF3', fg: '#15803D', dot: '#16A34A', key: 'payouts.statusSuccess', def: 'Exitoso' },
  pending:   { bg: '#FFFAEB', fg: '#B45309', dot: '#F59E0B', key: 'payouts.statusPending', def: 'Pendiente' },
  failed:    { bg: '#FEF3F2', fg: '#DC2626', dot: '#EF4444', key: 'payouts.statusFailed', def: 'Fallido' },
};

export function PayoutsTab() {
  const { t } = useTranslation();

  const [status, setStatus]         = useState<StripeOnboardStatus | null>(null);
  const [payouts, setPayouts]       = useState<Payout[]>([]);
  const [loading, setLoading]       = useState(true);
  const [working, setWorking]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [s, p] = await Promise.all([getOnboardStatus(), getPayouts()]);
      setStatus(s);
      setPayouts(p);
    } catch {
      setError(t('payouts.errorLoadStatus', 'No se pudo cargar el estado de pagos. Inténtalo de nuevo.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadStatus(); }, [loadStatus]));

  const handleStartOnboarding = async () => {
    setWorking(true);
    setError(null);
    try {
      const returnUrl = Platform.OS === 'web'
        ? window.location.href
        : ExpoLinking.createURL('/dashboard');
      const result = await startOnboarding(returnUrl, returnUrl);
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

      {/* Earnings table */}
      <View style={styles.listSection}>
        <Text style={styles.listTitle}>{t('payouts.listTitle', 'Tus cobros')}</Text>
        {payouts.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="cash-outline" size={22} color="#9CA3AF" />
            <Text style={styles.emptyText}>{t('payouts.empty', 'Aún no has recibido cobros.')}</Text>
          </View>
        ) : (
          payouts.map((p) => <PayoutRow key={p.id} payout={p} />)
        )}
      </View>
    </View>
  );
}

function PayoutRow({ payout }: { payout: Payout }) {
  const { t } = useTranslation();
  const s = STATUS[payout.status] ?? STATUS.pending;
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTour} numberOfLines={1}>{payout.tourTitle || '—'}</Text>
        <View style={[styles.badge, { backgroundColor: s.bg }]}>
          <View style={[styles.badgeDot, { backgroundColor: s.dot }]} />
          <Text style={[styles.badgeText, { color: s.fg }]}>{t(s.key, s.def)}</Text>
        </View>
      </View>

      <View style={styles.amounts}>
        <Text style={styles.receiveLabel}>{t('payouts.youReceive', 'Recibes')}</Text>
        <Text style={styles.receiveValue}>{payout.guideRevenue.toFixed(2)} {payout.currency}</Text>
        <Text style={styles.grossText}>
          · {t('payouts.gross', 'Donación')} {payout.amount.toFixed(2)} {payout.currency}
        </Text>
      </View>

      {payout.status === 'failed' && payout.failureReason ? (
        <Text style={styles.reason}>
          {t('payouts.reasonLabel', 'Motivo')}: {payout.failureReason}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        {payout.donorName ? (
          <>
            <Text style={styles.metaText}>{payout.donorName}</Text>
            <Text style={styles.metaText}>·</Text>
          </>
        ) : null}
        <Text style={styles.metaText}>{formatDateTime(payout.createdAt)}</Text>
      </View>
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
  listSection: {
    marginTop: 28,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 22,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 22,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  row: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  rowTour: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  amounts: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
  },
  receiveLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  receiveValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#15803D',
  },
  grossText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  reason: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 8,
    lineHeight: 17,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  metaText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
});
