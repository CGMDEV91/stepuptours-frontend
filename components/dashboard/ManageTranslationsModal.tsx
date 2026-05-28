// components/dashboard/ManageTranslationsModal.tsx
// Modal for guides to manage translations of their own tour:
//   • See all language versions + their publish status
//   • Approve a pending translation
//   • Unpublish a single translation
//   • Unpublish / Republish the whole tour
//
// Opened from the "Manage" button in MyToursTab cardActions.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Flag } from '../ui/Flag';
import {
  listTourTranslations,
  approveTranslation,
  unpublishTranslation,
  unpublishTour,
  republishTour,
  type TourTranslationInfo,
} from '../../services/dashboard.service';
import { langCodeToCountryCode } from '../../services/language.service';
import type { Tour } from '../../types';
import { buildTourSlug } from '../../lib/tour-slug';

const AMBER      = '#F59E0B';
const GREEN      = '#16A34A';
const RED        = '#EF4444';
const DARK_AMBER = '#92400E';

interface ManageTranslationsModalProps {
  visible:   boolean;
  tour:      Tour | null;
  onChanged: () => void;
  onClose:   () => void;
}

export function ManageTranslationsModal({
                                          visible,
                                          tour,
                                          onChanged,
                                          onClose,
                                        }: ManageTranslationsModalProps) {
  const { t }      = useTranslation();
  const router     = useRouter();
  const pathname   = usePathname();
  const { width }  = useWindowDimensions();
  const isMobile   = Platform.OS !== 'web' || width < 600;

  /**
   * uiLang: the language currently shown in the interface.
   * Extracted from the first segment of the pathname, e.g. "/es/dashboard" → "es".
   * This is the prefix we keep when navigating to the edit form so the UI
   * language does NOT change when the guide edits a translation.
   */
  const uiLang = pathname.split('/').filter(Boolean)[0] ?? 'en';

  const [rows, setRows]             = useState<TourTranslationInfo[]>([]);
  const [sourceLang, setSourceLang] = useState<string>('');
  const [loading, setLoading]       = useState(false);
  const [busyLang, setBusyLang]     = useState<string | null>(null);
  const [busyTour, setBusyTour]     = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // ── Load translations when modal opens ────────────────────────────────────
  const refresh = useCallback(() => {
    if (!tour?.drupalInternalId) return;
    setLoading(true);
    setError(null);
    listTourTranslations(tour.drupalInternalId)
        .then((res) => {
          setSourceLang(res.sourceLang);
          setRows(res.translations);
        })
        .catch((e) => setError(e?.message ?? t('common.error')))
        .finally(() => setLoading(false));
  }, [tour?.drupalInternalId, t]);

  useEffect(() => {
    if (visible && tour) refresh();
  }, [visible, tour, refresh]);

  // ── Unpublish confirm helper ──────────────────────────────────────────────
  const confirmUnpublish = (onConfirm: () => void) => {
    const warning = t('dashboard.tours.unpublishWarning');
    if (Platform.OS === 'web') {
      if (window.confirm(warning)) onConfirm();
    } else {
      Alert.alert(
          t('dashboard.tours.unpublishTitle'),
          warning,
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('dashboard.tours.unpublishBtn'), style: 'destructive', onPress: onConfirm },
          ],
      );
    }
  };

  // ── Per-translation actions ───────────────────────────────────────────────
  const handleApprove = async (lc: string) => {
    if (!tour || busyLang) return;
    setBusyLang(lc);
    setError(null);
    try {
      await approveTranslation(tour.drupalInternalId, lc);
      refresh();
    } catch (e: any) {
      setError(e?.message ?? t('common.error'));
    } finally {
      setBusyLang(null);
    }
  };

  const handleUnpublishTranslation = (lc: string) => {
    if (!tour || busyLang) return;
    confirmUnpublish(async () => {
      setBusyLang(lc);
      setError(null);
      try {
        await unpublishTranslation(tour.drupalInternalId, lc);
        refresh();
        onChanged();
      } catch (e: any) {
        setError(e?.message ?? t('common.error'));
      } finally {
        setBusyLang(null);
      }
    });
  };

  // ── Whole-tour actions ────────────────────────────────────────────────────
  const handleUnpublishTour = () => {
    if (!tour || busyTour) return;
    confirmUnpublish(async () => {
      setBusyTour(true);
      setError(null);
      try {
        await unpublishTour(tour.drupalInternalId);
        onChanged();
        onClose();
      } catch (e: any) {
        setError(e?.message ?? t('common.error'));
      } finally {
        setBusyTour(false);
      }
    });
  };

  const handleRepublishTour = async () => {
    if (!tour || busyTour) return;
    setBusyTour(true);
    setError(null);
    try {
      await republishTour(tour.drupalInternalId);
      onChanged();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? t('common.error'));
    } finally {
      setBusyTour(false);
    }
  };

  // ── Preview link ──────────────────────────────────────────────────────────
  const previewUrl = (lc: string) => {
    if (!tour) return '#';
    const slug = tour.drupalInternalId
        ? buildTourSlug({ country: tour.country?.name, city: tour.city?.name, nid: tour.drupalInternalId })
        : tour.id;
    return `/${lc}/tour/${slug}?preview=1`;
  };

  /**
   * Build the edit URL for a translation row.
   *
   * KEY DECISION: we always keep the UI language prefix (uiLang) in the URL
   * so the interface language does not change when the guide opens the editor.
   * The content to load is indicated via the `contentLang` query param.
   *
   * When contentLang === sourceLang (or not present) create-tour.tsx loads the
   * source-language node as before. When contentLang differs, it loads the
   * translated version of the node fields (title, description, image) so the
   * guide can edit the translation without affecting the source content.
   *
   * Examples:
   *   UI = "es", editing source ("es") → /es/dashboard/create-tour?tourId=X
   *   UI = "es", editing French ("fr") → /es/dashboard/create-tour?tourId=X&contentLang=fr
   *   UI = "fr", editing source ("es") → /fr/dashboard/create-tour?tourId=X&contentLang=es
   */
  const editUrl = (row: TourTranslationInfo): string => {
    const base = `/${uiLang}/dashboard/create-tour?tourId=${tour!.id}`;
    // Always pass contentLang so create-tour knows which translation to load.
    // For the source language we still pass it so the form can reliably detect
    // isTranslationMode = false (contentLang === sourceLang).
    return `${base}&contentLang=${row.langcode}`;
  };

  if (!tour) return null;

  const tourPublished = rows.length > 0
      ? (rows.find((r) => r.langcode === sourceLang)?.published ?? tour.published)
      : tour.published;

  return (
      <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
        <Pressable style={[styles.backdrop, isMobile && styles.backdropMobile]} onPress={onClose}>
          <Pressable style={[styles.box, isMobile && styles.boxMobile]} onPress={() => {}}>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconBg}>
                <Ionicons name="globe-outline" size={22} color={AMBER} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{t('translationsSection.title')}</Text>
                <Text style={styles.subtitle} numberOfLines={2}>{tour.title}</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color={AMBER} />
                </View>
            ) : (
                <ScrollView style={isMobile ? { flex: 1 } : { maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                  {rows.length === 0 ? (
                      <Text style={styles.emptyText}>{t('translationsSection.empty')}</Text>
                  ) : (
                      <View style={styles.rowList}>
                        {rows.map((row) => {
                          const isSource = row.langcode === sourceLang;
                          const isBusy   = busyLang === row.langcode;
                          return (
                              <View key={row.langcode} style={styles.translRow}>
                                {/* Left: flag + name + pill */}
                                <View style={styles.translLeft}>
                                  <Flag code={langCodeToCountryCode(row.langcode)} size={20} />
                                  <Text style={styles.langName} numberOfLines={1}>{row.langName}</Text>
                                  <StatusPill status={isSource ? 'source' : row.published ? 'approved' : 'pending'} />
                                </View>
                                {/* Right: actions */}
                                <View style={styles.translActions}>
                                  {/*
                           * Edit button — navigates to the create-tour form keeping
                           * the current UI language prefix. The content language
                           * is passed as a query param (contentLang) so the form
                           * loads the correct translation without changing the UI.
                           */}
                                  <TouchableOpacity
                                      style={styles.iconBtn}
                                      onPress={() => {
                                        onClose();
                                        router.push(editUrl(row) as any);
                                      }}
                                      activeOpacity={0.8}
                                  >
                                    <Ionicons name="create-outline" size={15} color="#374151" />
                                  </TouchableOpacity>

                                  {/* Preview (all langs incl. source) */}
                                  <TouchableOpacity
                                      style={styles.iconBtn}
                                      onPress={() => { onClose(); router.push(previewUrl(row.langcode) as any); }}
                                      activeOpacity={0.8}
                                  >
                                    <Ionicons name="eye-outline" size={15} color="#374151" />
                                  </TouchableOpacity>

                                  {/* Approve (non-source, unpublished) */}
                                  {!isSource && !row.published && (
                                      <TouchableOpacity
                                          style={[styles.actionBtn, styles.btnApprove, isBusy && styles.btnDisabled]}
                                          onPress={() => handleApprove(row.langcode)}
                                          disabled={isBusy}
                                          activeOpacity={0.85}
                                      >
                                        {isBusy
                                            ? <ActivityIndicator size="small" color="#FFF" />
                                            : <>
                                              <Ionicons name="checkmark-circle-outline" size={13} color="#FFF" />
                                              <Text style={styles.btnApproveText}>{t('translationsSection.approve')}</Text>
                                            </>
                                        }
                                      </TouchableOpacity>
                                  )}

                                  {/* Unpublish (non-source, published) */}
                                  {!isSource && row.published && (
                                      <TouchableOpacity
                                          style={[styles.actionBtn, styles.btnUnpublish, isBusy && styles.btnDisabled]}
                                          onPress={() => handleUnpublishTranslation(row.langcode)}
                                          disabled={isBusy}
                                          activeOpacity={0.85}
                                      >
                                        {isBusy
                                            ? <ActivityIndicator size="small" color={DARK_AMBER} />
                                            : <>
                                              <Ionicons name="eye-off-outline" size={13} color={DARK_AMBER} />
                                              <Text style={styles.btnUnpublishText}>{t('translationsSection.unpublish')}</Text>
                                            </>
                                        }
                                      </TouchableOpacity>
                                  )}
                                </View>
                              </View>
                          );
                        })}
                      </View>
                  )}
                </ScrollView>
            )}

            {/* Error */}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Tour-level publish control */}
            <View style={styles.divider} />
            <View style={styles.tourActions}>
              {tourPublished ? (
                  <TouchableOpacity
                      style={[styles.tourBtn, styles.tourBtnUnpublish, busyTour && styles.btnDisabled]}
                      onPress={handleUnpublishTour}
                      disabled={busyTour}
                      activeOpacity={0.85}
                  >
                    {busyTour
                        ? <ActivityIndicator size="small" color={RED} />
                        : <>
                          <Ionicons name="eye-off-outline" size={15} color={RED} />
                          <Text style={styles.tourBtnUnpublishText}>{t('dashboard.tours.unpublishBtn')}</Text>
                        </>
                    }
                  </TouchableOpacity>
              ) : (
                  <TouchableOpacity
                      style={[styles.tourBtn, styles.tourBtnRepublish, busyTour && styles.btnDisabled]}
                      onPress={handleRepublishTour}
                      disabled={busyTour}
                      activeOpacity={0.85}
                  >
                    {busyTour
                        ? <ActivityIndicator size="small" color="#FFF" />
                        : <>
                          <Ionicons name="eye-outline" size={15} color="#FFF" />
                          <Text style={styles.tourBtnRepublishText}>{t('dashboard.tours.republishBtn')}</Text>
                        </>
                    }
                  </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.tourBtnClose} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.tourBtnCloseText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>

          </Pressable>
        </Pressable>
      </Modal>
  );
}

// ── StatusPill ────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: 'source' | 'approved' | 'pending' }) {
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

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  backdropMobile: {
    backgroundColor: '#FFFFFF',
    padding: 0,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  box: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 480,
    gap: 16,
    ...(Platform.OS === 'web'
        ? { boxShadow: '0 8px 32px rgba(0,0,0,0.18)' } as any
        : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 24,
          elevation: 12,
        }),
  },
  boxMobile: {
    flex: 1,
    borderRadius: 0,
    maxWidth: undefined as any,
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
    elevation: 0,
    shadowOpacity: 0,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },

  loadingBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },

  rowList: {
    gap: 10,
    paddingVertical: 4,
  },
  translRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  translLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    paddingLeft: 8,
  },
  langName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  translActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 8,
  },

  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
  btnApprove: { backgroundColor: GREEN },
  btnApproveText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  btnUnpublish: { backgroundColor: '#FFF', borderWidth: 1, borderColor: DARK_AMBER },
  btnUnpublishText: { color: DARK_AMBER, fontSize: 11, fontWeight: '700' },
  btnDisabled: { opacity: 0.55 },

  errorText: {
    fontSize: 12,
    color: RED,
    textAlign: 'center',
  },

  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: -4,
  },
  tourActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  tourBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    minWidth: 140,
  },
  tourBtnUnpublish: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: RED,
  },
  tourBtnUnpublishText: {
    fontSize: 13,
    fontWeight: '700',
    color: RED,
  },
  tourBtnRepublish: {
    backgroundColor: '#10B981',
  },
  tourBtnRepublishText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  tourBtnClose: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  tourBtnCloseText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
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