// stores/serverError.store.ts
// Modal global de "problema de servidor": cualquier página puede activarlo
// cuando la carga de datos del backend falla o supera el timeout de UI.

import { create } from 'zustand';

interface ServerErrorState {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
}

export const useServerErrorStore = create<ServerErrorState>((set) => ({
  isVisible: false,
  show: () => set({ isVisible: true }),
  hide: () => set({ isVisible: false }),
}));
