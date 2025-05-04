import { create } from "zustand";

export interface Pool {
  id: string;
  address: string;
  name: string;
  type: string;
  description?: string;
}

interface PoolState {
  selectedPool: Pool | null;
  setSelectedPool: (pool: Pool) => void;
  clearSelectedPool: () => void;
}

export const usePoolStore = create<PoolState>((set) => ({
  selectedPool: null,
  setSelectedPool: (pool) => set({ selectedPool: pool }),
  clearSelectedPool: () => set({ selectedPool: null }),
}));
