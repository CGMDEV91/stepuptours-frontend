// components/dashboard/MyDonationsTab.tsx
// "My donations" tab — donaciones hechas por el usuario actual.
// Wrapper sobre DonationsView en modo 'donor' (usa getMyDonations()).

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { DonationsView } from '../shared/DonationsView';

export function MyDonationsTab() {
  return (
    <View style={styles.container}>
      <DonationsView mode="donor" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
