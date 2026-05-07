// app/[langcode]/dashboard.tsx
// Guide Dashboard — tab navigation for guide (and legacy professional) role only

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/auth.store';
import { MyToursTab } from '../../components/dashboard/MyToursTab';
import { SubscriptionTab } from '../../components/dashboard/SubscriptionTab';
import { PaymentDataTab } from '../../components/dashboard/PaymentDataTab';
import { DonationsTab } from '../../components/dashboard/DonationsTab';
import { PayoutsTab } from '../../components/dashboard/PayoutsTab';
import PageBanner from '../../components/layout/PageBanner';
import Footer from '../../components/layout/Footer';
import { PageScrollView } from '../../components/layout/PageScrollView';
import { webFullHeight } from '../../lib/web-styles';

const AMBER = '#F59E0B';
const CONTENT_MAX_WIDTH = 900;

type TabId = 'tours' | 'subscription' | 'payment' | 'donations' | 'payouts';

interface Tab {
  id: TabId;
  labelKey: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: 'subscription', labelKey: 'dashboard.tabs.subscription', icon: 'card-outline' },
  { id: 'tours',        labelKey: 'dashboard.tabs.tours',        icon: 'map-outline' },
  { id: 'payment',      labelKey: 'dashboard.tabs.payment',      icon: 'wallet-outline' },
  { id: 'donations',    labelKey: 'dashboard.tabs.donations',    icon: 'heart-outline' },
  { id: 'payouts',      labelKey: 'dashboard.tabs.payouts',      icon: 'cash-outline' },
];

const VALID_TABS: TabId[] = ['tours', 'subscription', 'payment', 'donations', 'payouts'];

function isValidTab(value: string): value is TabId {
  return VALID_TABS.includes(value as TabId);
}

export default function DashboardScreen() {
  const { langcode, tab: tabParam, toast: toastParam } = useLocalSearchParams<{
    langcode: string;
    tab?: string;
    toast?: string;
  }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);

  const initialTab: TabId = tabParam && isValidTab(tabParam) ? tabParam : 'subscription';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const scrollRef = useRef<ScrollView>(null);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    router.setParams({ tab });
  };

  // ── Scroll to top on mount + tab change ───────────────────────────────────
  useEffect(() => {
    // Prevent browser from restoring scroll position on page refresh (web only)
    if (typeof window !== 'undefined' && window.history?.scrollRestoration) {
      window.history.scrollRestoration = 'manual';
    }
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    // Second pass after async content renders
    const t = setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 80);
    return () => clearTimeout(t);
  }, [activeTab]);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!toastParam) return;

    // Resolve message: try i18n key `toast.<param>`, fall back to the raw value
    const i18nKey = `toast.${toastParam}`;
    const resolved = t(i18nKey);
    // i18next returns the key itself when no translation is found
    const message = resolved !== i18nKey ? resolved : toastParam;

    setToastMessage(message);

    // Fade in
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      // Hold visible for 2.5 s, then fade out
      toastTimeoutRef.current = setTimeout(() => {
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => setToastMessage(null));
      }, 2500);
    });

    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [toastParam]);

  // Compatibilidad temporal: 'professional' → 'guide' durante la transición de roles
  const isGuide =
    user?.roles?.includes('guide') || user?.roles?.includes('professional');

  useEffect(() => {
    if (!isAuthLoading && (!user || !isGuide)) {
      const timer = setTimeout(() => {
        router.replace(`/${langcode}` as any);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user, isAuthLoading, isGuide, langcode]);

  if (isAuthLoading || !user || !isGuide) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  // ── Tab bar mobile: columna vertical ─────────────────────────────────────
  const mobileTabBar = (
    <View style={styles.mobileTabBar}>
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.mobileTabItem, isActive && styles.mobileTabItemActive]}
            onPress={() => handleTabChange(tab.id)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={isActive ? '#FFFFFF' : '#6B7280'}
            />
            <Text style={[styles.mobileTabLabel, isActive && styles.mobileTabLabelActive]}>
              {t(tab.labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── Tab bar desktop: pills horizontales ───────────────────────────────────
  const desktopTabBar = (
    <View style={styles.tabBarWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabPill, isActive && styles.tabPillActive]}
              onPress={() => handleTabChange(tab.id)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={tab.icon as any}
                size={16}
                color={isActive ? '#FFFFFF' : '#6B7280'}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {t(tab.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const content = (
    <View style={isMobile
      ? { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 }
      : { maxWidth: CONTENT_MAX_WIDTH, width: '100%', alignSelf: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 }
    }>
      {activeTab === 'subscription' && <SubscriptionTab userId={user.id} onScrollTop={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} />}
      {activeTab === 'tours' && <MyToursTab userId={user.id} />}
      {activeTab === 'payment' && <PaymentDataTab userId={user.id} />}
      {activeTab === 'donations' && <DonationsTab userId={user.id} />}
      {activeTab === 'payouts' && <PayoutsTab onGoToPayment={() => handleTabChange('payment')} />}
    </View>
  );

  return (
    <View style={{ flex: 1, minHeight: 0, backgroundColor: '#F9FAFB', ...webFullHeight }}>
      {isMobile ? (
        // ── Mobile: banner + tabs + contenido en scroll único ────────────
        <PageScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flex: 1 }}>
            <PageBanner icon="grid-outline" iconBgColor="#F59E0B" title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} showBack={false} />
            {mobileTabBar}
            {content}
          </View>
          <Footer />
        </PageScrollView>
      ) : (
        // ── Desktop: pills sticky + contenido en scroll ───────────────────
        <>
          {desktopTabBar}
          <PageScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
            <View style={{ flex: 1 }}>
              <PageBanner icon="grid-outline" iconBgColor="#F59E0B" title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} showBack={false} />
              {content}
            </View>
            <Footer />
          </PageScrollView>
        </>
      )}

      {/* ── Toast notification ──────────────────────────────────────────── */}
      {toastMessage ? (
        <Animated.View
          style={[styles.toast, { opacity: toastOpacity }]}
          pointerEvents="none"
        >
          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },

  // ── Desktop tab bar ───────────────────────────────────────────────────────
  tabBarWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  tabPillActive: {
    backgroundColor: AMBER,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },

  // ── Mobile tab bar ────────────────────────────────────────────────────────
  mobileTabBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 4,
  },
  mobileTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  mobileTabItemActive: {
    backgroundColor: AMBER,
  },
  mobileTabLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  mobileTabLabelActive: {
    color: '#FFFFFF',
  },

  // ── Toast ─────────────────────────────────────────────────────────────────
  toast: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
    maxWidth: 360,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
