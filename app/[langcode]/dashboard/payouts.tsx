// app/[langcode]/dashboard/payouts.tsx
// Stripe Connect Express onboarding & dashboard for guides.

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../stores/auth.store';
import { PageScrollView } from '../../../components/layout/PageScrollView';
import PageBanner from '../../../components/layout/PageBanner';
import Footer from '../../../components/layout/Footer';
import {
  startOnboarding,
  getOnboardStatus,
  getStripeDashboardUrl,
} from '../../../services/payouts.service';
import { webFullHeight } from '../../../lib/web-styles';
import type { StripeOnboardStatus } from '../../../types';

const AMBER = '#F59E0B';
const CONTENT_MAX_WIDTH = 900;

export default function PayoutsScreen() {
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const user = useAuthStore((s) => s.user);

  const [status, setStatus] = useState<StripeOnboardStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const s = await getOnboardStatus();
      setStatus(s);
    } catch {
      setError(t('payouts.errorLoadStatus', 'Could not load payout status. Please try again.'));
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
    } catch {
      setError(t('payouts.errorOnboarding', 'Could not start Stripe setup. Please try again.'));
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
      setError(t('payouts.errorDashboard', 'Could not open Stripe dashboard. Please try again.'));
    } finally {
      setWorking(false);
    }
  };

  const isComplete = status?.onboardingComplete ?? false;
  const hasAccount = !!status?.stripeAccountId;
  const contentPad = width > CONTENT_MAX_WIDTH ? 0 : 16;

  return (
    <View style={[styles.root, webFullHeight]}>
      <PageBanner />
      <PageScrollView>
        <View style={[styles.content, { paddingHorizontal: contentPad }]}>
          <View style={styles.inner}>

            {/* Header */}
            <View style={styles.header}>
              <Ionicons name="wallet-outline" size={28} color={AMBER} />
              <View style={styles.headerText}>
                <Text style={styles.title}>{t('payouts.title', 'Payouts')}</Text>
                <Text style={styles.subtitle}>
                  {t('payouts.subtitle', 'Receive your guide earnings directly to your bank account via Stripe.')}
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

            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={AMBER} />
              </View>
            ) : isComplete ? (
              <CompleteState
                working={working}
                onOpenDashboard={handleOpenDashboard}
                t={t}
              />
            ) : (
              <PendingState
                hasAccount={hasAccount}
                working={working}
                onStart={handleStartOnboarding}
                onRefresh={loadStatus}
                t={t}
              />
            )}

          </View>
        </View>
      </PageScrollView>
      <Footer />
    </View>
  );
}

// ── Onboarding complete ────────────────────────────────────────────────────────

function CompleteState({
  working,
  onOpenDashboard,
  t,
}: {
  working: boolean;
  onOpenDashboard: () => void;
  t: (key: string, fallback: string) => string;
}) {
  return (
    <View>
      <View style={styles.successBox}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={32} color="#16A34A" />
        </View>
        <View style={styles.successText}>
          <Text style={styles.successTitle}>
            {t('payouts.completeTitle', 'Payouts configured')}
          </Text>
          <Text style={styles.successDesc}>
            {t(
              'payouts.completeDesc',
              'Stripe will automatically transfer your earnings to your bank account after each donation.',
            )}
          </Text>
        </View>
      </View>

      <InfoRow
        icon="flash-outline"
        text={t('payouts.infoAutomatic', 'Transfers are sent automatically — no action needed from you.')}
      />
      <InfoRow
        icon="shield-checkmark-outline"
        text={t('payouts.infoSecure', 'Stripe handles all compliance and security.')}
      />
      <InfoRow
        icon="receipt-outline"
        text={t('payouts.infoDashboard', 'View your balance, history, and tax documents in your Stripe dashboard.')}
      />

      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={onOpenDashboard}
        disabled={working}
        activeOpacity={0.85}
      >
        {working ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="open-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>
              {t('payouts.openDashboard', 'Open Stripe Dashboard')}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ── Onboarding pending ─────────────────────────────────────────────────────────

function PendingState({
  hasAccount,
  working,
  onStart,
  onRefresh,
  t,
}: {
  hasAccount: boolean;
  working: boolean;
  onStart: () => void;
  onRefresh: () => void;
  t: (key: string, fallback: string) => string;
}) {
  return (
    <View>
      <View style={styles.warningBox}>
        <Ionicons name="information-circle-outline" size={20} color="#92400E" style={{ marginTop: 2 }} />
        <Text style={styles.warningText}>
          {t(
            'payouts.pendingDesc',
            'Connect your bank account via Stripe to start receiving earnings from donations. This is a one-time process managed securely by Stripe.',
          )}
        </Text>
      </View>

      <InfoRow
        icon="person-outline"
        text={t('payouts.infoIdentity', 'Stripe will verify your identity and bank account details.')}
      />
      <InfoRow
        icon="time-outline"
        text={t('payouts.infoOnce', 'Setup takes about 5 minutes and only needs to be done once.')}
      />
      <InfoRow
        icon="lock-closed-outline"
        text={t('payouts.infoPrivacy', 'Your banking details are stored securely by Stripe, not by StepUp Tours.')}
      />

      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={onStart}
        disabled={working}
        activeOpacity={0.85}
      >
        {working ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="card-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>
              {hasAccount
                ? t('payouts.continueSetup', 'Continue setup')
                : t('payouts.startSetup', 'Set up payouts')}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {hasAccount && (
        <TouchableOpacity style={styles.secondaryBtn} onPress={onRefresh} disabled={working}>
          <Ionicons name="refresh-outline" size={16} color={AMBER} style={{ marginRight: 6 }} />
          <Text style={styles.secondaryBtnText}>
            {t('payouts.checkStatus', 'Check status')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Info row ───────────────────────────────────────────────────────────────────

function InfoRow({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={AMBER} style={{ marginTop: 2 }} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 32,
  },
  inner: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 28,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  centered: {
    alignItems: 'center',
    paddingVertical: 60,
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
  successIcon: {
    marginTop: 2,
  },
  successText: {
    flex: 1,
  },
  successTitle: {
    fontSize: 15,
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
    marginBottom: 12,
    paddingHorizontal: 4,
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
    paddingVertical: 14,
    marginTop: 24,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AMBER,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 10,
  },
  secondaryBtnText: {
    color: AMBER,
    fontSize: 14,
    fontWeight: '500',
  },
});
