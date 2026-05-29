// app/[langcode]/admin/tickets/[ticketId].tsx
// Admin ticket chat: reply + mark resolved.

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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../../stores/auth.store';
import { webFullHeight } from '../../../../lib/web-styles';
import {
  getAdminTicket,
  adminReplyTicket,
  adminResolveTicket,
  type Ticket,
  type TicketMessage,
} from '../../../../services/tickets.service';

const AMBER = '#F59E0B';

export default function AdminTicketChatScreen() {
  const { ticketId } = useLocalSearchParams<{ langcode: string; ticketId: string }>();
  const nid = parseInt(ticketId ?? '0', 10);
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(() => {
    if (!nid) return;
    getAdminTicket(nid)
      .then(({ ticket, messages }) => { setTicket(ticket); setMessages(messages); })
      .catch((e) => setError(e?.message ?? t('common.error')))
      .finally(() => setLoading(false));
  }, [nid, t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 60);
    return () => clearTimeout(id);
  }, [messages.length]);

  const handleSend = async () => {
    if (sending || !draft.trim() || !ticket) return;
    setSending(true);
    setError(null);
    try {
      await adminReplyTicket(nid, draft.trim());
      setDraft('');
      load();
    } catch (e: any) {
      setError(e?.message ?? t('common.error'));
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async () => {
    if (resolving || !ticket) return;
    setResolving(true);
    setError(null);
    try {
      await adminResolveTicket(nid);
      load();
    } catch (e: any) {
      setError(e?.message ?? t('common.error'));
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={AMBER} /></View>;
  }
  if (!ticket) {
    return <View style={styles.centered}><Text style={styles.errorText}>{error ?? t('common.error')}</Text></View>;
  }

  return (
    <KeyboardAvoidingView style={[styles.screen, webFullHeight]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#374151" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerNumber}>{ticket.number}{ticket.ownerName ? ` · ${ticket.ownerName}` : ''}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{ticket.title}</Text>
        </View>
        {!ticket.resolved && (
          <TouchableOpacity
            style={[styles.resolveBtn, resolving && styles.btnDisabled]}
            onPress={handleResolve}
            disabled={resolving}
            activeOpacity={0.85}
          >
            {resolving ? <ActivityIndicator size="small" color="#065F46" /> : (
              <>
                <Ionicons name="checkmark-done-outline" size={14} color="#065F46" />
                <Text style={styles.resolveBtnText}>{t('tickets.markResolved', 'Resolve')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      <ScrollView ref={scrollRef} style={styles.thread} contentContainerStyle={styles.threadContent}>
        {messages.map((m) => {
          const isSystem = !!m.msgKey;
          const isOwn = !isSystem && !!user && m.authorId === user.id;
          const text = isSystem ? (t(m.msgKey as string, m.msgParams ?? {}) as string) : m.body;
          if (isSystem) {
            return <View key={m.id} style={styles.systemRow}><Text style={styles.systemText}>{text}</Text></View>;
          }
          return (
            <View key={m.id} style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
              {!isOwn && m.authorName ? <Text style={styles.author}>{m.authorName}</Text> : null}
              <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>{text}</Text>
            </View>
          );
        })}
      </ScrollView>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {ticket.resolved ? (
        <View style={styles.resolvedBar}>
          <Ionicons name="checkmark-done-outline" size={16} color="#6B7280" />
          <Text style={styles.resolvedBarText}>{t('tickets.statusResolved', 'Resolved')}</Text>
        </View>
      ) : (
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('messages.placeholder', 'Write a message…')}
            placeholderTextColor="#9CA3AF"
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (sending || !draft.trim()) && styles.btnDisabled]}
            onPress={handleSend}
            disabled={sending || !draft.trim()}
            activeOpacity={0.85}
          >
            {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send" size={18} color="#FFFFFF" />}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn: { padding: 2 },
  headerNumber: { fontSize: 12, fontWeight: '700', color: '#6B7280', letterSpacing: 0.3 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  resolveBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#D1FAE5', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  resolveBtnText: { fontSize: 12, fontWeight: '700', color: '#065F46' },

  thread: { flex: 1 },
  threadContent: { padding: 16, gap: 10 },
  systemRow: { alignItems: 'center', marginVertical: 4 },
  systemText: { fontSize: 12, color: '#6B7280', fontStyle: 'italic', textAlign: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  bubble: { maxWidth: '85%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  bubbleOwn: { alignSelf: 'flex-end', backgroundColor: AMBER },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  author: { fontSize: 11, fontWeight: '700', color: '#6B7280', marginBottom: 2 },
  bubbleText: { fontSize: 14, color: '#111827', lineHeight: 19 },
  bubbleTextOwn: { color: '#FFFFFF' },

  errorText: { fontSize: 13, color: '#EF4444', textAlign: 'center', paddingHorizontal: 16, paddingBottom: 6 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  input: { flex: 1, maxHeight: 120, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, color: '#111827', backgroundColor: '#FAFAFA' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: AMBER, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.5 },
  resolvedBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, backgroundColor: '#F3F4F6', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  resolvedBarText: { flex: 1, fontSize: 13, color: '#6B7280' },
});
