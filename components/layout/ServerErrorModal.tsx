// components/layout/ServerErrorModal.tsx
// Modal global mostrado cuando el backend no responde a tiempo o devuelve error.

import { Modal, Platform, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useServerErrorStore } from '../../stores/serverError.store';

export function ServerErrorModal() {
  const { t } = useTranslation();
  const isVisible = useServerErrorStore((s) => s.isVisible);
  const hide = useServerErrorStore((s) => s.hide);
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 768;

  if (!isVisible) return null;

  const content = (
    <View style={[styles.card, isDesktopWeb && styles.cardDesktop]}>
      <View style={styles.iconWrap}>
        <Ionicons name="cloud-offline-outline" size={36} color="#B91C1C" />
      </View>
      <Text style={styles.title}>{t('error.serverProblem.title')}</Text>
      <Text style={styles.message}>{t('error.serverProblem.message')}</Text>
      <TouchableOpacity style={styles.btn} onPress={hide} activeOpacity={0.85}>
        <Text style={styles.btnText}>{t('error.serverProblem.close')}</Text>
      </TouchableOpacity>
    </View>
  );

  if (isDesktopWeb) {
    return (
      // @ts-ignore — div nativo para overlay fijo en web
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 1000,
        }}
        onClick={hide}
      >
        {/* @ts-ignore */}
        <div onClick={(e: any) => e.stopPropagation()}>{content}</div>
      </div>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={hide}>
      <View style={styles.overlay}>{content}</View>
    </Modal>
  );
}

const styles = {
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%' as const,
    maxWidth: 400,
    alignItems: 'center' as const,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 20px 60px rgba(0,0,0,0.18)' } as any
      : { elevation: 16 }),
  },
  cardDesktop: {
    maxWidth: 420,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF2F2',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#111827',
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 20,
  },
  btn: {
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignSelf: 'stretch' as const,
    alignItems: 'center' as const,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' as const },
};
