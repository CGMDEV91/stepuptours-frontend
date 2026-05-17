// app/handoff.tsx
// Ruta de la web app que recibe el handoff de sesión desde la app nativa.
// La app abre https://<web>/handoff?token=<ott>&next=<ruta>; aquí se canjea el
// token de un solo uso por una sesión y se redirige a la ruta destino.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../stores/auth.store';

const AMBER = '#F59E0B';

export default function Handoff() {
  const { token, next } = useLocalSearchParams<{ token?: string; next?: string }>();
  const router = useRouter();
  const signInWithHandoff = useAuthStore((s) => s.signInWithHandoff);
  const [failed, setFailed] = useState(false);
  const done = useRef(false);

  const target = typeof next === 'string' && next.startsWith('/') ? next : '/';

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    (async () => {
      if (typeof token === 'string' && token) {
        try {
          await signInWithHandoff(token);
        } catch {
          // Token inválido o expirado: se continúa sin sesión.
        }
      }
      router.replace(target as any);
    })().catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>No se pudo continuar.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/' as any)}>
          <Text style={styles.btnText}>Ir al inicio</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={AMBER} />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: '#FFFFFF',
  },
  text: { fontSize: 15, color: '#374151' },
  btn: {
    backgroundColor: AMBER,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
});
