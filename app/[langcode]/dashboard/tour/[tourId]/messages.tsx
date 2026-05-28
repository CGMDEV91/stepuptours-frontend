// app/[langcode]/dashboard/tour/[tourId]/messages.tsx
// Admin↔Guide messaging page — three thread tabs per tour.
// Accessible only by the tour owner (guide) or an admin.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../../../stores/auth.store';
import { isAdmin as isAdminRole, isGuide as isGuideRole } from '../../../../../lib/roles';
import {
  getTourComments,
  postTourComment,
  markCommentRead,
  getUnreadCountByThread,
  type TourComment,
  type ThreadType,
} from '../../../../../services/comments.service';
import { getTourById } from '../../../../../services/tours.service';
import PageBanner from '../../../../../components/layout/PageBanner';
import Footer from '../../../../../components/layout/Footer';
import { PageScrollView } from '../../../../../components/layout/PageScrollView';
import { webFullHeight } from '../../../../../lib/web-styles';
import type { Tour } from '../../../../../types';

const AMBER  = '#F59E0B';
const THREADS: { id: ThreadType; labelKey: string; icon: string }[] = [
  { id: 'tour_review',              labelKey: 'messages.threadSupport',     icon: 'headset-outline' },
  { id: 'tour_translation_request', labelKey: 'messages.threadTranslReq',   icon: 'language-outline' },
  { id: 'tour_translation_review',  labelKey: 'messages.threadTranslRev',   icon: 'checkmark-done-outline' },
];

// ── Bubble component ──────────────────────────────────────────────────────────

function Bubble({ comment, isOwn }: { comment: TourComment; isOwn: boolean }) {
  const { t } = useTranslation();
  const date = comment.createdAt
    ? new Date(comment.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
    : '';

  // Backend-automated messages ship an i18n key + JSON params (the message
  // text is NOT pre-translated on the server). Human-typed comments leave
  // messageKey null and we render comment.body verbatim.
  const text: string = comment.messageKey
    ? (t(comment.messageKey, comment.messageParams ?? {}) as string)
    : comment.body;

  return (
    <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
      {!isOwn && (
        <Text style={styles.bubbleAuthor}>{comment.authorPublicName}</Text>
      )}
      <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>
        {text}
      </Text>
      <Text style={[styles.bubbleTime, isOwn && styles.bubbleTimeOwn]}>{date}</Text>
    </View>
  );
}

// ── Thread tab ────────────────────────────────────────────────────────────────

interface ThreadTabProps {
  tourUuid: string;
  tourNid: number;
  threadType: ThreadType;
  currentUserId: string;
  /** True when the viewer is the guide (tour owner). Admins should not flip
   *  field_read_by_author since that field tracks the guide's read state. */
  shouldMarkRead: boolean;
  /** Called by ThreadTab after it auto-marks unread comments as read so the
   *  parent can refresh per-thread badge counters. */
  onMessagesRead?: () => void;
}

function ThreadTab({ tourUuid, tourNid, threadType, currentUserId, shouldMarkRead, onMessagesRead }: ThreadTabProps) {
  const { t } = useTranslation();
  const [comments, setComments]     = useState<TourComment[]>([]);
  const [loading, setLoading]       = useState(true);
  const [sending, setSending]       = useState(false);
  const [draft, setDraft]           = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTourComments(tourUuid, threadType);
      setComments(data);
      // Only the guide owner flips field_read_by_author — admins viewing the
      // same thread must not change the guide's unread state.
      if (shouldMarkRead) {
        const unread = data.filter(
          (c) => !c.readByAuthor && c.authorId !== currentUserId,
        );
        if (unread.length > 0) {
          await Promise.all(unread.map((c) => markCommentRead(c.id, threadType).catch(() => {})));
          onMessagesRead?.();
        }
      }
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, [tourUuid, threadType, currentUserId, shouldMarkRead, onMessagesRead]);

  useEffect(() => { loadComments(); }, [loadComments]);

  // Scroll to bottom when comments change.
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [comments.length]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const newComment = await postTourComment(tourUuid, tourNid, threadType, text);
      setComments((prev) => [...prev, newComment]);
      setDraft('');
    } catch (e: any) {
      // Silent: network error etc.
    } finally {
      setSending(false);
    }
  }, [draft, sending, tourUuid, tourNid, threadType]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color={AMBER} />
      </View>
    );
  }

  return (
    <View style={styles.threadContainer}>
      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        keyboardShouldPersistTaps="handled"
      >
        {comments.length === 0 ? (
          <View style={styles.emptyThread}>
            <Ionicons name="chatbubble-outline" size={40} color="#D1D5DB" />
            <Text style={styles.emptyThreadText}>{t('messages.empty')}</Text>
          </View>
        ) : (
          comments.map((c) => (
            <Bubble key={c.id} comment={c} isOwn={c.authorId === currentUserId} />
          ))
        )}
      </ScrollView>

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('messages.placeholder')}
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={2000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!draft.trim() || sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Ionicons name="send" size={18} color="#FFFFFF" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function TourMessagesScreen() {
  const { t }                    = useTranslation();
  const router                   = useRouter();
  const { langcode, tourId }     = useLocalSearchParams<{ langcode: string; tourId: string }>();
  const { width }                = useWindowDimensions();
  const isMobile                 = width < 768;
  // Pills show icon+text only when active on narrow screens so all 3 fit without scroll
  const isMobileNarrow           = Platform.OS !== 'web' || width < 520;

  const user         = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const isAdmin      = isAdminRole(user);
  const isGuide      = isGuideRole(user);

  const [tour, setTour]         = useState<Tour | null>(null);
  const [tourLoading, setTourLoading] = useState(true);
  const [activeThread, setActiveThread] = useState<ThreadType>('tour_review');
  const [unreadByThread, setUnreadByThread] = useState<Record<ThreadType, number>>({
    tour_review:              0,
    tour_translation_request: 0,
    tour_translation_review:  0,
  });

  // Load tour to get UUID and verify ownership.
  useEffect(() => {
    if (!tourId) return;
    setTourLoading(true);
    getTourById(tourId)
      .then(setTour)
      .catch(() => setTour(null))
      .finally(() => setTourLoading(false));
  }, [tourId, langcode]);

  // Access guard — redirect if not owner or admin.
  useEffect(() => {
    if (isAuthLoading || tourLoading) return;
    const isOwner = !!user && !!tour && tour.authorId === user.id;
    if (!user || (!isOwner && !isAdmin)) {
      router.replace(`/${langcode}` as any);
    }
  }, [isAuthLoading, tourLoading, user, tour, isAdmin, langcode]);

  // Fetch unread counts per thread (guides only — admin shouldn't see badges
  // for the guide's read state).
  const refreshUnread = useCallback(() => {
    if (!user || !tour || isAdmin) return;
    getUnreadCountByThread(user.id, tour.id)
      .then(setUnreadByThread)
      .catch(() => {});
  }, [user, tour, isAdmin]);

  useEffect(() => { refreshUnread(); }, [refreshUnread]);

  // When the guide opens a thread, mark its badge as 0 optimistically. The
  // real markCommentRead calls happen inside ThreadTab.loadComments.
  const handleSelectThread = useCallback((th: ThreadType) => {
    setActiveThread(th);
    if (!isAdmin) {
      setUnreadByThread((prev) => ({ ...prev, [th]: 0 }));
    }
  }, [isAdmin]);

  if (isAuthLoading || tourLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  if (!tour || !user) return null;

  const tourNid = tour.drupalInternalId ?? 0;
  const isOwner = tour.authorId === user.id;

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB', ...webFullHeight }}>
      <PageScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1 }}>
          <PageBanner
            icon="chatbubbles-outline"
            iconBgColor={AMBER}
            title={t('messages.title')}
            subtitle={tour.title}
            showBack
          />

          {/* Thread tabs */}
          <View style={styles.tabBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
              {THREADS.map((th) => {
                const isActive   = th.id === activeThread;
                const unread     = unreadByThread[th.id] ?? 0;
                // On narrow screens only show label for the active pill so all 3 fit without scrolling
                const showLabel  = isActive || !isMobileNarrow;
                return (
                  <TouchableOpacity
                    key={th.id}
                    style={[styles.tabPill, isActive && styles.tabPillActive, !showLabel && styles.tabPillCompact]}
                    onPress={() => handleSelectThread(th.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={th.icon as any} size={14} color={isActive ? '#FFFFFF' : '#6B7280'} />
                    {showLabel && (
                      <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                        {t(th.labelKey)}
                      </Text>
                    )}
                    {unread > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{unread > 9 ? '9+' : unread}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Active thread */}
          <View style={isMobile
            ? styles.contentMobile
            : styles.contentDesktop
          }>
            <ThreadTab
              key={activeThread}
              tourUuid={tour.id}
              tourNid={tourNid}
              threadType={activeThread}
              currentUserId={user.id}
              shouldMarkRead={isOwner && !isAdmin}
              onMessagesRead={refreshUnread}
            />
          </View>
        </View>
        <Footer />
      </PageScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tab bar
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabBarContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  tabPillActive: { backgroundColor: AMBER },
  tabPillCompact: { paddingHorizontal: 10 },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabLabelActive: { color: '#FFFFFF' },

  // Unread badge sitting on top-right of the pill
  unreadBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },

  // Layout
  contentMobile: { flex: 1, paddingHorizontal: 0 },
  contentDesktop: {
    flex: 1,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },

  // Thread — WhatsApp-style light background.
  threadContainer: {
    flex: 1,
    minHeight: 480,
    backgroundColor: '#ECE5DD', // WhatsApp default light wallpaper colour
  },
  messageList: { flex: 1 },
  messageListContent: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 14,
    flexGrow: 1,
  },

  // Empty state
  emptyThread: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyThreadText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },

  // Bubbles (WhatsApp visual language)
  bubble: {
    maxWidth: '78%',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 1px rgba(0,0,0,0.08)' } as any
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 1,
          elevation: 1,
        }),
  },
  bubbleOwn: {
    alignSelf: 'flex-end',
    backgroundColor: '#DCF8C6', // WhatsApp's outgoing bubble green
    borderBottomRightRadius: 2,
  },
  bubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 2,
  },
  bubbleAuthor: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
    marginBottom: 2,
  },
  bubbleText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  bubbleTextOwn: { color: '#111827' },
  bubbleTime: {
    fontSize: 10,
    color: '#6B7280',
    alignSelf: 'flex-end',
  },
  bubbleTimeOwn: { color: '#65676B' },

  // Input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: AMBER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
