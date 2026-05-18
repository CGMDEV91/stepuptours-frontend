// app/[langcode]/profile.tsx
// User Profile page — auth-protected

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Alert,
  Switch,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/auth.store';
import { useToursStore } from '../../stores/tours.store';
import { useLanguageStore } from '../../stores/language.store';
import { getUserTourActivities } from '../../services/tours.service';
import { updatePassword } from '../../services/user.service';
import BackButton from '../../components/layout/BackButton';
import { Picker } from '../../components/layout/Picker';
import type { PickerItem } from '../../components/layout/Picker';
import Footer from '../../components/layout/Footer';
import { LanguageSelector } from '../../components/layout/LanguageSelector';
import { PageScrollView } from '../../components/layout/PageScrollView';
import { webFullHeight } from '../../lib/web-styles';
import { isNative } from '../../lib/platform';
import { getAbandonedTourPref, setAbandonedTourPref } from '../../lib/notification-prefs';
import { syncPushToken } from '../../services/notifications.service';
import type { TourActivity, User } from '../../types';

function getRolePanel(user: User, lang: string): { labelKey: string; icon: string; route: string } {
  if (user.roles?.includes('administrator')) {
    return { labelKey: 'nav.administration', icon: 'shield-checkmark-outline', route: `/${lang}/admin` };
  }
  if (user.roles?.includes('guide') || user.roles?.includes('professional')) {
    return { labelKey: 'nav.dashboard', icon: 'grid-outline', route: `/${lang}/dashboard` };
  }
  if (user.roles?.includes('business')) {
    return { labelKey: 'nav.business', icon: 'storefront-outline', route: `/${lang}/business-dashboard` };
  }
  return { labelKey: 'nav.myDonations', icon: 'heart-circle-outline', route: `/${lang}/donations` };
}

const LEGAL_LINKS: { labelKey: string; icon: string; slug: string }[] = [
  { labelKey: 'more.faq', icon: 'help-circle-outline', slug: 'faq' },
  { labelKey: 'more.privacy', icon: 'shield-checkmark-outline', slug: 'privacy-policy' },
  { labelKey: 'more.cookies', icon: 'settings-outline', slug: 'cookie-policy' },
  { labelKey: 'more.terms', icon: 'document-text-outline', slug: 'terms-of-use' },
];

const AMBER = '#F59E0B';
const AMBER_DARK = '#D97706';
const CONTENT_MAX_WIDTH = 900;

// ── Stat card ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  iconName: string;
  iconBg: string;
  iconColor: string;
  isDesktop: boolean;
}

function StatCard({ label, value, iconName, iconBg, iconColor, isDesktop }: StatCardProps) {
  return (
    <View style={[styles.statCard, isDesktop && styles.statCardDesktop]}>
      <View style={[styles.statIconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName as any} size={20} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Profile screen ────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const signOut = useAuthStore((s) => s.signOut);
  const countries = useToursStore((s) => s.countries);
  const fetchCountries = useToursStore((s) => s.fetchCountries);
  const languages = useLanguageStore((s) => s.languages);
  const fetchLanguages = useLanguageStore((s) => s.fetchLanguages);

  const [activities, setActivities] = useState<TourActivity[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const [publicName, setPublicName] = useState(user?.publicName ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedLangCode, setSelectedLangCode] = useState(user?.preferredLanguage ?? 'en');
  const [selectedLangLabel, setSelectedLangLabel] = useState(
    languages.find((l) => l.id === (user?.preferredLanguage ?? 'en'))?.name ?? (user?.preferredLanguage ?? 'en')
  );
  const [selectedCountryId, setSelectedCountryId] = useState(user?.country?.id ?? '');
  const [selectedCountryLabel, setSelectedCountryLabel] = useState(user?.country?.name ?? '');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);

  // Notificaciones (solo nativo) y contacto
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [siteEmail, setSiteEmail] = useState('');

  useEffect(() => {
    if (!isNative) return;
    getAbandonedTourPref().then(setNotifEnabled);
  }, []);

  useEffect(() => {
    if (!isNative) return;
    const base = process.env.EXPO_PUBLIC_API_URL ?? '';
    fetch(`${base}/api/site-settings`)
      .then((r) => r.json())
      .then((d) => { if (d?.siteEmail) setSiteEmail(d.siteEmail); })
      .catch(() => {});
  }, []);

  const handleToggleNotif = useCallback(async (value: boolean) => {
    setNotifEnabled(value);
    await setAbandonedTourPref(value);
    void syncPushToken();
  }, []);

  // Guard: evita router.replace antes de que el Root Layout esté montado
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  // Refs for anchor measurement
  const langButtonRef = useRef<any>(null);
  const countryButtonRef = useRef<any>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user && !isAuthLoading) {
      router.replace(`/${langcode}` as any);
    }
  }, [ready, user, isAuthLoading, langcode]);

  useEffect(() => {
    fetchCountries();
    if (languages.length === 0) {
      fetchLanguages();
    }
  }, [fetchCountries, fetchLanguages]);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    setStatsLoading(true);
    try {
      const data = await getUserTourActivities(user.id);
      setActivities(data);
    } catch {
      // Non-critical
    } finally {
      setStatsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (user) {
      setPublicName(user.publicName);
      const langCode = user.preferredLanguage ?? 'en';
      setSelectedLangCode(langCode);
      setSelectedLangLabel(languages.find((l) => l.id === langCode)?.name ?? langCode);
      setSelectedCountryId(user.country?.id ?? '');
      setSelectedCountryLabel(user.country?.name ?? '');
    }
  }, [user, languages]);

  const toursCompleted = activities.filter((a) => a.isCompleted).length;
  const ratingsGiven = activities.filter((a) => a.userRating !== null).length;
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(langcode ?? 'en', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    : '—';

  const handleSave = useCallback(async () => {
    if (!user) return;

    if (newPassword && newPassword !== confirmPassword) {
      setSaveError(t('profile.passwordMismatch'));
      setSaveSuccess(false);
      return;
    }

    setSaveError(null);
    setSaveSuccess(false);
    setIsSaving(true);

    try {
      await updateProfile({
        publicName,
        preferredLanguage: selectedLangCode,
        countryId: selectedCountryId || undefined,
      });

      if (newPassword) {
        await updatePassword(user.id, newPassword);
        setNewPassword('');
        setConfirmPassword('');
      }

      setSaveSuccess(true);

      if (Platform.OS !== 'web') {
        Alert.alert('', t('profile.saved'));
      }
    } catch (err: any) {
      setSaveError(err.message ?? 'Error saving profile');
    } finally {
      setIsSaving(false);
    }
  }, [user, publicName, newPassword, confirmPassword, selectedLangCode, selectedCountryId, updateProfile, t]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace(`/${langcode}` as any);
  }, [signOut, router, langcode]);

  const countryItems: PickerItem[] = [
    { id: '', label: t('profile.selectCountry') },
    ...countries.map((c) => ({ id: c.id, label: c.name })),
  ];

  const langItems: PickerItem[] = languages.map((l) => ({ id: l.id, label: l.name }));

  if (isAuthLoading || !user) {
    return (
      <View style={styles.authGateLoading}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  const displayName = user.publicName || user.username || '';
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <View style={styles.root}>
      <PageScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Dark navy profile banner ── */}
        <View style={styles.profileBanner}>
          <View style={styles.bannerBackBtn}>
            <BackButton />
          </View>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <Text style={styles.bannerName}>{displayName}</Text>
          {user.email ? <Text style={styles.bannerEmail}>{user.email}</Text> : null}
          <View style={styles.xpBadge}>
            <Text style={styles.xpBadgeText}>{user.experiencePoints} XP</Text>
          </View>
        </View>

        <View style={[styles.contentWrapper, { maxWidth: CONTENT_MAX_WIDTH }]}>
          {/* ── Language section (solo nativo — en web está en el navbar) ── */}
          {isNative && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('profile.language')}</Text>
              <LanguageSelector variant="field" />
            </View>
          )}

          {/* ── My panel (solo nativo — en web está en el navbar) ── */}
          {isNative && (() => {
            const panel = getRolePanel(user, langcode ?? 'en');
            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('profile.myPanel')}</Text>
                <TouchableOpacity
                  style={styles.infoRow}
                  onPress={() => router.push(panel.route as any)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={panel.icon as any} size={20} color={AMBER} />
                  <Text style={styles.infoRowText}>{t(panel.labelKey)}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            );
          })()}

          {/* ── Stats section ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.stats')}</Text>
            {statsLoading ? (
              <ActivityIndicator size="small" color={AMBER} style={styles.statsLoader} />
            ) : (
              <View style={[styles.statsGrid, isDesktop && styles.statsGridDesktop]}>
                <StatCard label={t('profile.stats.toursCompleted')} value={toursCompleted} iconName="trophy" iconBg="#FEF3C7" iconColor="#F59E0B" isDesktop={isDesktop} />
                <StatCard label={t('profile.stats.ratingsGiven')} value={ratingsGiven} iconName="location" iconBg="#D1FAE5" iconColor="#22C55E" isDesktop={isDesktop} />
                <StatCard label={t('profile.stats.memberSince')} value={memberSince} iconName="calendar" iconBg="#EDE9FE" iconColor="#8B5CF6" isDesktop={isDesktop} />
                <StatCard label={t('profile.stats.xp')} value={user.experiencePoints} iconName="globe" iconBg="#DBEAFE" iconColor="#3B82F6" isDesktop={isDesktop} />
              </View>
            )}
          </View>

          {/* ── Edit section ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.edit')}</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('profile.edit.publicName')}</Text>
              <TextInput
                style={styles.input}
                value={publicName}
                onChangeText={setPublicName}
                autoCapitalize="words"
                returnKeyType="done"
                placeholder={t('profile.edit.publicName')}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('profile.edit.newPassword')}</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('profile.edit.confirmPassword')}</Text>
              <TextInput
                style={[
                  styles.input,
                  newPassword && confirmPassword && newPassword !== confirmPassword ? styles.inputError : null,
                ]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                returnKeyType="done"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('profile.edit.language')}</Text>
              <TouchableOpacity
                ref={langButtonRef}
                style={styles.pickerButton}
                onPress={() => setLangPickerVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.pickerButtonText}>
                  {selectedLangLabel || t('profile.selectLanguage')}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.fieldHelp}>{t('profile.edit.languageHelp')}</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('profile.edit.country')}</Text>
              <TouchableOpacity
                ref={countryButtonRef}
                style={styles.pickerButton}
                onPress={() => setCountryPickerVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.pickerButtonText}>
                  {selectedCountryLabel || t('profile.selectCountry')}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {saveError ? (
              <View style={styles.feedbackError}>
                <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
                <Text style={styles.feedbackErrorText}>{saveError}</Text>
              </View>
            ) : null}

            {saveSuccess && Platform.OS === 'web' ? (
              <View style={styles.feedbackSuccess}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#16A34A" />
                <Text style={styles.feedbackSuccessText}>{t('profile.saved')}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.btnAmber, styles.saveBtn, isSaving && styles.btnDisabled]}
              onPress={handleSave}
              activeOpacity={0.8}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.btnAmberText}>{t('profile.save')}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Notifications (solo nativo) ── */}
          {isNative && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('profile.notifications')}</Text>
              <View style={styles.notifRow}>
                <View style={styles.notifTextWrap}>
                  <Text style={styles.notifTitle}>{t('profile.notifications.abandonedTour')}</Text>
                  <Text style={styles.notifDesc}>{t('profile.notifications.abandonedTourDesc')}</Text>
                </View>
                <Switch
                  value={notifEnabled}
                  onValueChange={handleToggleNotif}
                  trackColor={{ false: '#E5E7EB', true: '#FCD34D' }}
                  thumbColor={notifEnabled ? AMBER : '#F3F4F6'}
                />
              </View>
            </View>
          )}

          {/* ── App information (solo nativo — en web está en el footer) ── */}
          {isNative && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('profile.information')}</Text>
              {LEGAL_LINKS.map((link, i) => (
                <TouchableOpacity
                  key={link.slug}
                  style={[styles.infoRow, i < LEGAL_LINKS.length - 1 && styles.infoRowBorder]}
                  onPress={() => router.push(`/${langcode}/${link.slug}` as any)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={link.icon as any} size={20} color="#6B7280" />
                  <Text style={styles.infoRowText}>{t(link.labelKey)}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
              {siteEmail ? (
                <TouchableOpacity
                  style={styles.infoRow}
                  onPress={() => Linking.openURL(`mailto:${siteEmail}`)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="mail-outline" size={20} color="#6B7280" />
                  <Text style={styles.infoRowText}>{t('more.contact')}</Text>
                  <Text style={styles.infoRowValue}>{siteEmail}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {/* ── Sign out (solo nativo — en web está en el navbar) ── */}
          {isNative && (
            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={handleSignOut}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
              <Text style={styles.signOutText}>{t('nav.signout')}</Text>
            </TouchableOpacity>
          )}
        </View>
        <Footer />
      </PageScrollView>

      <Picker
        visible={langPickerVisible}
        title={t('profile.edit.language')}
        items={langItems}
        selectedId={selectedLangCode}
        onSelect={(id, label) => { setSelectedLangCode(id); setSelectedLangLabel(label); }}
        onClose={() => setLangPickerVisible(false)}
        isDesktop={isDesktop}
        anchorRef={langButtonRef}
      />

      <Picker
        visible={countryPickerVisible}
        title={t('profile.edit.country')}
        items={countryItems}
        selectedId={selectedCountryId}
        onSelect={(id, label) => { setSelectedCountryId(id); setSelectedCountryLabel(id ? label : ''); }}
        onClose={() => setCountryPickerVisible(false)}
        isDesktop={isDesktop}
        anchorRef={countryButtonRef}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    ...webFullHeight,
  },
  profileBanner: {
    backgroundColor: '#1E293B',
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '100%',
  },
  bannerBackBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  bannerName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  bannerEmail: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  xpBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
  },
  xpBadgeText: {
    color: '#D97706',
    fontSize: 13,
    fontWeight: '700',
  },
  authGateLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  contentWrapper: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statsGridDesktop: {
    gap: 16,
  },
  statsLoader: {
    marginVertical: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  statCardDesktop: {
    minWidth: '22%',
  },
  statIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: AMBER_DARK,
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  fieldHelp: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
    lineHeight: 16,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  pickerButton: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  pickerButtonText: {
    fontSize: 15,
    color: '#111827',
    flex: 1,
  },
  feedbackError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  feedbackErrorText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
    flex: 1,
  },
  feedbackSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  feedbackSuccessText: {
    fontSize: 13,
    color: '#16A34A',
    fontWeight: '500',
    flex: 1,
  },
  btnAmber: {
    backgroundColor: AMBER,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAmberText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    alignSelf: 'stretch',
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notifTextWrap: {
    flex: 1,
    gap: 2,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  notifDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoRowText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  infoRowValue: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 16,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
  },
});
