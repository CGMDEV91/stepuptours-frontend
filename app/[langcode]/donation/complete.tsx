// app/[langcode]/donation/complete.tsx
// Pantalla de retorno tras una donación procesada en la web app.
// La web redirige aquí mediante el deep link stepuptours://<lang>/donation/complete.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export default function DonationComplete() {
  const router = useRouter();
  const pathname = usePathname();
  const langcode = pathname.split('/').filter(Boolean)[0] ?? 'es';
  const { t } = useTranslation();

  const goHome = () => router.replace(`/${langcode}` as any);

  return (
    <View style={styles.centered}>
      <Ionicons name="heart-circle" size={72} color="#16A34A" />
      <Text style={styles.title}>{t('donation.completeTitle')}</Text>
      <Text style={styles.text}>{t('donation.completeDesc')}</Text>
      <TouchableOpacity style={styles.btn} onPress={goHome}>
        <Text style={styles.btnText}>{t('popup.goHome')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
    backgroundColor: '#FFFFFF',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', textAlign: 'center' },
  text: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  btn: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
