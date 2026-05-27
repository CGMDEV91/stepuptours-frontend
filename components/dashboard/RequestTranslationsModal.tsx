// components/dashboard/RequestTranslationsModal.tsx
// Modal for guide to request translations of a published tour.
// Posts a comment of type tour_translation_request notifying the admin.

import React, { useState } from 'react';
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
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import CountryFlag from 'react-native-country-flag';
import { postTourComment } from '../../services/comments.service';
import { langCodeToCountryCode } from '../../services/language.service';
import type { Tour } from '../../types';

const AMBER = '#F59E0B';

// Available target languages (all except English which is the source).
const TARGET_LANGUAGES: { code: string; label: string }[] = [
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'el', label: 'Ελληνικά' },
  { code: 'en', label: 'English' },
];

interface RequestTranslationsModalProps {
  visible: boolean;
  tour: Tour;
  guidePublicName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RequestTranslationsModal({
  visible,
  tour,
  guidePublicName,
  onClose,
  onSuccess,
}: RequestTranslationsModalProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const toggleLang = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const handleSend = async () => {
    if (selected.size === 0 || sending) return;
    setSending(true);
    setError(null);

    const langList = Array.from(selected)
      .map((c) => `${c.toUpperCase()}`)
      .join(', ');

    const body =
      `Guide ${guidePublicName} requests translations for tour "${tour.title}" ` +
      `(nid ${tour.drupalInternalId}) into: ${langList}. ` +
      `Please process within 24–48 hours.`;

    try {
      await postTourComment(tour.id, tour.drupalInternalId, 'tour_translation_request', body);
      setSelected(new Set());
      onSuccess?.();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? t('common.error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.box} onPress={() => {}}>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconBg}>
              <Ionicons name="language-outline" size={22} color={AMBER} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t('translations.requestModalTitle')}</Text>
              <Text style={styles.subtitle} numberOfLines={2}>{tour.title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Intro */}
          <Text style={styles.intro}>{t('translations.requestModalIntro')}</Text>

          {/* Language grid */}
          <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
            <View style={styles.langGrid}>
              {TARGET_LANGUAGES.map((lang) => {
                const isSelected = selected.has(lang.code);
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.langChip, isSelected && styles.langChipSelected]}
                    onPress={() => toggleLang(lang.code)}
                    activeOpacity={0.8}
                  >
                    <CountryFlag
                      isoCode={langCodeToCountryCode(lang.code)}
                      size={18}
                      style={styles.flag}
                    />
                    <Text style={[styles.langLabel, isSelected && styles.langLabelSelected]}>
                      {lang.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={14} color={AMBER} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Notice */}
          <View style={styles.notice}>
            <Ionicons name="time-outline" size={14} color="#6B7280" />
            <Text style={styles.noticeText}>{t('translations.notice24to48h')}</Text>
          </View>

          {/* Error */}
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnCancel} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.btnCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnSend, (selected.size === 0 || sending) && styles.btnSendDisabled]}
              onPress={handleSend}
              disabled={selected.size === 0 || sending}
              activeOpacity={0.8}
            >
              {sending
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={styles.btnSendText}>{t('translations.requestModalCta')}</Text>}
            </TouchableOpacity>
          </View>

        </Pressable>
      </Pressable>
    </Modal>
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
  box: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 440,
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

  // Header
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

  intro: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
  },

  // Language grid
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  langChipSelected: {
    borderColor: AMBER,
    backgroundColor: '#FFF7ED',
  },
  flag: {
    borderRadius: 2,
  },
  langLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  langLabelSelected: {
    color: '#D97706',
    fontWeight: '600',
  },

  // Notice
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  noticeText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },

  errorText: {
    fontSize: 13,
    color: '#EF4444',
    textAlign: 'center',
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btnCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  btnSend: {
    flex: 2,
    backgroundColor: AMBER,
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnSendDisabled: { opacity: 0.45 },
  btnSendText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
