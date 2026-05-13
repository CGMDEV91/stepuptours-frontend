// app/[langcode]/donations.tsx
// Página "Mis donaciones" para usuarios regulares (no guides/business/admin).
// Auth-protected: redirige a la home del idioma si no hay sesión.

import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/auth.store';
import { MyDonationsTab } from '../../components/dashboard/MyDonationsTab';
import PageBanner from '../../components/layout/PageBanner';
import Footer from '../../components/layout/Footer';
import { PageScrollView } from '../../components/layout/PageScrollView';
import { webFullHeight } from '../../lib/web-styles';

const AMBER = '#F59E0B';
const CONTENT_MAX_WIDTH = 900;

export default function DonationsScreen() {
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (!user && !isAuthLoading) {
      const timer = setTimeout(() => {
        router.replace(`/${langcode}` as any);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user, isAuthLoading, langcode]);

  if (isAuthLoading || !user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  return (
    <PageScrollView style={styles.root} contentContainerStyle={styles.scrollContent}>
      <PageBanner
        icon="gift-outline"
        iconBgColor={AMBER}
        title={t('nav.myDonations')}
        subtitle={t('dashboard.myDonations.subtitle')}
      />
      <View style={styles.body}>
        <MyDonationsTab />
      </View>
      <Footer />
    </PageScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    ...webFullHeight,
  },
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    flex: 1,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
});
