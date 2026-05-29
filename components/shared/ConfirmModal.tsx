// components/shared/ConfirmModal.tsx
// Reusable confirmation / alert modal (cross-platform).
// - Confirmation: pass cancelLabel + destructive + onConfirm.
// - Alert (single button): omit cancelLabel; onConfirm closes.

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /** When provided, a cancel button is shown (confirmation dialog). */
  cancelLabel?: string;
  /** Red confirm button + warning icon. */
  destructive?: boolean;
  /** Disable buttons and show a spinner on confirm. */
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const RED = '#EF4444';
const AMBER = '#F59E0B';

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  busy,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose}>
        <Pressable style={styles.box} onPress={() => {}}>
          <View style={styles.iconRow}>
            <View style={[styles.iconBg, destructive ? styles.iconBgDanger : styles.iconBgAmber]}>
              <Ionicons
                name={destructive ? 'alert-circle-outline' : 'information-circle-outline'}
                size={24}
                color={destructive ? RED : AMBER}
              />
            </View>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            {cancelLabel ? (
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={onClose}
                disabled={busy}
                activeOpacity={0.8}
              >
                <Text style={styles.btnCancelText}>{cancelLabel}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.btnConfirm, destructive && styles.btnConfirmDanger, busy && styles.btnDisabled]}
              onPress={onConfirm}
              disabled={busy}
              activeOpacity={0.8}
            >
              {busy
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={styles.btnConfirmText}>{confirmLabel}</Text>}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

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
    padding: 24,
    width: '100%',
    maxWidth: 400,
    gap: 12,
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
  iconRow: { alignItems: 'center', marginBottom: 4 },
  iconBg: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  iconBgDanger: { backgroundColor: '#FEE2E2' },
  iconBgAmber: { backgroundColor: '#FEF3C7' },
  title: { fontSize: 17, fontWeight: '700', color: '#111827', textAlign: 'center' },
  message: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnCancelText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  btnConfirm: {
    flex: 1,
    backgroundColor: AMBER,
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnConfirmDanger: { backgroundColor: RED },
  btnConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.6 },
});
