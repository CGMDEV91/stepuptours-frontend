// components/layout/IntroSlides.tsx
// Pantalla de introducción deslizante — SOLO apps nativas, solo usuario no autenticado.
// Se muestra en cada apertura de la app mientras no haya sesión.
import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

const AMBER = '#F59E0B';

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  descKey: string;
}

const SLIDES: Slide[] = [
  { icon: 'compass-outline', titleKey: 'intro.slide1.title', descKey: 'intro.slide1.desc' },
  { icon: 'location-outline', titleKey: 'intro.slide2.title', descKey: 'intro.slide2.desc' },
  { icon: 'trophy-outline', titleKey: 'intro.slide3.title', descKey: 'intro.slide3.desc' },
];

interface IntroSlidesProps {
  onDone: () => void;
}

export function IntroSlides({ onDone }: IntroSlidesProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      if (next !== index) setIndex(next);
    },
    [width, index],
  );

  const handleNext = useCallback(() => {
    if (isLast) {
      onDone();
      return;
    }
    listRef.current?.scrollToOffset({ offset: (index + 1) * width, animated: true });
  }, [isLast, index, width, onDone]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onDone} activeOpacity={0.7} hitSlop={12}>
          <Text style={styles.skip}>{t('intro.skip')}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.titleKey}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.iconCircle}>
              <Ionicons name={item.icon} size={56} color={AMBER} />
            </View>
            <Text style={styles.title}>{t(item.titleKey)}</Text>
            <Text style={styles.desc}>{t(item.descKey)}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View key={s.titleKey} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.ctaWrap}>
        <TouchableOpacity style={styles.ctaButton} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.ctaText}>{isLast ? t('intro.start') : t('intro.next')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 500,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  skip: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 16,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  desc: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  dotActive: {
    width: 22,
    backgroundColor: AMBER,
  },
  ctaWrap: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  ctaButton: {
    backgroundColor: AMBER,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
