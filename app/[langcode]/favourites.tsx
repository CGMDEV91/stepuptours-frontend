// app/[langcode]/favourites.tsx
// Favourite tours page — auth-protected

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/auth.store';
import { getUserActivitiesWithTours, upsertTourActivity } from '../../services/tours.service';
import type { ActivityWithTour } from '../../services/tours.service';
import { TourCard } from '../../components/tour/TourCard';
import PageBanner from '../../components/layout/PageBanner';
import Footer from '../../components/layout/Footer';
import { PageScrollView } from '../../components/layout/PageScrollView';
import { webFullHeight } from '../../lib/web-styles';

const AMBER = '#F59E0B';

const GRID_MAX_WIDTH = 1200;
const GAP = 20;

export default function FavouritesScreen() {
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);

  const [items, setItems] = useState<ActivityWithTour[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Responsive columns — same breakpoints as homepage
  const cols = width >= 768 ? 3 : width >= 640 ? 2 : 1;
  const PADDING = width >= 768 ? 32 : 16;
  const gridWidth = Math.min(width, GRID_MAX_WIDTH);
  const cardWidth =
    cols === 1
      ? width - PADDING * 2
      : (gridWidth - PADDING * 2 - GAP * (cols - 1)) / cols;

  // ── Redirect unauthenticated users ────────────────────────────────────────
  useEffect(() => {
    if (!user && !isAuthLoading) {
      const timer = setTimeout(() => {
        router.replace(`/${langcode}` as any);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user, isAuthLoading, langcode]);

  const fetchFavourites = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const all = await getUserActivitiesWithTours(user.id);
      setItems(all.filter((item) => item.activity.isFavorite));
    } catch (err: any) {
      setError(err.message ?? 'Error loading favourites');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFavourites();
  }, [fetchFavourites]);

  const handleToggleFavourite = useCallback(
    async (item: ActivityWithTour) => {
      if (!user) return;
      try {
        await upsertTourActivity(user.id, item.activity.tourId, { isFavorite: false });
        setItems((prev) =>
          prev.filter((i) => i.activity.tourId !== item.activity.tourId)
        );
      } catch {
        // Silently ignore toggle errors
      }
    },
    [user]
  );

  // ── Auth loading or redirecting ────────────────────────────────────────────
  if (isAuthLoading || !user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <PageScrollView
      style={styles.root}
      contentContainerStyle={styles.scrollContent}
    >
      <PageBanner
        icon="heart"
        iconBgColor="#EC4899"
        title={t('nav.favourites')}
        subtitle={t('favourites.subtitle')}
      />
      <View style={styles.body}>
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={56} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>{t('favourites.empty')}</Text>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => router.replace(`/${langcode}` as any)}
            >
              <Text style={styles.btnPrimaryText}>{t('home.allCountries')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.grid, { paddingHorizontal: PADDING }]}>
            {items.map((item) => (
              <View
                key={item.activity.tourId}
                style={{ width: cardWidth, paddingVertical: 10 }}
              >
                <TourCard
                  tour={item.tour}
                  cardWidth={cardWidth}
                  langcode={langcode}
                  isAuthenticated={true}
                  isFavorite={true}
                  isCompleted={item.activity.isCompleted}
                  onToggleFavorite={() => handleToggleFavourite(item)}
                />
              </View>
            ))}
          </View>
        )}
      </View>
      <Footer />
    </PageScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    ...webFullHeight,
  },
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    maxWidth: GRID_MAX_WIDTH,
    alignSelf: 'center',
    width: '100%',
    paddingVertical: 12,
  },

  // ── Centered states ────────────────────────────────────────────────────────
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },

  // ── Button ────────────────────────────────────────────────────────────────
  btnPrimary: {
    backgroundColor: AMBER,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
