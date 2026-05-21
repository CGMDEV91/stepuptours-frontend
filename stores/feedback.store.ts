// stores/feedback.store.ts
// Estado global del modal de feedback — compartido por el FAB y el enlace del footer.

import { create } from 'zustand';

interface FeedbackState {
  isOpen: boolean;
  openFeedback: () => void;
  closeFeedback: () => void;
}

export const useFeedbackStore = create<FeedbackState>((set) => ({
  isOpen: false,
  openFeedback: () => set({ isOpen: true }),
  closeFeedback: () => set({ isOpen: false }),
}));
