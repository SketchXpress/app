// src/stores/collectionsStore.ts - Enhanced with volume data
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface Collection {
  collectionMint: string;
  collectionName: string;
  symbol?: string;
  uri?: string;
  signature: string;
  timestamp: number;
  isNew?: boolean;
  image?: string; // Add image for UI
}

export interface Pool {
  poolAddress: string;
  collectionMint: string;
  collectionName?: string;
  signature: string;
  timestamp: number;
  basePrice?: string;
  growthFactor?: string;
  isNew?: boolean;
}

export interface PoolMetrics {
  volume24h: number;
  transactions24h: number;
  uniqueTraders24h: number;
  priceChange24h: number;
  lastPrice: number;
}

export interface TrendingCollection {
  pool: Pool;
  collection?: Collection;
  metrics: PoolMetrics;
  trendingScore: number;
  rank: number;
}

interface CollectionsState {
  // Existing data from dropdown
  collections: Collection[];
  pools: Pool[];

  // New volume metrics
  poolMetrics: Map<string, PoolMetrics>;

  // Computed trending data
  trendingCollections: TrendingCollection[];

  // State flags
  isLoading: boolean;
  lastUpdate: number;
  connectionState: string;
  newCollectionsCount: number;
  newPoolsCount: number;
  error: string | null;

  // Actions
  addCollections: (collections: Collection[]) => void;
  addPools: (pools: Pool[]) => void;
  updatePoolMetrics: (
    metrics: Array<{ poolAddress: string; metrics: PoolMetrics }>
  ) => void;
  clearNewIndicators: () => void;
  setConnectionState: (state: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Computed getters
  getTrendingCollections: (limit?: number) => TrendingCollection[];
}

// Trending score calculation
function calculateTrendingScore(metrics: PoolMetrics, poolAge: number): number {
  const { volume24h, transactions24h, uniqueTraders24h, priceChange24h } =
    metrics;

  // Normalize and weight different factors
  const volumeScore = Math.log10(volume24h + 1) * 0.3;
  const transactionScore = Math.log10(transactions24h + 1) * 0.2;
  const traderScore = Math.log10(uniqueTraders24h + 1) * 0.2;
  const priceScore = Math.max(0, priceChange24h / 100) * 0.15;

  // Age decay (newer pools get slight boost)
  const ageHours = poolAge / (1000 * 60 * 60);
  const ageDecay = ageHours < 24 ? 1.1 : ageHours < 168 ? 1.0 : 0.9;
  const ageScore = (1 / (1 + ageHours / 168)) * 0.15;

  return (
    (volumeScore + transactionScore + traderScore + priceScore + ageScore) *
    ageDecay
  );
}

export const useCollectionsStore = create<CollectionsState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    collections: [],
    pools: [],
    poolMetrics: new Map(),
    trendingCollections: [],
    isLoading: true,
    lastUpdate: 0,
    connectionState: "disconnected",
    newCollectionsCount: 0,
    newPoolsCount: 0,
    error: null,

    // Actions
    addCollections: (newCollections) =>
      set((state) => {
        const existingMints = new Set(
          state.collections.map((c) => c.collectionMint)
        );
        const filteredNew = newCollections.filter(
          (c) => !existingMints.has(c.collectionMint)
        );

        if (filteredNew.length === 0) return state;

        return {
          collections: [
            ...filteredNew.map((c) => ({ ...c, isNew: true })),
            ...state.collections.map((c) => ({ ...c, isNew: false })),
          ],
          newCollectionsCount: state.newCollectionsCount + filteredNew.length,
          lastUpdate: Date.now(),
        };
      }),

    addPools: (newPools) =>
      set((state) => {
        const existingAddresses = new Set(
          state.pools.map((p) => p.poolAddress)
        );
        const filteredNew = newPools.filter(
          (p) => !existingAddresses.has(p.poolAddress)
        );

        if (filteredNew.length === 0) return state;

        return {
          pools: [
            ...filteredNew.map((p) => ({ ...p, isNew: true })),
            ...state.pools.map((p) => ({ ...p, isNew: false })),
          ],
          newPoolsCount: state.newPoolsCount + filteredNew.length,
          lastUpdate: Date.now(),
        };
      }),

    updatePoolMetrics: (updates) =>
      set((state) => {
        const newMetrics = new Map(state.poolMetrics);

        updates.forEach(({ poolAddress, metrics }) => {
          newMetrics.set(poolAddress, metrics);
        });

        // Recalculate trending collections when metrics update
        const trendingCollections = get().getTrendingCollections();

        return {
          poolMetrics: newMetrics,
          trendingCollections,
          lastUpdate: Date.now(),
        };
      }),

    clearNewIndicators: () =>
      set((state) => ({
        collections: state.collections.map((c) => ({ ...c, isNew: false })),
        pools: state.pools.map((p) => ({ ...p, isNew: false })),
        newCollectionsCount: 0,
        newPoolsCount: 0,
      })),

    setConnectionState: (connectionState) => set({ connectionState }),

    setLoading: (isLoading) => set({ isLoading }),

    setError: (error) => set({ error }),

    // Computed getter for trending collections
    getTrendingCollections: (limit = 20) => {
      const { pools, collections, poolMetrics } = get();

      const trendingData = pools.map((pool) => {
        // Find matching collection
        const collection = collections.find(
          (c) => c.collectionMint === pool.collectionMint
        );

        // Get metrics for this pool
        const metrics = poolMetrics.get(pool.poolAddress) || {
          volume24h: 0,
          transactions24h: 0,
          uniqueTraders24h: 0,
          priceChange24h: 0,
          lastPrice: 0,
        };

        // Calculate trending score
        const poolAge = Date.now() - pool.timestamp * 1000;
        const trendingScore = calculateTrendingScore(metrics, poolAge);

        console.table(pool);

        return {
          pool,
          collection,
          metrics,
          trendingScore,
          rank: 0, // Will be set after sorting
        };
      });

      // Sort by trending score and assign ranks
      return trendingData
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, limit)
        .map((item, index) => ({ ...item, rank: index + 1 }));
    },
  }))
);
