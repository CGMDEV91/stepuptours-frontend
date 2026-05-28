// components/admin/MessagesTab.tsx
// Admin inbox listing tours with message activity.
// Each row links through to that tour's per-thread messages screen.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  getAdminMessagesInbox,
  type AdminInboxTour,
} from '../../services/comments.service';

const AMBER = '#F59E0B';

export function MessagesTab() {
  const { t }    = useTranslation();
  const router   = useRouter();
  const { langcode } = useLocalSearchParams<{ langcode: string }>();

  const [items, setItems]     = useState<AdminInboxTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminMessagesInbox();
      setItems(data);
    } catch (e: any) {
      setError(e?.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openTour = (tourNid: number) => {
    router.push(`/${langcode}/dashboard/tour/${tourNid}/messages` as any);
  };

  if (loading && items.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={AMBER} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={32} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.8}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={AMBER} />}
    >
      <Text style={styles.intro}>{t('admin.messages.intro')}</Text>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={42} color="#D1D5DB" />
          <Text style={styles.emptyText}>{t('admin.messages.empty')}</Text>
        </View>
      ) : (
        items.map((item) => {
          const totalUnread =
            item.totals.review.unreadFromGuide +
            item.totals.translationRequest.unreadFromGuide +
            item.totals.translationReview.unreadFromGuide;
          const date = new Date(item.lastCommentAt).toLocaleString(undefined, {
            dateStyle: 'short',
            timeStyle: 'short',
          });
          return (
            <TouchableOpacity
              key={item.tourId}
              style={styles.row}
              onPress={() => openTour(item.tourNid)}
              activeOpacity={0.8}
            >
              <View style={styles.rowHead}>
                <Text style={styles.title} numberOfLines={1}>{item.tourTitle}</Text>
                {totalUnread > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{totalUnread}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.subtitle} numberOfLines={1}>
                {item.ownerName ?? t('common.unknown')} · {date}
              </Text>
              <View style={styles.threadStrip}>
                <ThreadPill
                  label={t('messages.threadReview')}
                  total={item.totals.review.total}
                  unread={item.totals.review.unreadFromGuide}
                />
                <ThreadPill
                  label={t('messages.threadTranslReq')}
                  total={item.totals.translationRequest.total}
                  unread={item.totals.translationRequest.unreadFromGuide}
                />
                <ThreadPill
                  label={t('messages.threadTranslRev')}
                  total={item.totals.translationReview.total}
                  unread={item.totals.translationReview.unreadFromGuide}
                />
              </View>
              <View style={styles.chevronWrap}>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

function ThreadPill({ label, total, unread }: { label: string; total: number; unread: number }) {
  if (total === 0) return null;
  const isUnread = unread > 0;
  return (
    <View style={[styles.threadPill, isUnread && styles.threadPillUnread]}>
      <Text style={[styles.threadPillText, isUnread && styles.threadPillTextUnread]}>
        {label} · {total}
        {isUnread ? ` (${unread})` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  errorText: { color: '#EF4444', fontSize: 13 },
  retryBtn: {
    backgroundColor: AMBER,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  retryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  intro: {
    fontSize: 13,
    color: '#6B7280',
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyText: { color: '#9CA3AF', fontSize: 14 },

  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 10,
    position: 'relative',
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 22,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    paddingRight: 22,
  },
  threadStrip: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 10,
  },
  threadPill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  threadPillUnread: {
    backgroundColor: '#FEF3C7',
  },
  threadPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  threadPillTextUnread: {
    color: '#92400E',
  },
  chevronWrap: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -9 }],
  },
});
