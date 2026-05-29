// components/dashboard/TranslationsModal.tsx
// Unified translations modal (request + manage) for a guide's own tour.
//   • Top: request a translation — languages in a column; already-translated
//     ones appear disabled/marked. Sending posts a tour_translation_request.
//   • Separator.
//   • Bottom: existing (non-source) translations, each with an operations
//     dropdown (Edit / Preview / Publish-Unpublish / Delete translation).
// Whole-tour publish/unpublish lives at the card level, NOT here.

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
  deleteTourTranslation,
  getToursQuota,
  type TourTranslationInfo,
} from '../../services/dashboard.service';
import { createTicket } from '../../services/tickets.service';
import { langCodeToCountryCode } from '../../services/language.service';
import type { Tour } from '../../types';
import { buildTourSlug } from '../../lib/tour-slug';

const AMBER = '#F59E0B';
const RED   = '#EF4444';

// Available target languages (request section).
const TARGET_LANGUAGES: { code: string; label: string }[] = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'el', label: 'Ελληνικά' },
];

interface TranslationsModalProps {
  visible: boolean;
  tour: Tour | null;
  guidePublicName: string;
  onChanged: () => void;
  onClose: () => void;
}

export function TranslationsModal({
  visible,
  tour,
  guidePublicName,
  onChanged,
  onClose,
}: TranslationsModalProps) {
  const { t }     = useTranslation();
  const router    = useRouter();
  const pathname  = usePathname();
  const { width } = useWindowDimensions();
  const isMobile  = Platform.OS !== 'web' || width < 600;

  // UI language prefix kept when navigating to edit (so the interface lang
  // does not change). e.g. "/es/dashboard" → "es".
  const uiLang = pathname.split('/').filter(Boolean)[0] ?? 'en';

  // ── Manage state ──────────────────────────────────────────────────────────
  const [rows, setRows]             = useState<TourTranslationInfo[]>([]);
  const [sourceLang, setSourceLang] = useState<string>('');
  const [loading, setLoading]       = useState(false);
  const [busyLang, setBusyLang]     = useState<string | null>(null);
  const [openMenuLang, setOpenMenuLang] = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [confirm, setConfirm]       = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  // ── Request state ─────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending]   = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [planType, setPlanType] = useState<string | null>(null);

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
    if (visible && tour) {
      setSelected(new Set());
      setRequestSent(false);
      setOpenMenuLang(null);
      refresh();
      getToursQuota().then((q) => setPlanType(q.planType)).catch(() => setPlanType(null));
    }
  }, [visible, tour, refresh]);

  const isFreePlan = planType === 'free';

  // Languages that already exist (source + any translation, published or not).
  const doneLangs = new Set<string>([
    ...(sourceLang ? [sourceLang] : []),
    ...rows.map((r) => r.langcode),
    ...(tour?.availableLangs ?? []),
  ]);

  // ── Request ───────────────────────────────────────────────────────────────
  const toggleLang = (code: string) => {
    if (doneLangs.has(code)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const handleSend = async () => {
    if (!tour) return;
    // Free / no plan → cannot request translations. Prompt upgrade.
    if (isFreePlan) {
      setConfirm({
        title: t('plan.upgradeTitle', 'Upgrade your plan'),
        message: t('translations.upgradeRequired', 'Translations are a premium feature. Upgrade your plan to request translations.'),
        confirmLabel: t('plan.upgradeCta', 'Upgrade plan'),
        onConfirm: () => { onClose(); router.replace(`/${uiLang}/dashboard?tab=subscription` as any); },
      });
      return;
    }
    const targets = Array.from(selected).filter((c) => !doneLangs.has(c));
    if (targets.length === 0 || sending) return;
    setSending(true);
    setError(null);

    const labelFor = (code: string) =>
      TARGET_LANGUAGES.find((l) => l.code === code)?.label ?? code.toUpperCase();
    const langNames = targets.map(labelFor).join(', ');
    const langCodes = targets.map((c) => c.toUpperCase()).join(', ');

    const body = t('translations.requestBody', {
      guide: guidePublicName,
      title: tour.title,
      nid:   tour.drupalInternalId,
      langs: langNames,
      codes: langCodes,
    });

    try {
      // A translation request opens a dedicated support ticket (one per submit).
      await createTicket({
        title: `${t('tickets.translationTitle', 'Translation request')} — ${tour.title} (${langCodes})`,
        body,
        kind: 'translation',
        tourNid: tour.drupalInternalId,
      });
      setSelected(new Set());
      setRequestSent(true);
    } catch (e: any) {
      setError(e?.message ?? t('common.error'));
    } finally {
      setSending(false);
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
      onChanged();
    } catch (e: any) {
      setError(e?.message ?? t('common.error'));
    } finally {
      setBusyLang(null);
    }
  };

  const handleUnpublishTranslation = (lc: string) => {
    if (!tour || busyLang) return;
    setConfirm({
      title: t('dashboard.tours.unpublishTitle'),
      message: t('dashboard.tours.unpublishWarning'),
      confirmLabel: t('dashboard.tours.unpublishBtn'),
      onConfirm: async () => {
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
      },
    });
  };

  const handleDeleteTranslation = (lc: string) => {
    if (!tour || busyLang) return;
    setConfirm({
      title: t('translationsSection.deleteTitle', 'Delete translation'),
      message: t('translationsSection.deleteWarning', 'Delete this translation and its step translations? This cannot be undone.'),
      confirmLabel: t('common.delete'),
      onConfirm: async () => {
        setBusyLang(lc);
        setError(null);
        try {
          await deleteTourTranslation(tour.drupalInternalId, lc);
          refresh();
          onChanged();
        } catch (e: any) {
          setError(e?.message ?? t('common.error'));
        } finally {
          setBusyLang(null);
        }
      },
    });
  };

  // ── Navigation helpers ────────────────────────────────────────────────────
  const previewUrl = (lc: string) => {
    if (!tour) return '#';
    const slug = tour.drupalInternalId
        ? buildTourSlug({ country: tour.country?.name, city: tour.city?.name, nid: tour.drupalInternalId })
        : tour.id;
    return `/${lc}/tour/${slug}?preview=1`;
  };

  // Keep UI lang prefix; pass contentLang so create-tour loads that translation.
  const editUrl = (lc: string) => `/${uiLang}/dashboard/create-tour?tourId=${tour!.id}&contentLang=${lc}`;

  if (!tour) return null;

  return (
      <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
        <Pressable style={[styles.backdrop, isMobile && styles.backdropMobile]} onPress={onClose}>
          <Pressable style={[styles.box, isMobile && styles.boxMobile]} onPress={() => {}}>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconBg}>
                <Ionicons name="language-outline" size={22} color={AMBER} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{t('translationsSection.title')}</Text>
                <Text style={styles.subtitle} numberOfLines={2}>{tour.title}</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={isMobile ? { flex: 1 } : { maxHeight: 440 }} showsVerticalScrollIndicator={false}>
              {/* ── Request section ─────────────────────────────────────────── */}
              <Text style={styles.sectionLabel}>{t('translations.requestModalTitle')}</Text>
              <Text style={styles.intro}>{t('translations.requestModalIntro')}</Text>

              <View style={styles.langColumn}>
                {TARGET_LANGUAGES.map((lang) => {
                  const tr        = rows.find((r) => r.langcode === lang.code);
                  const isSource  = lang.code === sourceLang;
                  const isTranslated = !!tr;
                  const requestable  = !isTranslated && !isSource;
                  const isSelected = requestable && selected.has(lang.code);
                  const menuOpen   = openMenuLang === lang.code;
                  const isBusy     = busyLang === lang.code;

                  const rowInner = (
                    <>
                      <Flag code={langCodeToCountryCode(lang.code)} size={20} />
                      <Text style={[styles.langName, (isTranslated || isSource) && styles.langNameDone]}>{lang.label}</Text>
                      <View style={{ flex: 1 }} />
                      {isTranslated ? (
                        <>
                          <StatusPill status={tr!.published ? 'approved' : 'pending'} />
                          <TouchableOpacity
                            style={styles.opsBtn}
                            onPress={() => setOpenMenuLang(menuOpen ? null : lang.code)}
                            disabled={isBusy}
                            activeOpacity={0.8}
                          >
                            {isBusy
                              ? <ActivityIndicator size="small" color="#6B7280" />
                              : <Ionicons name="ellipsis-vertical" size={16} color="#374151" />}
                          </TouchableOpacity>
                        </>
                      ) : isSource ? (
                        <View style={styles.sourcePill}>
                          <Text style={styles.sourcePillText}>{t('translationsSection.statusSource', 'Original')}</Text>
                        </View>
                      ) : isSelected ? (
                        <Ionicons name="checkmark-circle" size={18} color={AMBER} />
                      ) : (
                        <Ionicons name="ellipse-outline" size={18} color="#D1D5DB" />
                      )}
                    </>
                  );

                  return (
                    <View key={lang.code} style={styles.langItemWrap}>
                      {requestable ? (
                        <TouchableOpacity
                          style={[styles.langRow, isSelected && styles.langRowSelected]}
                          onPress={() => toggleLang(lang.code)}
                          activeOpacity={0.8}
                        >
                          {rowInner}
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.langRow, styles.langRowDone]}>
                          {rowInner}
                        </View>
                      )}

                      {isTranslated && menuOpen && (
                        <View style={styles.opsMenu}>
                          <OpsItem
                            icon="create-outline"
                            label={t('common.edit', 'Edit')}
                            onPress={() => { setOpenMenuLang(null); onClose(); router.push(editUrl(lang.code) as any); }}
                          />
                          <OpsItem
                            icon="eye-outline"
                            label={t('common.preview', 'Preview')}
                            onPress={() => { setOpenMenuLang(null); onClose(); router.push(previewUrl(lang.code) as any); }}
                          />
                          {tr!.published ? (
                            <OpsItem
                              icon="eye-off-outline"
                              label={t('translationsSection.unpublish')}
                              onPress={() => { setOpenMenuLang(null); handleUnpublishTranslation(lang.code); }}
                            />
                          ) : (
                            <OpsItem
                              icon="checkmark-circle-outline"
                              label={t('translationsSection.approve')}
                              onPress={() => { setOpenMenuLang(null); handleApprove(lang.code); }}
                            />
                          )}
                          <OpsItem
                            icon="trash-outline"
                            label={t('translationsSection.deleteTitle', 'Delete translation')}
                            danger
                            onPress={() => { setOpenMenuLang(null); handleDeleteTranslation(lang.code); }}
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {requestSent ? (
                <View style={styles.noticeOk}>
                  <Ionicons name="checkmark-circle-outline" size={14} color="#065F46" />
                  <Text style={styles.noticeOkText}>{t('translations.requestSent', 'Request sent. We will get back to you soon.')}</Text>
                </View>
              ) : (
                <View style={styles.notice}>
                  <Ionicons name="time-outline" size={14} color="#6B7280" />
                  <Text style={styles.noticeText}>{t('translations.notice24to48h')}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.requestBtn, (selected.size === 0 || sending) && styles.btnDisabled]}
                onPress={handleSend}
                disabled={selected.size === 0 || sending}
                activeOpacity={0.85}
              >
                {sending
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={styles.requestBtnText}>{t('translations.requestModalCta')}</Text>}
              </TouchableOpacity>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </ScrollView>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.closeBtnText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </Pressable>

          {/* Confirmation overlay (inline, not a nested Modal) */}
          {confirm && (
            <View style={styles.confirmOverlay}>
              <Pressable style={styles.confirmBackdrop} onPress={() => setConfirm(null)} />
              <View style={styles.confirmBox}>
                <View style={styles.confirmIconBg}>
                  <Ionicons name="alert-circle-outline" size={24} color={RED} />
                </View>
                <Text style={styles.confirmTitle}>{confirm.title}</Text>
                <Text style={styles.confirmMessage}>{confirm.message}</Text>
                <View style={styles.confirmActions}>
                  <TouchableOpacity style={styles.confirmCancel} onPress={() => setConfirm(null)} activeOpacity={0.8}>
                    <Text style={styles.confirmCancelText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmOk}
                    onPress={() => { const fn = confirm.onConfirm; setConfirm(null); fn(); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.confirmOkText}>{confirm.confirmLabel}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </Pressable>
      </Modal>
  );
}

// ── Operations menu item ────────────────────────────────────────────────────
function OpsItem({ icon, label, onPress, danger }: { icon: any; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity style={styles.opsItem} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={16} color={danger ? RED : '#374151'} />
      <Text style={[styles.opsItemText, danger && { color: RED }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── StatusPill ────────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: 'approved' | 'pending' }) {
  const { t } = useTranslation();
  const map = {
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  backdropMobile: { backgroundColor: '#FFFFFF', padding: 0, justifyContent: 'flex-start', alignItems: 'stretch' },
  box: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, width: '100%', maxWidth: 480, gap: 14,
    ...(Platform.OS === 'web'
        ? { boxShadow: '0 8px 32px rgba(0,0,0,0.18)' } as any
        : { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 12 }),
  },
  boxMobile: { flex: 1, borderRadius: 0, maxWidth: undefined as any, paddingTop: Platform.OS === 'ios' ? 56 : 32, elevation: 0, shadowOpacity: 0 },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBg: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 4, marginBottom: 6 },
  intro: { fontSize: 13, color: '#6B7280', lineHeight: 19, marginBottom: 10 },

  // Request languages column
  langColumn: { gap: 8 },
  langItemWrap: { borderRadius: 10, overflow: 'hidden' },
  sourcePill: { backgroundColor: '#E0E7FF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  sourcePillText: { fontSize: 10, fontWeight: '700', color: '#3730A3', letterSpacing: 0.3 },
  langRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  langRowSelected: { borderColor: AMBER, backgroundColor: '#FFF7ED' },
  langRowDone: { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' },
  langName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  langNameDone: { color: '#16A34A' },

  notice: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F9FAFB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10 },
  noticeText: { fontSize: 12, color: '#6B7280', flex: 1 },
  noticeOk: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10 },
  noticeOkText: { fontSize: 12, color: '#065F46', flex: 1 },

  requestBtn: { backgroundColor: AMBER, borderRadius: 20, paddingVertical: 11, alignItems: 'center', marginTop: 10 },
  requestBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },

  loadingBox: { paddingVertical: 20, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },

  rowList: { gap: 10 },
  translWrap: { borderRadius: 8, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' },
  translRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 8, paddingHorizontal: 10 },
  translLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  opsBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },

  opsMenu: { borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  opsItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F3F4F6' },
  opsItemText: { fontSize: 14, color: '#374151', fontWeight: '500' },

  errorText: { fontSize: 12, color: RED, textAlign: 'center', marginTop: 10 },

  closeBtn: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 20, paddingVertical: 11, alignItems: 'center' },
  closeBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },

  btnDisabled: { opacity: 0.45 },

  // Inline confirm overlay
  confirmOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  confirmBox: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, gap: 10, alignItems: 'center',
    ...(Platform.OS === 'web'
        ? { boxShadow: '0 8px 32px rgba(0,0,0,0.18)' } as any
        : { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 12 }),
  },
  confirmIconBg: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  confirmTitle: { fontSize: 17, fontWeight: '700', color: '#111827', textAlign: 'center' },
  confirmMessage: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 6, alignSelf: 'stretch' },
  confirmCancel: { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 20, paddingVertical: 10, alignItems: 'center' },
  confirmCancelText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  confirmOk: { flex: 1, backgroundColor: RED, borderRadius: 20, paddingVertical: 10, alignItems: 'center' },
  confirmOkText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});

const pillStyles = StyleSheet.create({
  pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
});
