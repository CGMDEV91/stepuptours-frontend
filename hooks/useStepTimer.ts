import { useRef, useCallback } from 'react';
import { track } from '../services/analytics.service';

interface UseStepTimerOptions {
  tourId: string;
  stepId: string;
  langcode: string;
}

export function useStepTimer({ tourId, stepId, langcode }: UseStepTimerOptions) {
  const enterTimeRef = useRef<number | null>(null);

  const onStepEnter = useCallback(() => {
    enterTimeRef.current = Date.now();
    void track('step_view', { langcode, tourId, stepId });
  }, [tourId, stepId, langcode]);

  const onStepComplete = useCallback(() => {
    const duration = enterTimeRef.current
      ? Math.round((Date.now() - enterTimeRef.current) / 1000)
      : 0;
    enterTimeRef.current = null;
    void track('step_complete', { langcode, tourId, stepId, valueInt: duration });
  }, [tourId, stepId, langcode]);

  const onStepAbandon = useCallback(() => {
    if (!enterTimeRef.current) return;
    const timeSpent = Math.round((Date.now() - enterTimeRef.current) / 1000);
    enterTimeRef.current = null;
    void track('step_abandon', { langcode, tourId, stepId, valueInt: timeSpent });
  }, [tourId, stepId, langcode]);

  return { onStepEnter, onStepComplete, onStepAbandon };
}
