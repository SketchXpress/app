// src/stores/enhanceStore.ts
import { create } from "zustand";

interface EnhanceState {
  prompt: string;
  negativePrompt: string;
  temperature: number;
  guidanceScale: number;
  numImages: number;
  steps: number;
  seed: number | null;
  isModalOpen: boolean;

  setPrompt: (prompt: string) => void;
  setNegativePrompt: (negativePrompt: string) => void;
  setTemperature: (temp: number) => void;
  setGuidanceScale: (scale: number) => void;
  setNumImages: (num: number) => void;
  setSteps: (steps: number) => void;
  setSeed: (seed: number | null) => void;
  resetToDefaults: () => void;
  setModalOpen: (isOpen: boolean) => void;
}

const DEFAULT_STATE = {
  prompt: "",
  negativePrompt: "",
  temperature: 0.65,
  guidanceScale: 7.5, // Note: Using the backend default value
  numImages: 1,
  steps: 30,
  seed: null,
  isModalOpen: false,
};

export const useEnhanceStore = create<EnhanceState>((set) => ({
  ...DEFAULT_STATE,

  setPrompt: (prompt) => set({ prompt }),
  setNegativePrompt: (negativePrompt) => set({ negativePrompt }),
  setTemperature: (temperature) => set({ temperature }),
  setGuidanceScale: (guidanceScale) => set({ guidanceScale }),
  setNumImages: (numImages) => set({ numImages }),
  setSteps: (steps) => set({ steps }),
  setSeed: (seed) => set({ seed }),
  resetToDefaults: () => set(DEFAULT_STATE),
  setModalOpen: (isOpen) => set({ isModalOpen: isOpen }),
}));
