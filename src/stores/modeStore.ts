import { create } from "zustand";

type Mode = "kids" | "pro";

interface ModeStore {
  mode: Mode;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
}

export const useModeStore = create<ModeStore>((set) => ({
  mode: "pro", // Default Mode
  setMode: (mode) => set({ mode }),
  toggleMode: () =>
    set((state) => ({
      mode: state.mode === "kids" ? "pro" : "kids",
    })),
}));
