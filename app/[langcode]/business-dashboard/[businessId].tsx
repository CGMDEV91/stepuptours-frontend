// app/[langcode]/business-dashboard/[businessId].tsx
// Pantalla de gestión de un negocio individual.
// Tabs: Información | Analíticas | Mis promociones en este negocio

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../stores/auth.store';
import { getBusinessById, updateBusiness } from '../../../services/business.service';
import { MyPromotionsTab } from '../../../components/business/MyPromotionsTab';
import { BusinessAnalyticsTab } from '../../../components/business/BusinessAnalyticsTab';
import { ImagePickerField } from '../../../components/shared/ImagePickerField';
import PageBanner from '../../../components/layout/PageBanner';
import Footer from '../../../components/layout/Footer';
import { PageScrollView } from '../../../components/layout/PageScrollView';
import { uploadDrupalFile } from '../../../lib/drupal-client';
import { webFullHeight } from '../../../lib/web-styles';
import type { Business } from '../../../types';

const GREEN = '#10B981';
const GREEN_DARK = '#059669';
const CONTENT_MAX_WIDTH = 860;

type TabId = 'overview' | 'promotions' | 'analytics';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

// ── Tab: Información / edición ────────────────────────────────────────────────

function OverviewTab({ business, onSaved }: { business: Business; onSaved: (b: Business) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(business.name);
  const [description, setDescription] = useState(business.description ?? '');
  const [website, setWebsite] = useState(business.website ?? '');
  const [phone, setPhone] = useState(business.phone ?? '');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageFilename, setImageFilename] = useState('');
  const [existingLogoUrl] = useState(business.logo);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSavedOk(false);
    try {
      let logoId: string | undefined;
      if (imageUri && imageFilename) {
        logoId = await uploadDrupalFile('business', 'field_logo', imageUri, imageFilename);
      }
      const updated = await updateBusiness(business.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        website: website.trim() || undefined,
        phone: phone.trim() || undefined,
        logoId,
      });
      onSaved(updated);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (e: any) {
      setSaveError(e?.message ?? 'Error al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={overviewStyles.container}>
      <Text style={overviewStyles.sectionTitle}>Datos del negocio</Text>

      <Text style={overviewStyles.label}>Nombre *</Text>
      <TextInput
        style={overviewStyles.input}
        value={name}
        onChangeText={setName}
        placeholder="Nombre del negocio"
        placeholderTextColor="#9CA3AF"
      />

      <Text style={overviewStyles.label}>Descripción</Text>
      <TextInput
        style={[overviewStyles.input, overviewStyles.textarea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Describe tu negocio..."
        placeholderTextColor="#9CA3AF"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      <Text style={overviewStyles.label}>Sitio web</Text>
      <TextInput
        style={overviewStyles.input}
        value={website}
        onChangeText={setWebsite}
        placeholder="https://..."
        placeholderTextColor="#9CA3AF"
        autoCapitalize="none"
        keyboardType="url"
      />

      <Text style={overviewStyles.label}>Teléfono</Text>
      <TextInput
        style={overviewStyles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="+34 600 000 000"
        placeholderTextColor="#9CA3AF"
        keyboardType="phone-pad"
      />

      <Text style={overviewStyles.label}>Logo</Text>
      <ImagePickerField
        existingImageUrl={existingLogoUrl}
        imageUri={imageUri}
        onImagePicked={(uri, filename) => { setImageUri(uri); setImageFilename(filename); }}
      />

      {saveError && (
        <View style={overviewStyles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
          <Text style={overviewStyles.errorText}>{saveError}</Text>
        </View>
      )}
      {savedOk && (
        <View style={overviewStyles.successBox}>
          <Ionicons name="checkmark-circle-outline" size={16} color="#065F46" />
          <Text style={overviewStyles.successText}>Cambios guardados correctamente.</Text>
        </View>
      )}

      <TouchableOpacity
        style={[overviewStyles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <>
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={overviewStyles.saveBtnText}>Guardar cambios</Text>
            </>
        }
      </TouchableOpacity>
    </View>
  );
}

const overviewStyles = StyleSheet.create({
  container: { gap: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    backgroundColor: '#F9FAFB', paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 12 : 10,
    fontSize: 14, color: '#111827',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  },
  textarea: { minHeight: 100, paddingTop: 10 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginTop: 8,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { color: '#DC2626', fontSize: 13 },
  successBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#ECFDF5', borderRadius: 10, padding: 12, marginTop: 8,
    borderWidth: 1, borderColor: '#A7F3D0',
  },
  successText: { color: '#065F46', fontSize: 13 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: GREEN, borderRadius: 12, paddingVertical: 14, marginTop: 16,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ── Pantalla principal ────────────────────────────────────────────────────────

export default function BusinessDetailScreen() {
  const { langcode, businessId } = useLocalSearchParams<{ langcode: string; businessId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const TABS: Tab[] = [
    { id: 'overview',   label: 'Información',                    icon: 'storefront-outline' },
    { id: 'promotions', label: 'Promociones',                    icon: 'megaphone-outline'  },
    { id: 'analytics',  label: t('business.tabs.analytics'),     icon: 'bar-chart-outline'  },
  ];

  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const isBusiness = user?.roles?.includes('business');

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Guard
  useEffect(() => {
    if (!isAuthLoading && (!user || !isBusiness)) {
      router.replace(`/${langcode}` as any);
    }
  }, [user, isAuthLoading, isBusiness, langcode]);

  useEffect(() => {
    if (!businessId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const b = await getBusinessById(businessId);
        setBusiness(b);
      } catch {
        setError('No se pudo cargar el negocio.');
      } finally {
        setLoading(false);
      }
    })();
  }, [businessId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    const timer = setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 80);
    return () => clearTimeout(timer);
  }, [activeTab]);

  if (isAuthLoading || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  if (error || !business) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{error ?? 'Negocio no encontrado.'}</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.backBtnText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Tab bar
  const tabBar = (
    <View style={isMobile ? styles.mobileTabBar : styles.desktopTabBar}>
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <TouchableOpacity
            key={tab.id}
            style={isMobile
              ? [styles.mobileTabItem, isActive && styles.mobileTabItemActive]
              : [styles.desktopTabPill, isActive && styles.desktopTabPillActive]
            }
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.8}
          >
            <Ionicons name={tab.icon as any} size={16} color={isActive ? '#fff' : '#6B7280'} />
            <Text style={[
              isMobile ? styles.mobileTabLabel : styles.desktopTabLabel,
              isActive && styles.tabLabelActive,
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const contentInner = (
    <View style={{
      maxWidth: isMobile ? undefined : CONTENT_MAX_WIDTH,
      width: '100%',
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 32,
    }}>
      {activeTab === 'overview' && (
        <OverviewTab business={business} onSaved={setBusiness} />
      )}
      {activeTab === 'promotions' && user && (
        <MyPromotionsTab userId={user.id} businessId={business.id} />
      )}
      {activeTab === 'analytics' && (
        <BusinessAnalyticsTab businessId={business.id} />
      )}
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
              title={business.name}
              subtitle="Gestiona tu negocio"
              showBack
            />
            {tabBar}
            {contentInner}
          </View>
          <Footer />
        </PageScrollView>
      ) : (
        <>
          {tabBar}
          <PageScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
            <View style={{ flex: 1 }}>
              <PageBanner
                icon="storefront-outline"
                iconBgColor={GREEN}
                title={business.name}
                subtitle="Gestiona tu negocio"
                showBack
              />
              {contentInner}
            </View>
            <Footer />
          </PageScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F9FAFB', gap: 16, padding: 24,
  },
  errorText: { fontSize: 15, color: '#EF4444', textAlign: 'center' },
  backBtn: {
    backgroundColor: GREEN, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10,
  },
  backBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Desktop tabs (pills)
  desktopTabBar: {
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  desktopTabPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F3F4F6',
  },
  desktopTabPillActive: { backgroundColor: GREEN },
  desktopTabLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280' },

  // Mobile tabs (list)
  mobileTabBar: {
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    paddingVertical: 8, paddingHorizontal: 16, gap: 4,
  },
  mobileTabItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10,
  },
  mobileTabItemActive: { backgroundColor: GREEN },
  mobileTabLabel: { fontSize: 15, fontWeight: '600', color: '#374151' },
  tabLabelActive: { color: '#fff' },
});
