// components/business/MyBusinessesTab.tsx

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getBusinessesByAuthor } from '../../services/business.service';
import type { Business } from '../../types';

const GREEN = '#10B981';
const GREEN_DARK = '#059669';

interface MyBusinessesTabProps {
  userId: string;
}

export function MyBusinessesTab({ userId }: MyBusinessesTabProps) {
  const { t } = useTranslation();
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBusinessesByAuthor(userId);
      setBusinesses(data);
    } catch {
      setError(t('business.myBusinesses.loadError'));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAdminister = (businessId: string) => {
    router.push(`/${langcode}/business-dashboard/${businessId}` as any);
  };

  const handleCreate = () => {
    router.push(`/${langcode}/dashboard/create-business` as any);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{t('business.myBusinesses.title')}</Text>
        <TouchableOpacity style={styles.createBtn} onPress={handleCreate} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.createBtnText}>{t('business.myBusinesses.newBusiness')}</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && businesses.length === 0 && (
        <View style={styles.emptyBox}>
          <Ionicons name="storefront-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>{t('business.myBusinesses.emptyTitle')}</Text>
          <Text style={styles.emptySubtitle}>{t('business.myBusinesses.emptySubtitle')}</Text>
          <TouchableOpacity style={styles.createBtn} onPress={handleCreate} activeOpacity={0.8}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.createBtnText}>{t('business.myBusinesses.createBusiness')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {isDesktop ? (
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 2 }]}>{t('business.myBusinesses.colName')}</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1.5 }]}>{t('business.myBusinesses.colCategory')}</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1 }]}>{t('business.myBusinesses.colStatus')}</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1 }]}>{t('business.myBusinesses.colActions')}</Text>
          </View>
          {businesses.map((b) => (
            <View key={b.id} style={styles.tableRow}>
              <View style={[styles.tableCell, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                {b.logo ? (
                  <Image source={{ uri: b.logo }} style={styles.logoThumb} />
                ) : (
                  <View style={[styles.logoThumb, styles.logoPlaceholder]}>
                    <Ionicons name="storefront-outline" size={16} color="#9CA3AF" />
                  </View>
                )}
                <Text style={styles.businessName} numberOfLines={1}>{b.name}</Text>
              </View>
              <Text style={[styles.tableCell, { flex: 1.5, color: '#6B7280' }]} numberOfLines={1}>
                {b.category?.name ?? '—'}
              </Text>
              <View style={[styles.tableCell, { flex: 1 }]}>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{t('business.myBusinesses.statusActive')}</Text>
                </View>
              </View>
              <View style={[styles.tableCell, { flex: 1 }]}>
                <TouchableOpacity
                  style={styles.adminBtn}
                  onPress={() => handleAdminister(b.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.adminBtnText}>{t('business.myBusinesses.manage')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {businesses.map((b) => (
            <View key={b.id} style={styles.card}>
              <View style={styles.cardRow}>
                {b.logo ? (
                  <Image source={{ uri: b.logo }} style={styles.cardLogo} />
                ) : (
                  <View style={[styles.cardLogo, styles.logoPlaceholder]}>
                    <Ionicons name="storefront-outline" size={22} color="#9CA3AF" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName} numberOfLines={1}>{b.name}</Text>
                  <Text style={styles.cardCategory} numberOfLines={1}>
                    {b.category?.name ?? t('business.myBusinesses.noCategory')}
                  </Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{t('business.myBusinesses.statusActive')}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.adminBtnFull}
                onPress={() => handleAdminister(b.id)}
                activeOpacity={0.8}
              >
                <Ionicons name="settings-outline" size={16} color={GREEN_DARK} />
                <Text style={styles.adminBtnFullText}>{t('business.myBusinesses.manage')}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: GREEN,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { color: '#DC2626', fontSize: 13 },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptySubtitle: { fontSize: 13, color: '#6B7280', textAlign: 'center', maxWidth: 280 },
  table: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableHeader: { backgroundColor: '#F9FAFB' },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableCell: { fontSize: 14, color: '#111827' },
  logoThumb: { width: 32, height: 32, borderRadius: 8 },
  logoPlaceholder: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  businessName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  statusBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusText: { fontSize: 12, fontWeight: '600', color: '#065F46' },
  adminBtn: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: GREEN,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  adminBtnText: { fontSize: 13, fontWeight: '600', color: GREEN_DARK },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 12,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardLogo: { width: 48, height: 48, borderRadius: 10 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardCategory: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  adminBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: '#ECFDF5',
  },
  adminBtnFullText: { fontSize: 14, fontWeight: '600', color: GREEN_DARK },
});
