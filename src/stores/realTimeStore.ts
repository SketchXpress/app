// src/stores/realTimeStore.ts
import { create } from "zustand";

interface RealTimeState {
  isConnected: boolean;
  lastUpdate: number;
  connectionState: "connecting" | "connected" | "disconnected" | "error";
  error: string | null;

  setConnectionState: (
    state: "connecting" | "connected" | "disconnected" | "error"
  ) => void;
  setError: (error: string | null) => void;
  updateLastUpdate: () => void;
}

export const useRealTimeStore = create<RealTimeState>((set) => ({
  isConnected: false,
  lastUpdate: Date.now(),
  connectionState: "disconnected",
  error: null,

  setConnectionState: (connectionState) =>
    set({
      connectionState,
      isConnected: connectionState === "connected",
      lastUpdate: Date.now(),
    }),

  setError: (error) => set({ error }),

  updateLastUpdate: () => set({ lastUpdate: Date.now() }),
}));
