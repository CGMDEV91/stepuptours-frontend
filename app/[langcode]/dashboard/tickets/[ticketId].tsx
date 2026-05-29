// app/[langcode]/dashboard/tickets/[ticketId].tsx
// Support ticket chat (guide side). Read-only when the ticket is resolved.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../../stores/auth.store';
import { webFullHeight } from '../../../../lib/web-styles';
import { ChatBackground } from '../../../../components/chat/ChatBackground';
import { formatDateTime } from '../../../../lib/date-format';
import {
  getTicket,
  addTicketMessage,
  type Ticket,
  type TicketMessage,
} from '../../../../services/tickets.service';

const AMBER = '#F59E0B';

export default function TicketChatScreen() {
  const { langcode, ticketId } = useLocalSearchParams<{ langcode: string; ticketId: string }>();
  const nid = parseInt(ticketId ?? '0', 10);
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const insets = useSafeAreaInsets();
  // Extra breathing room below the input on mobile so it isn't flush with the footer.
  const bottomPad = isDesktop ? 10 : 20 + insets.bottom;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(() => {
    if (!nid) return;
    getTicket(nid)
      .then(({ ticket, messages }) => { setTicket(ticket); setMessages(messages); })
      .catch((e) => setError(e?.response?.status === 403 ? t('common.error') : (e?.message ?? t('common.error'))))
      .finally(() => setLoading(false));
  }, [nid, t]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 60);
    return () => clearTimeout(id);
  }, [messages.length]);

  const handleSend = async () => {
    if (sending || !draft.trim() || !ticket || ticket.resolved) return;
    const body = draft.trim();
    setSending(true);
    setError(null);
    try {
      await addTicketMessage(nid, body);
      setDraft('');
      load();
    } catch (e: any) {
      if (e?.response?.data?.code === 'resolved') {
        setError(t('tickets.resolvedNotice', 'This ticket is closed. Open a new one for other queries.'));
        load();
      } else {
        setError(e?.message ?? t('common.error'));
      }
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={AMBER} /></View>;
  }
  if (!ticket) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? t('common.error')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, isDesktop && styles.screenDesktop, webFullHeight]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.card, isDesktop && styles.cardDesktop]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#374151" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerNumber}>{ticket.number}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{ticket.title}</Text>
          </View>
          <View style={[styles.statusPill, ticket.resolved ? styles.statusResolved : styles.statusOpen]}>
            <Text style={[styles.statusText, { color: ticket.resolved ? '#065F46' : '#92400E' }]}>
              {ticket.resolved ? t('tickets.statusResolved', 'Resolved') : t('tickets.statusOpen', 'Open')}
            </Text>
          </View>
        </View>

        <View style={styles.threadWrap}>
          <ChatBackground />
          <ScrollView ref={scrollRef} style={styles.thread} contentContainerStyle={styles.threadContent}>
            {messages.map((m) => {
              const isSystem = !!m.msgKey;
              const isOwn = !isSystem && !!user && m.authorId === user.id;
              const text = isSystem ? (t(m.msgKey as string, m.msgParams ?? {}) as string) : m.body;
              if (isSystem) {
                return (
                  <View key={m.id} style={styles.systemRow}>
                    <Text style={styles.systemText}>{text}</Text>
                  </View>
                );
              }
              const authorLabel = m.authorIsAdmin ? t('tickets.supportAuthor', 'Support') : m.authorName;
              return (
                <View key={m.id} style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
                  {!isOwn && authorLabel ? <Text style={styles.author}>{authorLabel}</Text> : null}
                  <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>{text}</Text>
                  <Text style={[styles.timestamp, isOwn && styles.timestampOwn]}>{formatDateTime(m.createdAt)}</Text>
                  <View style={isOwn ? styles.tailOwn : styles.tailOther} />
                </View>
              );
            })}
          </ScrollView>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {ticket.resolved ? (
          <View style={[styles.resolvedBar, { paddingBottom: bottomPad }]}>
            <Ionicons name="checkmark-done-outline" size={16} color="#6B7280" />
            <Text style={styles.resolvedBarText}>
              {t('tickets.resolvedNotice', 'This ticket is closed. Open a new one for other queries.')}
            </Text>
          </View>
        ) : (
          <View style={[styles.inputBar, { paddingBottom: bottomPad }]}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder={t('messages.placeholder', 'Write a message…')}
              placeholderTextColor="#9CA3AF"
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, (sending || !draft.trim()) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={sending || !draft.trim()}
              activeOpacity={0.85}
            >
              {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send" size={18} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB' },
  screenDesktop: {
    backgroundColor: '#E9EBEF',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  card: { flex: 1, width: '100%', backgroundColor: '#FFFFFF' },
  cardDesktop: {
    maxWidth: 760,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 2 },
  headerNumber: { fontSize: 12, fontWeight: '700', color: '#6B7280', letterSpacing: 0.3 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusOpen: { backgroundColor: '#FEF3C7' },
  statusResolved: { backgroundColor: '#D1FAE5' },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

  threadWrap: { flex: 1, position: 'relative', overflow: 'hidden' },
  thread: { flex: 1, backgroundColor: 'transparent' },
  threadContent: { padding: 16, gap: 12 },
  systemRow: { alignItems: 'center', marginVertical: 4 },
  systemText: { fontSize: 12, color: '#6B7280', fontStyle: 'italic', textAlign: 'center', backgroundColor: 'rgba(243,244,246,0.92)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  bubble: { maxWidth: '85%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  bubbleOwn: { alignSelf: 'flex-end', backgroundColor: AMBER, borderBottomRightRadius: 3 },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderBottomLeftRadius: 3 },
  author: { fontSize: 11, fontWeight: '700', color: '#6B7280', marginBottom: 2 },
  bubbleText: { fontSize: 14, color: '#111827', lineHeight: 19 },
  bubbleTextOwn: { color: '#FFFFFF' },
  timestamp: { fontSize: 10, color: '#9CA3AF', marginTop: 4, alignSelf: 'flex-end' },
  timestampOwn: { color: 'rgba(255,255,255,0.85)' },
  tailOwn: {
    position: 'absolute', bottom: -2, right: 1,
    width: 0, height: 0,
    borderLeftWidth: 6, borderLeftColor: 'transparent',
    borderRightWidth: 6, borderRightColor: 'transparent',
    borderTopWidth: 9, borderTopColor: AMBER,
    transform: [{ rotate: '-22deg' }],
  },
  tailOther: {
    position: 'absolute', bottom: -2, left: 1,
    width: 0, height: 0,
    borderLeftWidth: 6, borderLeftColor: 'transparent',
    borderRightWidth: 6, borderRightColor: 'transparent',
    borderTopWidth: 9, borderTopColor: '#FFFFFF',
    transform: [{ rotate: '22deg' }],
  },

  errorText: { fontSize: 13, color: '#EF4444', textAlign: 'center', paddingHorizontal: 16, paddingBottom: 6 },

  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  input: { flex: 1, maxHeight: 120, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, color: '#111827', backgroundColor: '#FAFAFA' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: AMBER, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.5 },

  resolvedBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, backgroundColor: '#F3F4F6', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  resolvedBarText: { flex: 1, fontSize: 13, color: '#6B7280' },
});
