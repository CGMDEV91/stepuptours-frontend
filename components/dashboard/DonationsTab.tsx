// components/dashboard/DonationsTab.tsx
// Donations tab for guide/professional dashboard — two sub-tabs: received vs made.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DonationsView } from '../shared/DonationsView';

const AMBER = '#F59E0B';
const AMBER_LIGHT = '#FEF3C7';
const AMBER_DARK = '#D97706';

interface DonationsTabProps {
  userId: string;
}

type SubTab = 'received' | 'made';

export function DonationsTab({ userId }: DonationsTabProps) {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<SubTab>('received');

  return (
    <View style={styles.container}>
      <View style={styles.segmented}>
        <TouchableOpacity
          style={[styles.segment, subTab === 'received' && styles.segmentActive]}
          onPress={() => setSubTab('received')}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentLabel, subTab === 'received' && styles.segmentLabelActive]}>
            {t('dashboard.donations.tabReceived')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, subTab === 'made' && styles.segmentActive]}
          onPress={() => setSubTab('made')}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentLabel, subTab === 'made' && styles.segmentLabelActive]}>
            {t('dashboard.donations.tabMade')}
          </Text>
        </TouchableOpacity>
      </View>

      {subTab === 'received' && <DonationsView mode="professional" userId={userId} />}
      {subTab === 'made' && <DonationsView mode="donor" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: AMBER_LIGHT,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  segment: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 9,
  },
  segmentActive: {
    backgroundColor: AMBER,
    shadowColor: AMBER_DARK,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: AMBER_DARK,
  },
  segmentLabelActive: {
    color: '#FFFFFF',
  },
});
