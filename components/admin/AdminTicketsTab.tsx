// components/admin/AdminTicketsTab.tsx
// Admin support inbox: all tickets with open/resolved filter. Rows open the
// admin ticket chat screen.

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getAdminTickets, type Ticket, type TicketStatusFilter } from '../../services/tickets.service';

const AMBER = '#F59E0B';

interface AdminTicketsTabProps {
  onChanged?: () => void;
}

export function AdminTicketsTab({ onChanged }: AdminTicketsTabProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { langcode } = useLocalSearchParams<{ langcode: string }>();

  const [filter, setFilter] = useState<TicketStatusFilter>('open');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    getAdminTickets(filter)
      .then(setTickets)
      .catch((e) => setError(e?.message ?? t('common.error')))
      .finally(() => setLoading(false));
    onChanged?.();
  }, [filter, t, onChanged]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filters: { id: TicketStatusFilter; labelKey: string }[] = [
    { id: 'open',     labelKey: 'tickets.statusOpen' },
    { id: 'resolved', labelKey: 'tickets.statusResolved' },
    { id: 'all',      labelKey: 'dashboard.tours.filterAll' },
  ];

  return (
    <>
      <View style={styles.filterBar}>
        {filters.map((f) => {
          const active = f.id === filter;
          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => { setFilter(f.id); setLoading(true); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{t(f.labelKey)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={AMBER} /></View>
      ) : tickets.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbox-ellipses-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>{t('tickets.adminEmpty', 'No tickets here.')}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {tickets.map((tk) => {
            const hasUnread = tk.adminUnread > 0;
            return (
              <TouchableOpacity
                key={tk.nid}
                style={[styles.row, hasUnread && styles.rowUnread]}
                onPress={() => router.push(`/${langcode}/admin/tickets/${tk.nid}` as any)}
                activeOpacity={0.85}
              >
                <View style={styles.rowMain}>
                  <View style={styles.rowTop}>
                    <Text style={styles.ticketNumber}>{tk.number}</Text>
                    <View style={[styles.pill, tk.resolved ? styles.pillResolved : styles.pillOpen]}>
                      <Text style={[styles.pillText, { color: tk.resolved ? '#065F46' : '#92400E' }]}>
                        {tk.resolved ? t('tickets.statusResolved', 'Resolved') : t('tickets.statusOpen', 'Open')}
                      </Text>
                    </View>
                    {tk.kind === 'translation' && (
                      <View style={styles.kindChip}>
                        <Ionicons name="language-outline" size={11} color="#1D4ED8" />
                        <Text style={styles.kindChipText}>{t('tickets.kindTranslation', 'Translation')}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.rowTitle, hasUnread && styles.rowTitleUnread]} numberOfLines={1}>{tk.title}</Text>
                  {tk.ownerName ? <Text style={styles.owner}>{tk.ownerName}</Text> : null}
                </View>
                {hasUnread && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{tk.adminUnread > 9 ? '9+' : tk.adminUnread}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  filterBar: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F3F4F6' },
  filterChipActive: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: AMBER },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterChipTextActive: { color: '#D97706' },

  centered: { paddingVertical: 48, alignItems: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF', fontWeight: '500', textAlign: 'center' },

  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 14, paddingVertical: 12 },
  rowUnread: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  rowMain: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  ticketNumber: { fontSize: 13, fontWeight: '700', color: '#6B7280', letterSpacing: 0.3 },
  rowTitle: { fontSize: 15, color: '#374151' },
  rowTitleUnread: { fontWeight: '700', color: '#111827' },
  owner: { fontSize: 12, color: '#9CA3AF' },
  kindChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  kindChipText: { fontSize: 10, fontWeight: '700', color: '#1D4ED8' },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  pillOpen: { backgroundColor: '#FEF3C7' },
  pillResolved: { backgroundColor: '#D1FAE5' },
  pillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  errorText: { fontSize: 13, color: '#EF4444', textAlign: 'center', marginTop: 12 },
});
