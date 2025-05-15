/* eslint-disable @typescript-eslint/no-explicit-any */
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
  image?: string;
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

// New interfaces for pool-specific data
export interface NFT {
  mintAddress: string;
  name?: string;
  symbol?: string;
  uri?: string;
  timestamp?: number;
  signature: string;
  price?: number;
  minterAddress?: string;
  image?: string;
}

export interface HistoryItem {
  signature: string;
  blockTime: number | null | undefined;
  instructionName: string;
  accounts: any[];
  args: any;
  description: string;
  type: string;
  source: string;
  error: any;
  poolAddress?: string;
  price?: number;
}

export interface PoolInfo {
  collection: string;
  creator: string;
  basePrice: number;
  growthFactor: number;
  currentSupply: number;
  protocolFeePercent: number;
  totalEscrowed: number;
  isActive: boolean;
  migrationStatus: string;
  migrationProgress: string;
  collectionName?: string;
}

export interface PoolDetails {
  info: PoolInfo | null;
  nfts: NFT[];
  history: HistoryItem[];
  lastUpdated: number;
  isLoading: boolean;
  error?: string;
}

export interface PoolDetailsWithRealtime {
  info: PoolInfo | null;
  nfts: NFT[];
  history: HistoryItem[];
  metrics: PoolMetrics | null;
  lastUpdate: number;
  hasRealtimeData: boolean;
  connectionState: string;
  isLoading: boolean;
  error?: string;
}

interface CollectionsState {
  // Existing data
  collections: Collection[];
  pools: Pool[];
  poolMetrics: Map<string, PoolMetrics>;
  trendingCollections: TrendingCollection[];

  // Enhanced pool-specific data
  poolDetails: Map<string, PoolDetails>;
  poolNFTs: Map<string, NFT[]>;
  poolHistory: Map<string, HistoryItem[]>;
  lastRealtimeUpdate: Map<string, number>;

  // State flags
  isLoading: boolean;
  lastUpdate: number;
  connectionState: string;
  newCollectionsCount: number;
  newPoolsCount: number;
  error: string | null;

  // Existing actions
  addCollections: (collections: Collection[]) => void;
  addPools: (pools: Pool[]) => void;
  updatePoolMetrics: (
    metrics: Array<{ poolAddress: string; metrics: PoolMetrics }>
  ) => void;
  clearNewIndicators: () => void;
  setConnectionState: (state: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // New pool-specific actions
  setPoolDetails: (poolAddress: string, details: PoolDetails) => void;
  updatePoolInfo: (poolAddress: string, info: PoolInfo) => void;
  addNFTToPool: (poolAddress: string, nft: NFT) => void;
  addTransactionToPool: (poolAddress: string, transaction: HistoryItem) => void;
  setPoolNFTs: (poolAddress: string, nfts: NFT[]) => void;
  setPoolHistory: (poolAddress: string, history: HistoryItem[]) => void;
  setPoolLoading: (poolAddress: string, isLoading: boolean) => void;
  setPoolError: (poolAddress: string, error: string | null) => void;

  // Getters
  getTrendingCollections: (limit?: number) => TrendingCollection[];
  getPoolDetailsWithRealtime: (
    poolAddress: string
  ) => PoolDetailsWithRealtime | null;
  getPoolByAddress: (address: string) => Pool | undefined;
  getCollectionByMint: (mint: string) => Collection | undefined;
}

// Enhanced trending score calculation
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

  console.log(`Trending Score Debug for pool:`, {
    volume24h,
    transactions24h,
    uniqueTraders24h,
    priceChange24h,
    volumeScore,
    transactionScore,
    traderScore,
    priceScore,
    ageScore,
    ageDecay,
    finalScore:
      (volumeScore + transactionScore + traderScore + priceScore + ageScore) *
      ageDecay,
  });

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

    // Enhanced pool-specific state
    poolDetails: new Map(),
    poolNFTs: new Map(),
    poolHistory: new Map(),
    lastRealtimeUpdate: new Map(),

    // State flags
    isLoading: true,
    lastUpdate: 0,
    connectionState: "disconnected",
    newCollectionsCount: 0,
    newPoolsCount: 0,
    error: null,

    // Existing actions
    addCollections: (newCollections) =>
      set((state) => {
        const existingMints = new Set(
          state.collections.map((c) => c.collectionMint)
        );
        const filteredNew = newCollections.filter(
          (c) => !existingMints.has(c.collectionMint)
        );

        if (filteredNew.length === 0) return state;

        console.log(
          `Adding ${filteredNew.length} new collections:`,
          filteredNew
        );

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

        console.log(`Adding ${filteredNew.length} new pools:`, filteredNew);

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
        const newRealtimeUpdate = new Map(state.lastRealtimeUpdate);

        updates.forEach(({ poolAddress, metrics }) => {
          newMetrics.set(poolAddress, metrics);
          newRealtimeUpdate.set(poolAddress, Date.now());
          console.log(`Updated metrics for pool ${poolAddress}:`, metrics);
        });

        // Recalculate trending collections when metrics update
        const trendingCollections = get().getTrendingCollections();

        return {
          poolMetrics: newMetrics,
          lastRealtimeUpdate: newRealtimeUpdate,
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

    setConnectionState: (connectionState) => {
      console.log(`Connection state changed to: ${connectionState}`);
      set({ connectionState });
    },

    setLoading: (isLoading) => set({ isLoading }),

    setError: (error) => {
      console.log(`Store error set:`, error);
      set({ error });
    },

    // Enhanced pool-specific actions
    setPoolDetails: (poolAddress, details) =>
      set((state) => {
        const newPoolDetails = new Map(state.poolDetails);
        newPoolDetails.set(poolAddress, details);

        console.log(`Set pool details for ${poolAddress}:`, details);

        return {
          poolDetails: newPoolDetails,
          lastUpdate: Date.now(),
        };
      }),

    updatePoolInfo: (poolAddress, info) =>
      set((state) => {
        const newPoolDetails = new Map(state.poolDetails);
        const existing = newPoolDetails.get(poolAddress);

        if (existing) {
          newPoolDetails.set(poolAddress, {
            ...existing,
            info,
            lastUpdated: Date.now(),
          });
        } else {
          newPoolDetails.set(poolAddress, {
            info,
            nfts: [],
            history: [],
            lastUpdated: Date.now(),
            isLoading: false,
          });
        }

        console.log(`Updated pool info for ${poolAddress}:`, info);

        return {
          poolDetails: newPoolDetails,
          lastUpdate: Date.now(),
        };
      }),

    addNFTToPool: (poolAddress, nft) =>
      set((state) => {
        const newPoolNFTs = new Map(state.poolNFTs);
        const existingNFTs = newPoolNFTs.get(poolAddress) || [];

        // Check if NFT already exists
        const nftExists = existingNFTs.some(
          (existing) => existing.mintAddress === nft.mintAddress
        );

        if (!nftExists) {
          const updatedNFTs = [nft, ...existingNFTs];
          newPoolNFTs.set(poolAddress, updatedNFTs);

          // Also update pool details if they exist
          const newPoolDetails = new Map(state.poolDetails);
          const existing = newPoolDetails.get(poolAddress);
          if (existing) {
            newPoolDetails.set(poolAddress, {
              ...existing,
              nfts: updatedNFTs,
              lastUpdated: Date.now(),
            });
          }

          console.log(`Added NFT to pool ${poolAddress}:`, nft);

          return {
            poolNFTs: newPoolNFTs,
            poolDetails: newPoolDetails,
            lastUpdate: Date.now(),
          };
        }

        return state;
      }),

    addTransactionToPool: (poolAddress, transaction) =>
      set((state) => {
        const newPoolHistory = new Map(state.poolHistory);
        const existingHistory = newPoolHistory.get(poolAddress) || [];

        // Check if transaction already exists
        const txExists = existingHistory.some(
          (existing) => existing.signature === transaction.signature
        );

        if (!txExists) {
          const updatedHistory = [transaction, ...existingHistory];
          newPoolHistory.set(poolAddress, updatedHistory);

          // Also update pool details if they exist
          const newPoolDetails = new Map(state.poolDetails);
          const existing = newPoolDetails.get(poolAddress);
          if (existing) {
            newPoolDetails.set(poolAddress, {
              ...existing,
              history: updatedHistory,
              lastUpdated: Date.now(),
            });
          }

          console.log(`Added transaction to pool ${poolAddress}:`, transaction);

          return {
            poolHistory: newPoolHistory,
            poolDetails: newPoolDetails,
            lastUpdate: Date.now(),
          };
        }

        return state;
      }),

    setPoolNFTs: (poolAddress, nfts) =>
      set((state) => {
        const newPoolNFTs = new Map(state.poolNFTs);
        newPoolNFTs.set(poolAddress, nfts);

        // Also update pool details if they exist
        const newPoolDetails = new Map(state.poolDetails);
        const existing = newPoolDetails.get(poolAddress);
        if (existing) {
          newPoolDetails.set(poolAddress, {
            ...existing,
            nfts,
            lastUpdated: Date.now(),
          });
        }

        console.log(`Set ${nfts.length} NFTs for pool ${poolAddress}`);

        return {
          poolNFTs: newPoolNFTs,
          poolDetails: newPoolDetails,
          lastUpdate: Date.now(),
        };
      }),

    setPoolHistory: (poolAddress, history) =>
      set((state) => {
        const newPoolHistory = new Map(state.poolHistory);
        newPoolHistory.set(poolAddress, history);

        // Also update pool details if they exist
        const newPoolDetails = new Map(state.poolDetails);
        const existing = newPoolDetails.get(poolAddress);
        if (existing) {
          newPoolDetails.set(poolAddress, {
            ...existing,
            history,
            lastUpdated: Date.now(),
          });
        }

        console.log(
          `Set ${history.length} history items for pool ${poolAddress}`
        );

        return {
          poolHistory: newPoolHistory,
          poolDetails: newPoolDetails,
          lastUpdate: Date.now(),
        };
      }),

    setPoolLoading: (poolAddress, isLoading) =>
      set((state) => {
        const newPoolDetails = new Map(state.poolDetails);
        const existing = newPoolDetails.get(poolAddress);

        if (existing) {
          newPoolDetails.set(poolAddress, {
            ...existing,
            isLoading,
          });
        } else if (isLoading) {
          // Create new entry when starting to load
          newPoolDetails.set(poolAddress, {
            info: null,
            nfts: [],
            history: [],
            lastUpdated: Date.now(),
            isLoading: true,
          });
        }

        console.log(`Set loading state for pool ${poolAddress}: ${isLoading}`);

        return {
          poolDetails: newPoolDetails,
        };
      }),

    setPoolError: (poolAddress, error) =>
      set((state) => {
        const newPoolDetails = new Map(state.poolDetails);
        const existing = newPoolDetails.get(poolAddress);

        if (existing) {
          newPoolDetails.set(poolAddress, {
            ...existing,
            error: error || undefined,
            isLoading: false,
          });
        }

        console.log(`Set error for pool ${poolAddress}:`, error);

        return {
          poolDetails: newPoolDetails,
        };
      }),

    // Enhanced getters
    getTrendingCollections: (limit = 20) => {
      const { pools, collections, poolMetrics } = get();

      console.log(
        `Calculating trending collections. Pools: ${pools.length}, Collections: ${collections.length}, Metrics: ${poolMetrics.size}`
      );

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

        return {
          pool,
          collection,
          metrics,
          trendingScore,
          rank: 0, // Will be set after sorting
        };
      });

      // Sort by trending score and assign ranks
      const result = trendingData
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, limit)
        .map((item, index) => ({ ...item, rank: index + 1 }));

      console.log(
        `Trending collections calculated. Top 3:`,
        result.slice(0, 3)
      );

      return result;
    },

    getPoolDetailsWithRealtime: (poolAddress) => {
      const state = get();
      const poolDetails = state.poolDetails.get(poolAddress);
      const metrics = state.poolMetrics.get(poolAddress);
      const lastRealtimeUpdate = state.lastRealtimeUpdate.get(poolAddress);

      if (!poolDetails) {
        console.log(`No pool details found for ${poolAddress}`);
        return null;
      }

      const result: PoolDetailsWithRealtime = {
        ...poolDetails,
        metrics: metrics || null,
        hasRealtimeData: !!metrics,
        connectionState: state.connectionState,
        lastUpdate: lastRealtimeUpdate || poolDetails.lastUpdated,
      };

      console.log(`Retrieved pool details with realtime for ${poolAddress}:`, {
        hasInfo: !!result.info,
        nftCount: result.nfts.length,
        historyCount: result.history.length,
        hasMetrics: !!result.metrics,
        hasRealtimeData: result.hasRealtimeData,
      });

      return result;
    },

    getPoolByAddress: (address) => {
      const { pools } = get();
      return pools.find((p) => p.poolAddress === address);
    },

    getCollectionByMint: (mint) => {
      const { collections } = get();
      return collections.find((c) => c.collectionMint === mint);
    },
  }))
);

// Utility function to check if pool details are stale
export const isPoolDetailsStale = (
  lastUpdated: number,
  maxAge = 60000
): boolean => {
  return Date.now() - lastUpdated > maxAge;
};
