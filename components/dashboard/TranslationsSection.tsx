// components/dashboard/TranslationsSection.tsx
// Inline panel that lists every translation of a tour (source + translated
// langcodes), with per-language Approve / Unpublish / Republish actions and
// a "Private preview" link. Used inside MyToursTab next to each tour card.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Flag } from '../ui/Flag';
import {
  listTourTranslations,
  approveTranslation,
  unpublishTranslation,
  type TourTranslationInfo,
  type TranslationsListResponse,
} from '../../services/dashboard.service';
import { langCodeToCountryCode } from '../../services/language.service';
import type { Tour } from '../../types';
import { buildTourSlug } from '../../lib/tour-slug';

interface TranslationsSectionProps {
  tour: Tour;
}

export function TranslationsSection({ tour }: TranslationsSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [rows, setRows]           = useState<TourTranslationInfo[]>([]);
  const [sourceLang, setSourceLang] = useState<string>(tour.langcode ?? 'en');
  const [loading, setLoading]     = useState(true);
  const [busyLang, setBusyLang]   = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    listTourTranslations(tour.drupalInternalId)
      .then((res: TranslationsListResponse) => {
        setSourceLang(res.sourceLang);
        setRows(res.translations);
      })
      .catch((e) => setError(e?.message ?? null))
      .finally(() => setLoading(false));
  }, [tour.drupalInternalId]);

  useEffect(() => { refresh(); }, [refresh]);

  const previewUrl = (lc: string) => {
    const slug = tour.drupalInternalId
      ? buildTourSlug({ country: tour.country?.name, city: tour.city?.name, nid: tour.drupalInternalId })
      : tour.id;
    return `/${lc}/tour/${slug}?preview=1`;
  };

  const handleApprove = async (lc: string) => {
    setBusyLang(lc); setError(null);
    try {
      await approveTranslation(tour.drupalInternalId, lc);
      refresh();
    } catch (e: any) {
      setError(e?.message ?? t('common.error'));
    } finally {
      setBusyLang(null);
    }
  };

  const handleUnpublish = async (lc: string) => {
    setBusyLang(lc); setError(null);
    try {
      await unpublishTranslation(tour.drupalInternalId, lc);
      refresh();
    } catch (e: any) {
      setError(e?.message ?? t('common.error'));
    } finally {
      setBusyLang(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.box}>
        <ActivityIndicator size="small" color="#F59E0B" />
      </View>
    );
  }

  if (rows.length <= 1) {
    return (
      <View style={styles.box}>
        <Text style={styles.empty}>{t('translationsSection.empty')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <Text style={styles.heading}>{t('translationsSection.title')}</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      {rows.map((row) => {
        const isSource = row.langcode === sourceLang;
        const isBusy   = busyLang === row.langcode;
        return (
          <View key={row.langcode} style={styles.row}>
            <View style={styles.left}>
              <Flag code={langCodeToCountryCode(row.langcode)} size={18} />
              <Text style={styles.langName} numberOfLines={1}>{row.langName}</Text>
              <Pill status={isSource ? 'source' : row.published ? 'approved' : 'pending'} />
            </View>
            <View style={styles.actions}>
              {!isSource && (
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => router.push(previewUrl(row.langcode) as any)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="eye-outline" size={14} color="#374151" />
                </TouchableOpacity>
              )}
              {!isSource && !row.published && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnApprove, isBusy && styles.btnDisabled]}
                  onPress={() => handleApprove(row.langcode)}
                  disabled={isBusy}
                  activeOpacity={0.85}
                >
                  {isBusy
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={13} color="#FFFFFF" />
                        <Text style={styles.btnApproveText}>{t('translationsSection.approve')}</Text>
                      </>
                    )}
                </TouchableOpacity>
              )}
              {!isSource && row.published && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnUnpublish, isBusy && styles.btnDisabled]}
                  onPress={() => handleUnpublish(row.langcode)}
                  disabled={isBusy}
                  activeOpacity={0.85}
                >
                  {isBusy
                    ? <ActivityIndicator size="small" color="#92400E" />
                    : (
                      <>
                        <Ionicons name="eye-off-outline" size={13} color="#92400E" />
                        <Text style={styles.btnUnpublishText}>{t('translationsSection.unpublish')}</Text>
                      </>
                    )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Pill({ status }: { status: 'source' | 'approved' | 'pending' }) {
  const { t } = useTranslation();
  const map = {
    source:   { bg: '#E0E7FF', fg: '#3730A3', key: 'translationsSection.statusSource' },
    approved: { bg: '#D1FAE5', fg: '#065F46', key: 'translationsSection.statusApproved' },
    pending:  { bg: '#FEF3C7', fg: '#92400E', key: 'translationsSection.statusPending' },
  }[status];
  return (
    <View style={[pillStyles.pill, { backgroundColor: map.bg }]}>
      <Text style={[pillStyles.text, { color: map.fg }]}>{t(map.key)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  heading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  empty: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 4,
    flexWrap: 'wrap',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  langName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  btnApprove: { backgroundColor: '#16A34A' },
  btnApproveText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  btnUnpublish: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#92400E' },
  btnUnpublishText: { color: '#92400E', fontSize: 11, fontWeight: '700' },
  btnDisabled: { opacity: 0.55 },
  error: {
    fontSize: 11,
    color: '#B91C1C',
  },
});

const pillStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
