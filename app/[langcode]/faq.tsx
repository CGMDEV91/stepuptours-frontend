// app/[langcode]/faq.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import PageBanner from '../../components/layout/PageBanner';
import Footer from '../../components/layout/Footer';
import { PageScrollView } from '../../components/layout/PageScrollView';
import { webFullHeight } from '../../lib/web-styles';
import { PageHead } from '../../components/seo/PageHead';

const AMBER = '#F59E0B';

const CATEGORIES = [
  {
    titleKey: 'faq.cat1',
    items: [
      { questionKey: 'faq.q1', answerKey: 'faq.a1' },
      { questionKey: 'faq.q2', answerKey: 'faq.a2' },
      { questionKey: 'faq.q3', answerKey: 'faq.a3' },
    ],
  },
  {
    titleKey: 'faq.cat2',
    items: [
      { questionKey: 'faq.q4', answerKey: 'faq.a4' },
      { questionKey: 'faq.q5', answerKey: 'faq.a5' },
      { questionKey: 'faq.q6', answerKey: 'faq.a6' },
      { questionKey: 'faq.q7', answerKey: 'faq.a7' },
      { questionKey: 'faq.q8', answerKey: 'faq.a8' },
    ],
  },
  {
    titleKey: 'faq.cat3',
    items: [
      { questionKey: 'faq.q9',  answerKey: 'faq.a9' },
      { questionKey: 'faq.q10', answerKey: 'faq.a10' },
    ],
  },
  {
    titleKey: 'faq.cat4',
    items: [
      { questionKey: 'faq.q11', answerKey: 'faq.a11' },
      { questionKey: 'faq.q12', answerKey: 'faq.a12' },
      { questionKey: 'faq.q13', answerKey: 'faq.a13' },
    ],
  },
  {
    titleKey: 'faq.cat5',
    items: [
      { questionKey: 'faq.q14', answerKey: 'faq.a14' },
      { questionKey: 'faq.q15', answerKey: 'faq.a15' },
      { questionKey: 'faq.q16', answerKey: 'faq.a16' },
    ],
  },
  {
    titleKey: 'faq.cat6',
    items: [
      { questionKey: 'faq.q17', answerKey: 'faq.a17' },
      { questionKey: 'faq.q18', answerKey: 'faq.a18' },
    ],
  },
];

export default function FaqScreen() {
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const { t } = useTranslation();
  const [open, setOpen] = useState<Set<number>>(new Set());

  const toggle = (i: number) =>
    setOpen(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  let flatIndex = 0;

  return (
    <View style={styles.root}>
      <PageHead langcode={langcode ?? 'en'} path="faq" title={t('legal.faq')} />
      <PageScrollView>
        <PageBanner icon="help-circle" iconBgColor="#6366F1" title={t('legal.faq')} />
        <View style={styles.inner}>
          <Text style={styles.intro}>{t('faq.intro')}</Text>

          {CATEGORIES.map(cat => {
            const catStart = flatIndex;
            flatIndex += cat.items.length;
            return (
              <View key={cat.titleKey} style={styles.section}>
                <Text style={styles.sectionTitle}>{t(cat.titleKey)}</Text>
                {cat.items.map((item, j) => {
                  const idx = catStart + j;
                  const isOpen = open.has(idx);
                  return (
                    <View key={item.questionKey} style={styles.card}>
                      <TouchableOpacity
                        style={styles.cardHeader}
                        onPress={() => toggle(idx)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.cardTitle}>{t(item.questionKey)}</Text>
                        <Ionicons
                          name={isOpen ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color="#6B7280"
                        />
                      </TouchableOpacity>
                      {isOpen && (
                        <>
                          <View style={styles.cardBodySep} />
                          <View style={styles.cardBody}>
                            <Text style={styles.cardBodyText}>{t(item.answerKey)}</Text>
                          </View>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
        <Footer />
      </PageScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB', ...webFullHeight },
  inner: {
    maxWidth: 860,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 48,
  },
  intro: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 26,
    marginBottom: 28,
    borderLeftWidth: 3,
    borderLeftColor: AMBER,
    paddingLeft: 14,
    paddingVertical: 4,
  },
  section: { marginBottom: 32 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  cardBodySep: { height: 1, backgroundColor: '#F3F4F6' },
  cardBody: { paddingHorizontal: 16, paddingVertical: 14 },
  cardBodyText: { fontSize: 15, color: '#374151', lineHeight: 24 },
});
