// app/[langcode]/cookie-policy.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import PageBanner from '../../components/layout/PageBanner';
import Footer from '../../components/layout/Footer';
import { PageScrollView } from '../../components/layout/PageScrollView';
import { webFullHeight } from '../../lib/web-styles';

const AMBER = '#F59E0B';

function renderLegalBody(text: string): React.ReactElement[] {
  return text.split(/\n{2,}/).map((seg, i) => {
    if (seg.startsWith('### ')) {
      return <Text key={i} style={styles.subTitle}>{seg.slice(4)}</Text>;
    }
    const lines = seg.split('\n');
    if (lines.some(l => l.startsWith('2022 '))) {
      return (
        <View key={i} style={styles.list}>
          {lines.map((line, j) => (
            <Text key={j} style={styles.listItem}>{line}</Text>
          ))}
        </View>
      );
    }
    return <Text key={i} style={styles.body}>{seg}</Text>;
  });
}

const SECTIONS = [
  { titleKey: 'legal.cookie.s1_title', bodyKey: 'legal.cookie.s1_body' },
  { titleKey: 'legal.cookie.s2_title', bodyKey: 'legal.cookie.s2_body' },
  { titleKey: 'legal.cookie.s3_title', bodyKey: 'legal.cookie.s3_body' },
  { titleKey: 'legal.cookie.s4_title', bodyKey: 'legal.cookie.s4_body' },
  { titleKey: 'legal.cookie.s5_title', bodyKey: 'legal.cookie.s5_body' },
  { titleKey: 'legal.cookie.s6_title', bodyKey: 'legal.cookie.s6_body' },
];

export default function CookiePolicyScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.root}>
      <PageScrollView>
        <PageBanner icon="document-text" iconBgColor="#6366F1" title={t('legal.cookiePolicy')} />
        <View style={styles.inner}>
          <Text style={styles.intro}>{t('legal.cookie.intro')}</Text>
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
