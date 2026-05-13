// app/[langcode]/business-dashboard.tsx
// Business Dashboard — panel exclusivo para usuarios con rol 'business'

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
import { MyBusinessesTab } from '../../components/business/MyBusinessesTab';
import { FindToursTab } from '../../components/business/FindToursTab';
import { MyPromotionsTab } from '../../components/business/MyPromotionsTab';
import { BillingTab } from '../../components/business/BillingTab';
import { MyDonationsTab } from '../../components/dashboard/MyDonationsTab';
import PageBanner from '../../components/layout/PageBanner';
import Footer from '../../components/layout/Footer';
import { PageScrollView } from '../../components/layout/PageScrollView';
import { webFullHeight } from '../../lib/web-styles';

const GREEN = '#10B981';
const CONTENT_MAX_WIDTH = 900;

type TabId = 'my-businesses' | 'find-tours' | 'my-promotions' | 'billing' | 'my-donations';

interface Tab {
  id: TabId;
  labelKey: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: 'my-businesses',  labelKey: 'businessDashboard.tabs.myBusinesses',  icon: 'storefront-outline' },
  { id: 'find-tours',     labelKey: 'businessDashboard.tabs.findTours',      icon: 'search-outline' },
  { id: 'my-promotions',  labelKey: 'businessDashboard.tabs.myPromotions',   icon: 'megaphone-outline' },
  { id: 'billing',        labelKey: 'businessDashboard.tabs.billing',        icon: 'receipt-outline' },
  { id: 'my-donations',   labelKey: 'businessDashboard.tabs.myDonations',    icon: 'gift-outline' },
];

const VALID_TABS: TabId[] = ['my-businesses', 'find-tours', 'my-promotions', 'billing', 'my-donations'];

function isValidTab(v: string): v is TabId {
  return VALID_TABS.includes(v as TabId);
}

export default function BusinessDashboardScreen() {
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

  const initialTab: TabId = tabParam && isValidTab(tabParam) ? tabParam : 'my-businesses';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const scrollRef = useRef<ScrollView>(null);

  // Scroll to top on tab change
  useEffect(() => {
    if (typeof window !== 'undefined' && window.history?.scrollRestoration) {
      window.history.scrollRestoration = 'manual';
    }
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    const timer = setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 80);
    return () => clearTimeout(timer);
  }, [activeTab]);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!toastParam) return;
    const i18nKey = `toast.${toastParam}`;
    const resolved = t(i18nKey);
    const message = resolved !== i18nKey ? resolved : toastParam;
    setToastMessage(message);

    Animated.timing(toastOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start(() => {
      toastTimeoutRef.current = setTimeout(() => {
        Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() =>
          setToastMessage(null)
        );
      }, 2500);
    });
    return () => { if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current); };
  }, [toastParam]);

  const isBusiness = user?.roles?.includes('business');

  useEffect(() => {
    if (!isAuthLoading && (!user || !isBusiness)) {
      const timer = setTimeout(() => {
        router.replace(`/${langcode}` as any);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user, isAuthLoading, isBusiness, langcode]);

  if (isAuthLoading || !user || !isBusiness) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  // ── Tab bar mobile ──────────────────────────────────────────────────────────
  const mobileTabBar = (
    <View style={styles.mobileTabBar}>
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.mobileTabItem, isActive && styles.mobileTabItemActive]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.8}
          >
            <Ionicons name={tab.icon as any} size={18} color={isActive ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.mobileTabLabel, isActive && styles.mobileTabLabelActive]}>
              {t(tab.labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── Tab bar desktop ─────────────────────────────────────────────────────────
  const desktopTabBar = (
    <View style={styles.tabBarWrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabPill, isActive && styles.tabPillActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.8}
            >
              <Ionicons name={tab.icon as any} size={16} color={isActive ? '#FFFFFF' : '#6B7280'} />
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
    <View style={isMobile ? { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 } : { maxWidth: CONTENT_MAX_WIDTH, width: '100%', alignSelf: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 }}>
      {activeTab === 'my-businesses'  && <MyBusinessesTab userId={user.id} />}
      {activeTab === 'find-tours'     && <FindToursTab userId={user.id} />}
      {activeTab === 'my-promotions'  && <MyPromotionsTab userId={user.id} />}
      {activeTab === 'billing'        && <BillingTab userId={user.id} />}
      {activeTab === 'my-donations'   && <MyDonationsTab />}
    </View>
  );

  return (
    <View style={{ flex: 1, minHeight: 0, backgroundColor: '#F9FAFB', ...webFullHeight }}>
      {isMobile ? (
        <PageScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flex: 1 }}>
            <PageBanner
              icon="storefront-outline"
              iconBgColor={GREEN}
              title={t('businessDashboard.title')}
              subtitle={t('businessDashboard.subtitle')}
              showBack={false}
            />
            {mobileTabBar}
            {content}
          </View>
          <Footer />
        </PageScrollView>
      ) : (
        <>
          {desktopTabBar}
          <PageScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
            <View style={{ flex: 1 }}>
              <PageBanner
                icon="storefront-outline"
                iconBgColor={GREEN}
                title={t('businessDashboard.title')}
                subtitle={t('businessDashboard.subtitle')}
                showBack={false}
              />
              {content}
            </View>
            <Footer />
          </PageScrollView>
        </>
      )}

      {toastMessage ? (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB',
  },

  // Desktop tab bar
  tabBarWrapper: {
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  tabBar: {
    paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: 'row',
  },
  tabPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F3F4F6',
  },
  tabPillActive: { backgroundColor: GREEN },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabLabelActive: { color: '#FFFFFF' },

  // Mobile tab bar
  mobileTabBar: {
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    paddingVertical: 8, paddingHorizontal: 16, gap: 4,
  },
  mobileTabItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10,
  },
  mobileTabItemActive: { backgroundColor: GREEN },
  mobileTabLabel: { fontSize: 15, fontWeight: '600', color: '#374151' },
  mobileTabLabelActive: { color: '#FFFFFF' },

  // Toast
  toast: {
    position: 'absolute', bottom: 32, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1F2937', borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 8, elevation: 6, maxWidth: 360,
  },
  toastText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
