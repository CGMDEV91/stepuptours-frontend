// components/tour/AnonInfoModal.tsx
// Modal informativo para usuarios anónimos al entrar a la página de steps.
// Avisa de las limitaciones de no estar registrado.
// — Mobile: full-screen slide-up con X close + CTAs
// — Web: center card

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ANON_INFO_DISMISSED_KEY, setAnonInfoDismissed } from '../../lib/anon-progress';

export const ANON_INFO_STORAGE_KEY = ANON_INFO_DISMISSED_KEY;

interface AnonInfoModalProps {
  visible: boolean;
  onClose: () => void;
  onRegister: () => void;
}

const AMBER = '#F59E0B';
const BULLETS = [
  { icon: 'heart-dislike-outline' as const, key: 'anonInfo.bullet1' },
  { icon: 'cloud-offline-outline' as const, key: 'anonInfo.bullet2' },
  { icon: 'trophy-outline' as const, key: 'anonInfo.bullet3' },
];

function AnonInfoContent({
  t,
  dontShow,
  setDontShow,
}: {
  t: (key: string) => string;
  dontShow: boolean;
  setDontShow: (v: boolean) => void;
}) {
  return (
    <>
      {/* Header */}
      <View style={shared.header}>
        <View style={shared.iconWrapper}>
          <Ionicons name="person-outline" size={28} color={AMBER} />
        </View>
        <Text style={shared.title}>{t('anonInfo.title')}</Text>
        <Text style={shared.subtitle}>{t('anonInfo.subtitle')}</Text>
      </View>

      {/* Bullets */}
      <View style={shared.bulletsContainer}>
        {BULLETS.map((bullet) => (
          <View key={bullet.key} style={shared.bulletRow}>
            <View style={shared.bulletIconWrap}>
              <Ionicons name={bullet.icon} size={20} color={AMBER} />
            </View>
            <Text style={shared.bulletText}>{t(bullet.key)}</Text>
          </View>
        ))}
      </View>

      {/* Footer note */}
      <Text style={shared.footerNote}>{t('anonInfo.footer')}</Text>

      {/* Don't show again */}
      <TouchableOpacity
        style={shared.checkboxRow}
        onPress={() => setDontShow(!dontShow)}
        activeOpacity={0.7}
      >
        <View style={[shared.checkbox, dontShow && shared.checkboxChecked]}>
          {dontShow && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
        </View>
        <Text style={shared.checkboxLabel}>{t('onboarding.dontShow')}</Text>
      </TouchableOpacity>
    </>
  );
}

export function AnonInfoModal({ visible, onClose, onRegister }: AnonInfoModalProps) {
  const { t } = useTranslation();
  const [dontShow, setDontShow] = useState(false);

  const persistDismissal = async () => {
    if (dontShow) {
      await setAnonInfoDismissed();
    }
  };

  const handleContinue = async () => {
    await persistDismissal();
    onClose();
  };

  const handleRegister = async () => {
    await persistDismissal();
    onRegister();
  };

  const Buttons = (
    <View style={shared.buttonsRow}>
      <TouchableOpacity style={shared.registerButton} onPress={handleRegister} activeOpacity={0.85}>
        <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
        <Text style={shared.registerText}>{t('anonInfo.register')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={shared.continueButton} onPress={handleContinue} activeOpacity={0.85}>
        <Text style={shared.continueText}>{t('anonInfo.continue')}</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Mobile: full-screen ──────────────────────────────────────────────────────
  if (Platform.OS !== 'web') {
    return (
      <Modal visible={visible} animationType="slide" statusBarTranslucent>
        <SafeAreaView style={native.root}>
          <TouchableOpacity style={native.closeBtn} onPress={handleContinue} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color="#374151" />
          </TouchableOpacity>

          <ScrollView
            style={native.scroll}
            contentContainerStyle={native.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <AnonInfoContent t={t} dontShow={dontShow} setDontShow={setDontShow} />
          </ScrollView>

          <View style={native.ctaWrap}>{Buttons}</View>
        </SafeAreaView>
      </Modal>
    );
  }

  // ── Web: center card ────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={web.overlay}>
        <View style={web.card}>
          <AnonInfoContent t={t} dontShow={dontShow} setDontShow={setDontShow} />
          {Buttons}
        </View>
      </View>
    </Modal>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const shared = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: 8,
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  bulletsContainer: {
    gap: 14,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bulletIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  footerNote: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
    textAlign: 'center',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: AMBER,
    borderColor: AMBER,
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#4B5563',
  },
  buttonsRow: {
    gap: 10,
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: AMBER,
    borderRadius: 12,
    paddingVertical: 14,
  },
  registerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  continueButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingVertical: 14,
  },
  continueText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
});

// ── Native-only styles ────────────────────────────────────────────────────────
const native = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    padding: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 20,
  },
  ctaWrap: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
});

// ── Web-only styles ───────────────────────────────────────────────────────────
const web = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    gap: 20,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 40px rgba(0,0,0,0.18)' } as any)
      : {}),
  },
});
