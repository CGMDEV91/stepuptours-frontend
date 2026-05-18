// components/layout/BottomTabBar.tsx
// Barra de navegación inferior — SOLO apps nativas (iOS/Android).
// La web nunca renderiza este componente; mantiene el Navbar superior.
import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/auth.store';

const AMBER = '#F59E0B';
const INACTIVE = '#9CA3AF';

interface TabDef {
  key: string;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: (lang: string) => string;
}

const GUEST_TABS: TabDef[] = [
  { key: 'home',       labelKey: 'nav.home',       icon: 'home-outline',          path: (l) => `/${l}` },
  { key: 'ranking',    labelKey: 'nav.ranking',     icon: 'trophy-outline',        path: (l) => `/${l}/ranking` },
  { key: 'favourites', labelKey: 'nav.favourites',  icon: 'heart-outline',         path: (l) => `/${l}/favourites` },
  { key: 'more',       labelKey: 'nav.account',     icon: 'person-circle-outline', path: (l) => `/${l}/more` },
];

const AUTH_TABS: TabDef[] = [
  { key: 'home',       labelKey: 'nav.home',       icon: 'home-outline',             path: (l) => `/${l}` },
  { key: 'ranking',    labelKey: 'nav.ranking',     icon: 'trophy-outline',           path: (l) => `/${l}/ranking` },
  { key: 'completed',  labelKey: 'nav.completed',   icon: 'checkmark-circle-outline', path: (l) => `/${l}/completed` },
  { key: 'favourites', labelKey: 'nav.favourites',  icon: 'heart-outline',            path: (l) => `/${l}/favourites` },
  { key: 'profile',    labelKey: 'nav.profile',     icon: 'person-outline',           path: (l) => `/${l}/profile` },
];

export function BottomTabBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const user = useAuthStore((s) => s.user);

  const lang = langcode || 'en';
  const tabs = user ? AUTH_TABS : GUEST_TABS;

  const isActive = useCallback(
    (tab: TabDef) => {
      const target = tab.path(lang);
      if (tab.key === 'home') {
        return pathname === target || pathname === `/${lang}` || pathname === `/${lang}/`;
      }
      return pathname.startsWith(target);
    },
    [pathname, lang],
  );

  const handlePress = useCallback(
    (tab: TabDef) => {
      router.push(tab.path(lang) as any);
    },
    [router, lang],
  );

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((tab) => {
        const active = isActive(tab);
        const color = active ? AMBER : INACTIVE;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => handlePress(tab)}
            activeOpacity={0.7}
          >
            <Ionicons name={tab.icon} size={24} color={color} />
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {t(tab.labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
