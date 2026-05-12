// app/[langcode]/privacy-policy.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import PageBanner from '../../components/layout/PageBanner';
import Footer from '../../components/layout/Footer';
import { PageScrollView } from '../../components/layout/PageScrollView';
import { webFullHeight } from '../../lib/web-styles';
import { PageHead } from '../../components/seo/PageHead';

const AMBER = '#F59E0B';

function renderLegalBody(text: string): React.ReactElement[] {
  const elements: React.ReactElement[] = [];
  text.split(/\n{2,}/).forEach((seg, i) => {
    if (seg.startsWith('### ')) {
      const nl = seg.indexOf('\n');
      if (nl !== -1) {
        elements.push(<Text key={`${i}-h`} style={styles.subTitle}>{seg.slice(4, nl)}</Text>);
        const rest = seg.slice(nl + 1).trim();
        if (rest) elements.push(<Text key={`${i}-b`} style={styles.body}>{rest}</Text>);
      } else {
        elements.push(<Text key={i} style={styles.subTitle}>{seg.slice(4)}</Text>);
      }
      return;
    }
    const lines = seg.split('\n');
    if (lines.some(l => l.startsWith('2022 '))) {
      elements.push(
        <View key={i} style={styles.list}>
          {lines.map((line, j) => <Text key={j} style={styles.listItem}>{line}</Text>)}
        </View>
      );
    } else {
      elements.push(<Text key={i} style={styles.body}>{seg}</Text>);
    }
  });
  return elements;
}

const SECTIONS = [
  { titleKey: 'legal.privacy.s1_title', bodyKey: 'legal.privacy.s1_body' },
  { titleKey: 'legal.privacy.s2_title', bodyKey: 'legal.privacy.s2_body' },
  { titleKey: 'legal.privacy.s3_title', bodyKey: 'legal.privacy.s3_body' },
  { titleKey: 'legal.privacy.s4_title', bodyKey: 'legal.privacy.s4_body' },
  { titleKey: 'legal.privacy.s5_title', bodyKey: 'legal.privacy.s5_body' },
  { titleKey: 'legal.privacy.s6_title', bodyKey: 'legal.privacy.s6_body' },
  { titleKey: 'legal.privacy.s7_title', bodyKey: 'legal.privacy.s7_body' },
  { titleKey: 'legal.privacy.s8_title', bodyKey: 'legal.privacy.s8_body' },
  { titleKey: 'legal.privacy.s9_title', bodyKey: 'legal.privacy.s9_body' },
  { titleKey: 'legal.privacy.s10_title', bodyKey: 'legal.privacy.s10_body' },
];

export default function PrivacyPolicyScreen() {
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const { t } = useTranslation();
  return (
    <View style={styles.root}>
      <PageHead langcode={langcode ?? 'en'} path="privacy-policy" title={t('legal.privacyPolicy')} />
      <PageScrollView>
        <PageBanner icon="shield-checkmark" iconBgColor="#10B981" title={t('legal.privacyPolicy')} />
        <View style={styles.inner}>
          <Text style={styles.intro}>{t('legal.privacy.intro')}</Text>
          {SECTIONS.map(s => (
            <View key={s.titleKey} style={styles.section}>
              <Text style={styles.sectionTitle}>{t(s.titleKey)}</Text>
              {renderLegalBody(t(s.bodyKey))}
            </View>
          ))}
        </View>
        <Footer />
      </PageScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB', ...webFullHeight },
  inner: {
    maxWidth: 860, alignSelf: 'center', width: '100%',
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 48,
  },
  intro: {
    fontSize: 15, color: '#374151', lineHeight: 26, marginBottom: 28,
    borderLeftWidth: 3, borderLeftColor: AMBER, paddingLeft: 14, paddingVertical: 4,
  },
  section: { marginBottom: 32 },
  sectionTitle: {
    fontSize: 17, fontWeight: '700', color: '#111827',
    marginBottom: 10, paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  subTitle: {
    fontSize: 13, fontWeight: '700', color: '#6B7280',
    marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  body: { fontSize: 15, color: '#374151', lineHeight: 26, marginBottom: 10 },
  list: { gap: 8, marginBottom: 12 },
  listItem: { fontSize: 15, color: '#4B5563', lineHeight: 26, paddingLeft: 4 },
});
