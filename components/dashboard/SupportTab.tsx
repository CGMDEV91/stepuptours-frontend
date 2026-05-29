// components/dashboard/SupportTab.tsx
// Guide support inbox: list of tickets (rows) + "new ticket" form.
// Tapping a row opens the ticket chat screen.

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getMyTickets, createTicket, type Ticket } from '../../services/tickets.service';

const AMBER = '#F59E0B';

interface SupportTabProps {
  onChanged?: () => void;
}

export function SupportTab({ onChanged }: SupportTabProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { langcode } = useLocalSearchParams<{ langcode: string }>();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setError(null);
    getMyTickets()
      .then(setTickets)
      .catch((e) => setError(e?.message ?? t('common.error')))
      .finally(() => setLoading(false));
    onChanged?.();
  }, [t, onChanged]);

  // Refresh when the tab regains focus (e.g. returning from a ticket chat).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openTicket = (nid: number) => {
    router.push(`/${langcode}/dashboard/tickets/${nid}` as any);
  };

  const handleCreate = async () => {
    if (creating || !newTitle.trim() || !newBody.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const ticket = await createTicket({ title: newTitle.trim(), body: newBody.trim() });
      setNewOpen(false);
      setNewTitle('');
      setNewBody('');
      load();
      openTicket(ticket.nid);
    } catch (e: any) {
      setError(e?.message ?? t('common.error'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.heading}>{t('tickets.title', 'Support tickets')}</Text>
        <TouchableOpacity style={styles.newBtn} onPress={() => setNewOpen(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.newBtnText}>{t('tickets.new', 'New ticket')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={AMBER} /></View>
      ) : tickets.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>{t('tickets.empty', 'You have no tickets yet.')}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {tickets.map((tk) => {
            const hasUnread = tk.unread > 0;
            return (
              <TouchableOpacity
                key={tk.nid}
                style={[styles.row, hasUnread && styles.rowUnread]}
                onPress={() => openTicket(tk.nid)}
                activeOpacity={0.85}
              >
                <View style={styles.rowMain}>
                  <View style={styles.rowTop}>
                    <Text style={styles.ticketNumber}>{tk.number}</Text>
                    <StatusPill resolved={tk.resolved} />
                    {tk.kind === 'translation' && (
                      <View style={styles.kindChip}>
                        <Ionicons name="language-outline" size={11} color="#1D4ED8" />
                        <Text style={styles.kindChipText}>{t('tickets.kindTranslation', 'Translation')}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.rowTitle, hasUnread && styles.rowTitleUnread]} numberOfLines={1}>
                    {tk.title}
                  </Text>
                </View>
                {hasUnread && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{tk.unread > 9 ? '9+' : tk.unread}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* New ticket modal */}
      <Modal transparent animationType="fade" visible={newOpen} onRequestClose={() => setNewOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setNewOpen(false)}>
          <Pressable style={styles.box} onPress={() => {}}>
            <View style={styles.boxHeader}>
              <Text style={styles.boxTitle}>{t('tickets.new', 'New ticket')}</Text>
              <TouchableOpacity onPress={() => setNewOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{t('tickets.reason', 'Reason')} <Text style={{ color: '#EF4444' }}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder={t('tickets.reasonPlaceholder', 'What is this about?')}
              placeholderTextColor="#9CA3AF"
              maxLength={120}
            />

            <Text style={styles.label}>{t('tickets.message', 'Message')} <Text style={{ color: '#EF4444' }}>*</Text></Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={newBody}
              onChangeText={setNewBody}
              placeholder={t('tickets.messagePlaceholder', 'Describe your request…')}
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.sendBtn, (creating || !newTitle.trim() || !newBody.trim()) && styles.btnDisabled]}
              onPress={handleCreate}
              disabled={creating || !newTitle.trim() || !newBody.trim()}
              activeOpacity={0.85}
            >
              {creating
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={styles.sendBtnText}>{t('tickets.create', 'Create ticket')}</Text>}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function StatusPill({ resolved }: { resolved: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={[pill.base, resolved ? pill.resolved : pill.open]}>
      <Text style={[pill.text, { color: resolved ? '#065F46' : '#92400E' }]}>
        {resolved ? t('tickets.statusResolved', 'Resolved') : t('tickets.statusOpen', 'Open')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  heading: { fontSize: 18, fontWeight: '700', color: '#111827' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: AMBER, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  newBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  centered: { paddingVertical: 48, alignItems: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF', fontWeight: '500', textAlign: 'center' },

  list: { gap: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  rowUnread: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  rowMain: { flex: 1, gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  ticketNumber: { fontSize: 13, fontWeight: '700', color: '#6B7280', letterSpacing: 0.3 },
  rowTitle: { fontSize: 15, color: '#374151' },
  rowTitleUnread: { fontWeight: '700', color: '#111827' },
  kindChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  kindChipText: { fontSize: 10, fontWeight: '700', color: '#1D4ED8' },

  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  errorText: { fontSize: 13, color: '#EF4444', textAlign: 'center', marginTop: 12 },

  // New ticket modal
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  box: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, width: '100%', maxWidth: 460, gap: 8,
    ...(Platform.OS === 'web' ? { boxShadow: '0 8px 32px rgba(0,0,0,0.18)' } as any
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 12 }),
  },
  boxHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  boxTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#111827', backgroundColor: '#FAFAFA' },
  inputMultiline: { minHeight: 90, paddingTop: 10 },
  sendBtn: { backgroundColor: AMBER, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 14 },
  sendBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
});

const pill = StyleSheet.create({
  base: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  open: { backgroundColor: '#FEF3C7' },
  resolved: { backgroundColor: '#D1FAE5' },
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
});
