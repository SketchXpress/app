import { useMemo } from "react";

import { useCollectionsStore } from "@/stores/collectionsStore";
import { usePoolInfo } from "@/hook/api/anchor/usePoolInfo";

export interface EnhancedPoolInfo {
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

  // Real-time metrics from store
  volume24h?: number;
  transactions24h?: number;
  uniqueTraders24h?: number;
  priceChange24h?: number;
  lastPrice?: number;

  // Integration metadata
  hasRealtimeData: boolean;
  connectionState: string;
  lastUpdate: number;
  dataSource: "api" | "realtime" | "hybrid";
}

export interface RealtimePoolDataResult {
  poolInfo: EnhancedPoolInfo | null;
  isLoading: boolean;
  error: string | null;
  connectionState: string;
  hasRealtimeData: boolean;
  lastUpdate: number;
}

/**
 * Custom hook that combines API pool data with real-time store data
 * Provides enhanced pool information with live metrics
 *
 * @param poolAddress - The pool address to fetch data for
 * @returns Enhanced pool data with real-time metrics
 */
export function useRealtimePoolData(
  poolAddress: string | null
): RealtimePoolDataResult {
  // Get API data
  const {
    data: apiPoolInfo,
    isLoading: apiLoading,
    error: apiError,
  } = usePoolInfo(poolAddress);

  // Get real-time store data
  const { pools, poolMetrics, connectionState, lastUpdate } =
    useCollectionsStore();

  // Find pool and metrics in store
  const realtimeData = useMemo(() => {
    if (!poolAddress) return null;

    // Find pool in store
    const storePool = pools.find((pool) => pool.poolAddress === poolAddress);

    // Get metrics for this pool
    const metrics = poolMetrics.get(poolAddress);

    return {
      pool: storePool,
      metrics,
    };
  }, [pools, poolMetrics, poolAddress]);

  // Combine API data with real-time data
  const enhancedPoolInfo = useMemo((): EnhancedPoolInfo | null => {
    if (!apiPoolInfo) return null;

    const { pool: storePool, metrics } = realtimeData || {};
    const hasRealtimeData = !!(storePool && metrics);

    // Determine data source
    let dataSource: "api" | "realtime" | "hybrid" = "api";
    if (hasRealtimeData) {
      dataSource = "hybrid";
    }

    // Enhanced pool info combining both sources
    const enhanced: EnhancedPoolInfo = {
      // Base API data
      ...apiPoolInfo,

      // Real-time metrics (if available)
      ...(metrics && {
        volume24h: metrics.volume24h,
        transactions24h: metrics.transactions24h,
        uniqueTraders24h: metrics.uniqueTraders24h,
        priceChange24h: metrics.priceChange24h,
        lastPrice: metrics.lastPrice,
      }),

      // Collection name from store if available
      ...(storePool?.collectionName && {
        collectionName: storePool.collectionName,
      }),

      // Integration metadata
      hasRealtimeData,
      connectionState,
      lastUpdate,
      dataSource,
      collection: "",
      creator: "",
      basePrice: 0,
      growthFactor: 0,
      currentSupply: 0,
      protocolFeePercent: 0,
      totalEscrowed: 0,
      isActive: false,
      migrationStatus: "",
      migrationProgress: "",
    };

    return enhanced;
  }, [apiPoolInfo, realtimeData, connectionState, lastUpdate]);

  // Calculate migration progress with real-time data
  const enhancedPoolInfoWithProgress = useMemo(() => {
    if (!enhancedPoolInfo) return null;

    // Use real-time total escrowed if available and more recent
    const totalEscrowed = enhancedPoolInfo.totalEscrowed;

    if (enhancedPoolInfo.hasRealtimeData && enhancedPoolInfo.volume24h) {
      // Keep the API value for now, but we could enhance this with real-time escrow data
      // if your SSE system provides it
    }

    const migrationThreshold = 690; // 690 SOL
    const progressPercentage = Math.min(
      (totalEscrowed / migrationThreshold) * 100,
      100
    );

    return {
      ...enhancedPoolInfo,
      migrationProgress:
        totalEscrowed >= migrationThreshold
          ? "Threshold reached! (690 SOL)"
          : `Progress: ${totalEscrowed.toFixed(
              4
            )} / ${migrationThreshold} SOL (${progressPercentage.toFixed(1)}%)`,
    };
  }, [enhancedPoolInfo]);

  return {
    poolInfo: enhancedPoolInfoWithProgress,
    isLoading: apiLoading,
    error: apiError?.message || null,
    connectionState,
    hasRealtimeData: !!realtimeData?.metrics,
    lastUpdate,
  };
}
