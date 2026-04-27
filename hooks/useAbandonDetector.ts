import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { track, flushNow } from '../services/analytics.service';

interface UseAbandonDetectorOptions {
  tourId: string;
  langcode: string;
  totalSteps: number;
  completedSteps: number;
  isCompleted: boolean;
}

export function useAbandonDetector({
  tourId,
  langcode,
  totalSteps,
  completedSteps,
  isCompleted,
}: UseAbandonDetectorOptions) {
  // Refs para que los listeners no se re-registren en cada render
  const isCompletedRef = useRef(isCompleted);
  const completedRef = useRef(completedSteps);
  const totalRef = useRef(totalSteps);

  useEffect(() => { isCompletedRef.current = isCompleted; }, [isCompleted]);
  useEffect(() => { completedRef.current = completedSteps; }, [completedSteps]);
  useEffect(() => { totalRef.current = totalSteps; }, [totalSteps]);

  useEffect(() => {
    if (!tourId) return;

    const reportAbandon = () => {
      if (isCompletedRef.current) return;
      const pct =
        totalRef.current > 0
          ? Math.round((completedRef.current / totalRef.current) * 100)
          : 0;
      void track('tour_abandon', { langcode, tourId, valueInt: pct });
      void flushNow();
    };

    if (Platform.OS === 'web') {
      const handleUnload = () => reportAbandon();
      // visibilitychange es más fiable en móvil web (minimizar tab)
      const handleVisibility = () => {
        if (document.visibilityState === 'hidden') reportAbandon();
      };
      window.addEventListener('beforeunload', handleUnload);
      document.addEventListener('visibilitychange', handleVisibility);
      return () => {
        window.removeEventListener('beforeunload', handleUnload);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    } else {
      const handleAppState = (nextState: AppStateStatus) => {
        if (nextState === 'background' || nextState === 'inactive') {
          reportAbandon();
        }
      };
      const subscription = AppState.addEventListener('change', handleAppState);
      return () => subscription.remove();
    }
  }, [tourId, langcode]);
}
