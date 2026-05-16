// app/[langcode]/tour/[id]/steps.tsx
// Tour steps page — core gameplay

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToursStore } from '../../../../stores/tours.store';
import { useAuthStore } from '../../../../stores/auth.store';
import { getUserById } from '../../../../services/user.service';
import type { User } from '../../../../types';
import { StepTimeline } from '../../../../components/tour/StepTimeline';
import { CompletionPopup } from '../../../../components/tour/CompletionPopup';
import { TourOnboardingModal, ONBOARDING_STORAGE_KEY } from '../../../../components/tour/TourOnboardingModal';
import { AnonInfoModal } from '../../../../components/tour/AnonInfoModal';
import { getAnonProgress, setAnonProgress, clearAnonProgress, getAnonInfoDismissed } from '../../../../lib/anon-progress';
import { submitTourRating } from '../../../../services/tours.service';
import BackButton from '../../../../components/layout/BackButton';
import { CONTENT_MAX_WIDTH } from '../../../../styles/theme';
import { webFullHeight } from '../../../../lib/web-styles';
import { track } from '../../../../services/analytics.service';
import { useAbandonDetector } from '../../../../hooks/useAbandonDetector';

const AMBER = '#F59E0B';

export default function TourStepsScreen() {
  const { id, langcode } = useLocalSearchParams<{ id: string; langcode: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);
  const {
    currentTour: tour,
    currentSteps: steps,
    currentActivity: activity,
    isLoadingDetail,
    fetchTourDetail,
    updateActivity,
  } = useToursStore();

  const [showCompletion, setShowCompletion] = useState(false);
  const [xpAwardedBefore, setXpAwardedBefore] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAnonInfo, setShowAnonInfo] = useState(false);
  const [anonStepsCompleted, setAnonStepsCompleted] = useState<string[]>([]);
  const [guideUser, setGuideUser] = useState<User | null>(null);

  // Animated progress bar
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Ref for scroll-to-next-step
  const scrollViewRef = useRef<ScrollView>(null);

  // No auth guard: this page is open to anonymous users. Authenticated users
  // persist progress in tour_user_activity; anonymous users keep it locally.

  // Load tour detail + activity once auth is resolved (userId optional → anonymous)
  useEffect(() => {
    if (id && !isAuthLoading) {
      fetchTourDetail(id, user?.id);
    }
  }, [id, user?.id, isAuthLoading]);

  // Load locally-stored progress for anonymous users.
  // Must use tour.id (UUID) as key — the URL param `id` can be a slug, which
  // would mismatch the key written by handleCompleteStep (always uses tour.id).
  useEffect(() => {
    if (isAuthLoading || user || !tour?.id) return;
    getAnonProgress(tour.id).then(setAnonStepsCompleted).catch(() => {});
  }, [isAuthLoading, user, tour?.id]);

  // Track tour start once tour is loaded
  useEffect(() => {
    if (tour && langcode) {
      void track('tour_start', { langcode, tourId: tour.id });
    }
  }, [tour?.id, langcode]);

  // Fetch guide user when tour data is available
  useEffect(() => {
    if (tour?.authorId) {
      getUserById(tour.authorId)
        .then(setGuideUser)
        .catch(() => {}); // silent fail — guide card is optional
    }
  }, [tour?.authorId]);

  // Show onboarding on first visit; for anonymous users follow it with the
  // info modal (or show the info modal directly if onboarding is dismissed).
  useEffect(() => {
    if (isAuthLoading) return;
    let cancelled = false;
    (async () => {
      const onboardingDone = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY).catch(() => null);
      if (cancelled) return;
      if (!onboardingDone && stepsCompleted.length === 0) {
        setShowOnboarding(true);
        return;
      }
      if (!user) {
        const anonInfoDone = await getAnonInfoDismissed();
        if (!cancelled && !anonInfoDone) setShowAnonInfo(true);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading]);

  // Track xpAwarded state before completion
  useEffect(() => {
    if (activity) {
      setXpAwardedBefore(activity.xpAwarded);
    }
  }, [activity?.id]);

  const stepsCompleted = user ? (activity?.stepsCompleted ?? []) : anonStepsCompleted;
  const totalSteps = steps.length;

  // Animate progress bar whenever stepsCompleted changes
  useEffect(() => {
    const ratio = totalSteps > 0 ? stepsCompleted.length / totalSteps : 0;
    Animated.timing(progressAnim, {
      toValue: ratio,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [stepsCompleted.length, totalSteps]);

  const handleCompleteStep = useCallback(
    async (stepId: string) => {
      if (!tour) return;

      const newCompleted = [...stepsCompleted, stepId];
      const isLastStep = newCompleted.length >= totalSteps;

      if (user) {
        await updateActivity(user.id, tour.id, {
          stepsCompleted: newCompleted,
          ...(isLastStep ? { isCompleted: true } : {}),
        });
      } else {
        // Anonymous: progress lives only in local storage, never on the backend
        setAnonStepsCompleted(newCompleted);
        void setAnonProgress(tour.id, newCompleted);
      }

      if (isLastStep) {
        setShowCompletion(true);
      }
    },
    [user, tour, stepsCompleted, totalSteps, updateActivity],
  );

  const handleRestart = useCallback(async () => {
    if (!tour) return;
    if (user) {
      await updateActivity(user.id, tour.id, {
        stepsCompleted: [],
        isCompleted: false,
      });
    } else {
      setAnonStepsCompleted([]);
      void clearAnonProgress(tour.id);
    }
  }, [user, tour, updateActivity]);

  const handleRate = useCallback(
    async (rating: number) => {
      if (!tour) return;
      if (user) {
        await updateActivity(user.id, tour.id, { userRating: rating });
      } else {
        // Anonymous rating: persisted server-side as a uid-0 activity node
        await submitTourRating(tour.id, rating).catch(() => {});
      }
    },
    [user, tour, updateActivity],
  );

  const handleDonate = useCallback(
    (_amount: number) => {
      // Donation registered — user closes the popup manually via X or "Volver al inicio"
    },
    [],
  );

  const handleCloseCompletion = useCallback(() => {
    setShowCompletion(false);
    router.replace(`/${langcode}`);
  }, [langcode, router]);

  const handleCloseOnboarding = useCallback(async () => {
    setShowOnboarding(false);
    if (!user) {
      const anonInfoDone = await getAnonInfoDismissed();
      if (!anonInfoDone) setShowAnonInfo(true);
    }
  }, [user]);

  const handleRegisterFromAnonInfo = useCallback(() => {
    setShowAnonInfo(false);
    openAuthModal('register');
  }, [openAuthModal]);

  // Detect tour abandon (close tab / app background) — only when tour is loaded
  useAbandonDetector({
    tourId: tour?.id ?? '',
    langcode: langcode ?? 'en',
    totalSteps,
    completedSteps: stepsCompleted.length,
    isCompleted: activity?.isCompleted ?? false,
  });

  // While auth is restoring, show spinner. The page is open to anonymous users.
  if (isAuthLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  if (isLoadingDetail || !tour) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  const xp = 20 + 10 * totalSteps;

  return (
    <View style={styles.screen}>
      {/* Header — full-width bar with absolute back button (matches PageBanner pattern) */}
      <View style={styles.headerOuter}>
        <View style={styles.backButtonAbs}>
          <BackButton color="#374151" bgColor="#F3F4F6" fallbackRoute={`/${langcode}/tour/${id}`} />
        </View>
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>{tour.title}</Text>
            <View style={styles.headerCityRow}>
              <Ionicons name="location-outline" size={12} color="#9CA3AF" />
              <Text style={styles.headerCity}>{tour.city?.name}</Text>
            </View>
          </View>
          <View style={styles.headerProgress}>
            <Text style={styles.progressPercent}>{Math.round((stepsCompleted.length / totalSteps) * 100)}%</Text>
            <Text style={styles.progressFraction}>{stepsCompleted.length}/{totalSteps}</Text>
          </View>
        </View>
      </View>
      <View style={styles.progressBarBg}>
        <Animated.View
          style={[
            styles.progressBarFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      <ScrollView ref={scrollViewRef} style={styles.scrollView} contentContainerStyle={styles.scrollContent} bounces={false} overScrollMode="never">
        {/* Restart button */}
        {stepsCompleted.length > 0 && (
          <TouchableOpacity
            style={styles.restartButton}
            onPress={handleRestart}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={18} color={AMBER} />
            <Text style={styles.restartText}>{t('tour.restart')}</Text>
          </TouchableOpacity>
        )}

        {/* Step Timeline */}
        <StepTimeline
          steps={steps}
          stepsCompleted={stepsCompleted}
          onCompleteStep={handleCompleteStep}
          langcode={langcode ?? 'en'}
          tourId={tour.id}
          tourTitle={tour.title}
          scrollViewRef={scrollViewRef}
        />
      </ScrollView>

      {/* Onboarding Modal */}
      <TourOnboardingModal
        visible={showOnboarding}
        onClose={handleCloseOnboarding}
      />

      {/* Anonymous info modal — shown after onboarding for non-authenticated users */}
      <AnonInfoModal
        visible={showAnonInfo}
        onClose={() => setShowAnonInfo(false)}
        onRegister={handleRegisterFromAnonInfo}
      />

      {/* Completion Popup */}
      <CompletionPopup
        visible={showCompletion}
        tourName={tour.title}
        tourId={tour.id}
        xp={xp}
        isFirstCompletion={!xpAwardedBefore}
        onRate={handleRate}
        onDonate={handleDonate}
        onClose={handleCloseCompletion}
        langcode={langcode ?? 'en'}
        guideId={guideUser?.id}
        guideName={guideUser?.username}
        guideAvatar={guideUser?.avatar ?? null}
        guideRoles={guideUser?.roles}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    ...webFullHeight,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  headerOuter: {
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  backButtonAbs: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 48,
    left: 16,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 16 : 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    width: '100%',
  },
  headerInfo: {
    flex: 1,
    paddingLeft: 44,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  headerCityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  headerCity: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  headerProgress: {
    alignItems: 'flex-end',
  },
  progressPercent: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F59E0B',
  },
  progressFraction: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    width: '100%',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#E5E7EB',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
  },
  restartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AMBER,
    borderRadius: 8,
  },
  restartText: {
    fontSize: 14,
    fontWeight: '600',
    color: AMBER,
  },
});
