// app/[langcode]/terms-of-use.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import PageBanner from '../../components/layout/PageBanner';
import Footer from '../../components/layout/Footer';
import { PageScrollView } from '../../components/layout/PageScrollView';
import { webFullHeight } from '../../lib/web-styles';

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
    if (lines.some(l => l.startsWith('• '))) {
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
  { titleKey: 'legal.terms.s1_title',  bodyKey: 'legal.terms.s1_body'  },
  { titleKey: 'legal.terms.s2_title',  bodyKey: 'legal.terms.s2_body'  },
  { titleKey: 'legal.terms.s3_title',  bodyKey: 'legal.terms.s3_body'  },
  { titleKey: 'legal.terms.s4_title',  bodyKey: 'legal.terms.s4_body'  },
  { titleKey: 'legal.terms.s5_title',  bodyKey: 'legal.terms.s5_body'  },
  { titleKey: 'legal.terms.s6_title',  bodyKey: 'legal.terms.s6_body'  },
  { titleKey: 'legal.terms.s7_title',  bodyKey: 'legal.terms.s7_body'  },
  { titleKey: 'legal.terms.s8_title',  bodyKey: 'legal.terms.s8_body'  },
  { titleKey: 'legal.terms.s9_title',  bodyKey: 'legal.terms.s9_body'  },
  { titleKey: 'legal.terms.s10_title', bodyKey: 'legal.terms.s10_body' },
  { titleKey: 'legal.terms.s11_title', bodyKey: 'legal.terms.s11_body' },
  { titleKey: 'legal.terms.s12_title', bodyKey: 'legal.terms.s12_body' },
  { titleKey: 'legal.terms.s13_title', bodyKey: 'legal.terms.s13_body' },
];

export default function TermsOfUseScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.root}>
      <PageScrollView>
        <PageBanner icon="document-lock-outline" iconBgColor="#3B82F6" title={t('legal.termsOfUse')} />
        <View style={styles.inner}>
          <Text style={styles.intro}>{t('legal.terms.intro')}</Text>
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
