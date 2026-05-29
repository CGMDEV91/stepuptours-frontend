// app/[langcode]/more.tsx
// Pantalla "Cuenta / Información" — pestaña del tab bar nativo para invitados.
// Reúne acceso a login/registro y los enlaces legales que en web están en el footer.
// En web es accesible por URL pero la navegación normal usa el footer.
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/auth.store';
import { PageScrollView } from '../../components/layout/PageScrollView';
import { imageHeaders } from '../../lib/drupal-client';

const AMBER = '#F59E0B';

export default function MoreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const user = useAuthStore((s) => s.user);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);

  const lang = langcode || 'en';
  const [email, setEmail] = useState('');

  useEffect(() => {
    const base = process.env.EXPO_PUBLIC_API_URL ?? '';
    fetch(`${base}/api/site-settings`, { headers: { Accept: 'application/json', ...imageHeaders } })
      .then((r) => r.json())
      .then((d) => { if (d?.siteEmail) setEmail(d.siteEmail); })
      .catch(() => {});
  }, []);

  const links: { labelKey: string; icon: keyof typeof Ionicons.glyphMap; route: string }[] = [
    { labelKey: 'more.faq', icon: 'help-circle-outline', route: `/${lang}/faq` },
    { labelKey: 'more.privacy', icon: 'shield-checkmark-outline', route: `/${lang}/privacy-policy` },
    { labelKey: 'more.cookies', icon: 'settings-outline', route: `/${lang}/cookie-policy` },
    { labelKey: 'more.terms', icon: 'document-text-outline', route: `/${lang}/terms-of-use` },
  ];

  return (
    <PageScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{t('more.title')}</Text>

      {!user && (
        <View style={styles.card}>
          <Text style={styles.guestNote}>{t('more.guestNote')}</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => openAuthModal('login')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>{t('more.login')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => openAuthModal('register')}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>{t('more.register')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionLabel}>{t('more.info')}</Text>
      <View style={styles.card}>
        {links.map((link, i) => (
          <TouchableOpacity
            key={link.route}
            style={[styles.row, i < links.length - 1 && styles.rowBorder]}
            onPress={() => router.push(link.route as any)}
            activeOpacity={0.7}
          >
            <Ionicons name={link.icon} size={20} color="#6B7280" />
            <Text style={styles.rowText}>{t(link.labelKey)}</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
        {email ? (
          <TouchableOpacity
            style={[styles.row, styles.rowBorder, { borderTopWidth: 1, borderTopColor: '#F3F4F6' }]}
            onPress={() => Linking.openURL(`mailto:${email}`)}
            activeOpacity={0.7}
          >
            <Ionicons name="mail-outline" size={20} color="#6B7280" />
            <Text style={styles.rowText}>{t('more.contact')}</Text>
            <Text style={styles.rowValue}>{email}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </PageScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, gap: 8 },
  heading: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 8 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    padding: 4,
  },
  guestNote: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    padding: 12,
  },
  primaryBtn: {
    backgroundColor: AMBER,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 8,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: AMBER,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 12,
  },
  secondaryBtnText: { color: '#D97706', fontSize: 15, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowText: { flex: 1, fontSize: 15, color: '#374151', fontWeight: '500' },
  rowValue: { fontSize: 13, color: '#9CA3AF' },
});
