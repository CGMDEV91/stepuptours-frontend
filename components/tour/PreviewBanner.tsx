// components/tour/PreviewBanner.tsx
// Private-preview banner with optional approve / unpublish CTAs.
//
// Behaviour:
//   • Always shows the "Private preview — progress not saved" notice.
//   • If the viewer is the owner AND the current language is a translation
//     (not the source language) — shows:
//       · Owner sees this translation pending approval → [Approve] [Unpublish]
//       · Owner sees this translation already approved → [Unpublish]
//
// The "current" translation is the langcode in the URL prefix, equal to the
// page's langcode prop. `tour.availableLangs` reflects which translations are
// already published; if the current langcode is NOT in there, this preview is
// the "ready for review" state.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { approveTranslation, unpublishTranslation } from '../../services/dashboard.service';
import { useToursStore } from '../../stores/tours.store';
import type { Tour } from '../../types';

interface PreviewBannerProps {
  tour: Tour;
  langcode: string;
  isOwner: boolean;
}

export function PreviewBanner({ tour, langcode, isOwner }: PreviewBannerProps) {
  const { t }      = useTranslation();
  const router     = useRouter();
  const refetch    = useToursStore((s) => s.fetchTourDetail);

  const [busy, setBusy]   = useState<'approve' | 'unpublish' | null>(null);
  const [err, setErr]     = useState<string | null>(null);

  const isTranslation = langcode !== (tour.langcode ?? 'en');
  const alreadyPublished = (tour.availableLangs ?? []).includes(langcode);
  const showCtas = isOwner && isTranslation;

  const handleApprove = async () => {
    setBusy('approve'); setErr(null);
    try {
      await approveTranslation(tour.drupalInternalId, langcode);
      await refetch(tour.id);
    } catch (e: any) {
      setErr(e?.message ?? t('common.error'));
    } finally {
      setBusy(null);
    }
  };

  const handleUnpublish = async () => {
    setBusy('unpublish'); setErr(null);
    try {
      await unpublishTranslation(tour.drupalInternalId, langcode);
      // After unpublishing, the translation is no longer visible. Send the
      // guide back to their dashboard.
      router.replace(`/${tour.langcode ?? 'en'}/dashboard` as any);
    } catch (e: any) {
      setErr(e?.message ?? t('common.error'));
      setBusy(null);
    }
  };

  const headlineKey = !showCtas
    ? 'preview.bannerText'
    : alreadyPublished
      ? 'preview.translationPublished'
      : 'preview.pendingApproval';

  return (
    <View style={styles.banner}>
      <View style={styles.row}>
        <Ionicons name="eye-outline" size={16} color="#92400E" />
        <Text style={styles.text}>{t(headlineKey)}</Text>
      </View>

      {showCtas && (
        <View style={styles.actions}>
          {!alreadyPublished && (
            <TouchableOpacity
              style={[styles.btn, styles.btnApprove, busy && styles.btnDisabled]}
              onPress={handleApprove}
              disabled={!!busy}
              activeOpacity={0.85}
            >
              {busy === 'approve'
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.btnApproveText}>{t('preview.approveBtn')}</Text>
                  </>
                )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.btn, styles.btnUnpublish, busy && styles.btnDisabled]}
            onPress={handleUnpublish}
            disabled={!!busy}
            activeOpacity={0.85}
          >
            {busy === 'unpublish'
              ? <ActivityIndicator size="small" color="#92400E" />
              : (
                <>
                  <Ionicons name="eye-off-outline" size={14} color="#92400E" />
                  <Text style={styles.btnUnpublishText}>{t('preview.unpublishBtn')}</Text>
                </>
              )}
          </TouchableOpacity>
        </View>
      )}

      {err && <Text style={styles.err}>{err}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  btnApprove: {
    backgroundColor: '#16A34A',
  },
  btnApproveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  btnUnpublish: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#92400E',
  },
  btnUnpublishText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
  },
  btnDisabled: { opacity: 0.55 },
  err: {
    fontSize: 12,
    color: '#B91C1C',
    textAlign: 'center',
  },
});
