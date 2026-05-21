// components/admin/FeedbackTab.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getAdminFeedback } from '../../services/feedback.service';
import { AppFeedback } from '../../types';

const AMBER = '#F59E0B';
const LIMIT = 20;

function Stars({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={14}
          color={i <= rating ? AMBER : '#D1D5DB'}
        />
      ))}
    </View>
  );
}

interface DetailModalProps {
  item: AppFeedback | null;
  onClose: () => void;
}

function DetailModal({ item, onClose }: DetailModalProps) {
  const { t } = useTranslation();
  if (!item) return null;

  const dateStr = new Date(item.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Modal transparent animationType="fade" visible={!!item} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.detailBox} onPress={() => {}}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailTitle} numberOfLines={2}>{item.title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.detailMeta}>
            <Stars rating={item.rating} />
            <Text style={styles.detailDate}>{dateStr}</Text>
          </View>

          <View style={styles.detailUserRow}>
            <Ionicons name="person-circle-outline" size={16} color="#6B7280" />
            <Text style={styles.detailMetaText}>{item.username || '—'}</Text>
            <Ionicons name="mail-outline" size={16} color="#6B7280" style={{ marginLeft: 8 }} />
            <Text style={styles.detailMetaText}>{item.email || '—'}</Text>
          </View>

          <View style={styles.divider} />

          <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.detailDescription}>
              {item.description || t('admin.feedback.noDescription')}
            </Text>
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function FeedbackTab() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [items, setItems] = useState<AppFeedback[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AppFeedback | null>(null);

  const load = useCallback(async (p: number, append = false) => {
    if (p === 0) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const result = await getAdminFeedback(p, LIMIT);
      setTotal(result.total);
      setItems((prev) => append ? [...prev, ...result.data] : result.data);
    } catch {
      setError(t('admin.feedback.loadError'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [t]);

  useEffect(() => { load(0); }, [load]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    load(next, true);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={32} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load(0)}>
          <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="chatbubbles-outline" size={48} color="#D1D5DB" />
        <Text style={styles.emptyText}>{t('admin.feedback.empty')}</Text>
      </View>
    );
  }

  const hasMore = items.length < total;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>
        {t('admin.feedback.title')} <Text style={styles.countBadge}>({total})</Text>
      </Text>

      <View style={styles.hintRow}>
        <Ionicons name="hand-left-outline" size={14} color="#6B7280" />
        <Text style={styles.hintText}>{t('admin.feedback.rowHint')}</Text>
      </View>

      <ScrollView horizontal={isMobile} showsHorizontalScrollIndicator={false}>
        <View style={isMobile ? { minWidth: 660 } : undefined}>
          {/* Header row */}
          <View style={styles.tableHeader}>
            <Text style={[styles.colHeader, { flex: 2 }]}>{t('admin.feedback.col.title')}</Text>
            <Text style={[styles.colHeader, { flex: 1.5 }]}>{t('admin.feedback.col.user')}</Text>
            <Text style={[styles.colHeader, { flex: 2 }]}>{t('admin.feedback.col.email')}</Text>
            <Text style={[styles.colHeader, { flex: 1 }]}>{t('admin.feedback.col.rating')}</Text>
            <Text style={[styles.colHeader, { flex: 1.2, textAlign: 'right' }]}>{t('admin.feedback.col.date')}</Text>
            <View style={{ width: 32 }} />
          </View>

          {/* Data rows */}
          {items.map((item, idx) => {
            const dateStr = new Date(item.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
                onPress={() => setSelected(item)}
                activeOpacity={0.6}
              >
                <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="chatbox-ellipses-outline" size={15} color={AMBER} />
                  <Text style={[styles.cellTitle, { flex: 1 }]} numberOfLines={1}>{item.title}</Text>
                </View>
                <Text style={[styles.cellText, { flex: 1.5 }]} numberOfLines={1}>{item.username || '—'}</Text>
                <Text style={[styles.cellEmail, { flex: 2 }]} numberOfLines={1}>{item.email || '—'}</Text>
                <View style={{ flex: 1 }}>
                  <Stars rating={item.rating} />
                </View>
                <Text style={[styles.cellDate, { flex: 1.2, textAlign: 'right' }]}>{dateStr}</Text>
                <View style={{ width: 32, alignItems: 'flex-end' }}>
                  <Ionicons name="chevron-forward" size={18} color={AMBER} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {hasMore && (
        <TouchableOpacity
          style={styles.loadMoreBtn}
          onPress={handleLoadMore}
          disabled={loadingMore}
        >
          {loadingMore
            ? <ActivityIndicator size="small" color={AMBER} />
            : <Text style={styles.loadMoreText}>{t('common.loadMore')}</Text>
          }
        </TouchableOpacity>
      )}

      <DetailModal item={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    paddingVertical: 64,
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  countBadge: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -8,
    marginBottom: 14,
  },
  hintText: {
    fontSize: 13,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#9CA3AF',
    marginTop: 8,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: AMBER,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  colHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  tableRowAlt: {
    backgroundColor: '#F9FAFB',
  },
  cellTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  cellText: {
    fontSize: 13,
    color: '#111827',
  },
  cellEmail: {
    fontSize: 12,
    color: '#6B7280',
  },
  cellDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  loadMoreBtn: {
    marginTop: 16,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 120,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  // Detail modal
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  detailBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 520,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  detailTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  detailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  detailDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  detailUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  detailMetaText: {
    fontSize: 13,
    color: '#6B7280',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },
  detailDescription: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  closeBtn: {
    marginTop: 20,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
});
