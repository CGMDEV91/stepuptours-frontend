// stores/toast.store.ts
// Global single-slot toast store.
// Any component can call showToast() without navigating.
// A new toast replaces the current one (the Toast component handles the timer).

import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastState {
  message: string | null;
  type: ToastType;
  /** Incremented each time showToast is called so the component can detect
   *  a new message even when the text is identical to the previous one. */
  revision: number;
  showToast: (message: string, type?: ToastType) => void;
  hideToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message:  null,
  type:     'success',
  revision: 0,
  showToast: (message, type = 'success') =>
    set((s) => ({ message, type, revision: s.revision + 1 })),
  hideToast: () => set({ message: null }),
}));
