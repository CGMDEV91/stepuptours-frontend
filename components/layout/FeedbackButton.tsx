// components/layout/FeedbackButton.tsx
// Floating pill + modal for authenticated users to submit app feedback.
// Modal visibility is driven by useFeedbackStore so the footer link can open it too.
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { usePathname } from 'expo-router';
import { submitFeedback } from '../../services/feedback.service';
import { useFeedbackStore } from '../../stores/feedback.store';
import { ReviewIcon } from '../icons/ReviewIcon';
import { isNative } from '../../lib/platform';

const AMBER = '#F59E0B';

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={stars.row}>
      {[1, 2, 3, 4, 5].map((i) => (
        <TouchableOpacity key={i} onPress={() => onChange(i)} hitSlop={6}>
          <Ionicons
            name={i <= value ? 'star' : 'star-outline'}
            size={28}
            color={i <= value ? AMBER : '#D1D5DB'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const stars = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginVertical: 8 },
});

export function FeedbackButton() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const isOpen = useFeedbackStore((s) => s.isOpen);
  const openFeedback = useFeedbackStore((s) => s.openFeedback);
  const closeFeedback = useFeedbackStore((s) => s.closeFeedback);

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setRating(0);
    setTitle('');
    setDescription('');
    setSuccess(false);
    setError(null);
  };

  const handleClose = () => {
    closeFeedback();
    reset();
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError(t('feedback.errorTitle'));
      return;
    }
    if (rating === 0) {
      setError(t('feedback.errorRating'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await submitFeedback({ title: title.trim(), description: description.trim(), rating });
      setSuccess(true);
      setTimeout(handleClose, 1800);
    } catch {
      setError(t('feedback.errorSubmit'));
    } finally {
      setLoading(false);
    }
  };

  // Hide the FAB on the admin page — the modal stays available via the footer link.
  const showFab = !pathname.includes('/admin');
  const bottomOffset = isNative ? 88 : 24;

  return (
    <>
      {showFab && (
        <TouchableOpacity
          style={[styles.fab, { bottom: bottomOffset }]}
          onPress={openFeedback}
          activeOpacity={0.85}
        >
          <ReviewIcon size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      <Modal transparent animationType="fade" visible={isOpen} onRequestClose={handleClose}>
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{t('feedback.title')}</Text>
              <TouchableOpacity onPress={handleClose} hitSlop={8}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {success ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
                <Text style={styles.successText}>{t('feedback.successMessage')}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.label}>{t('feedback.ratingLabel')}</Text>
                <StarPicker value={rating} onChange={setRating} />

                <Text style={styles.label}>{t('feedback.titleLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder={t('feedback.titlePlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  maxLength={100}
                  returnKeyType="next"
                />

                <Text style={styles.label}>{t('feedback.descriptionLabel')}</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={t('feedback.descriptionPlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  maxLength={500}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                {error && (
                  <View style={styles.errorRow}>
                    <Ionicons name="alert-circle-outline" size={15} color="#EF4444" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : <Text style={styles.submitBtnText}>{t('feedback.submit')}</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AMBER,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 8,
    ...(Platform.OS === 'web' ? ({ zIndex: 999 } as any) : {}),
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 480,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  textarea: {
    minHeight: 90,
    paddingTop: 10,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    flex: 1,
  },
  submitBtn: {
    marginTop: 20,
    backgroundColor: AMBER,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
});
