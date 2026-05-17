// components/layout/ManageOnWebButton.tsx
// Botón que redirige la gestión de pagos a la web app autenticada.
// Se usa SOLO en apps nativas, donde no se procesan pagos in-app.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { openWebAuthenticated } from '../../lib/web-handoff';

const AMBER = '#F59E0B';

interface ManageOnWebButtonProps {
  /** Ruta de la web app, incluyendo langcode. Ej: "/es/dashboard". */
  path: string;
  /** Texto opcional del botón; por defecto "Gestionar en la web app". */
  label?: string;
  /** Oculta la nota explicativa bajo el botón. */
  hideNote?: boolean;
}

export function ManageOnWebButton({ path, label, hideNote }: ManageOnWebButtonProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    setLoading(true);
    try {
      await openWebAuthenticated(path);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.button}
        onPress={handlePress}
        activeOpacity={0.85}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="open-outline" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>{label ?? t('payment.manageOnWeb')}</Text>
          </>
        )}
      </TouchableOpacity>
      {!hideNote && <Text style={styles.note}>{t('payment.manageOnWebNote')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: AMBER,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  note: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  },
});
