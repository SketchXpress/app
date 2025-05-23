/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { useRealTimeCollections } from "@/hook/api/realtime/useRealTimeCollections";
import { usePoolInfo } from "@/hook/api/anchor/usePoolInfo";
import { useCollectionsStore } from "@/stores/collectionsStore";
import {
  NFT,
  PoolInfo as CollectionPoolInfo,
  CollectionPageData,
} from "@/app/mintstreet/collection/[poolAddress]/types";

export function useOptimizedCollectionData(
  poolAddress: string
): CollectionPageData {
  const {
    pools,
    collections,
    isLoading: storeLoading,
    error: storeError,
    stats,
  } = useRealTimeCollections({
    enableSSE: true,
    fallbackPolling: true,
    newItemExpiry: 5 * 60 * 1000,
  });

  // Get pool metrics and details from store
  const { poolMetrics, getPoolDetailsWithRealtime } = useCollectionsStore();
  const metrics = poolMetrics.get(poolAddress);
  const poolDetails = getPoolDetailsWithRealtime(poolAddress);

  // Find the pool and collection in store
  const storePool = pools.find((pool) => pool.poolAddress === poolAddress);
  const storeCollection = storePool
    ? collections.find((c) => c.collectionMint === storePool.collectionMint)
    : null;

  const {
    data: apiPoolInfo,
    isLoading: poolInfoLoading,
    error: poolInfoError,
  } = usePoolInfo(poolAddress) as {
    data: any;
    isLoading: boolean;
    error: Error | null;
  };

  // Create pool info combining store data with API migration data
  const poolInfo = useMemo((): CollectionPoolInfo | null => {
    if (!storePool) return null;

    // Calculate derived metrics from store data
    const mintTransactions =
      poolDetails?.history?.filter((tx) => tx.instructionName === "mintNft")
        .length || 0;
    const sellTransactions =
      poolDetails?.history?.filter((tx) => tx.instructionName === "sellNft")
        .length || 0;
    const estimatedSupply = Math.max(0, mintTransactions - sellTransactions);

    const storeBasedPoolInfo: CollectionPoolInfo = {
      // Name from store
      collectionName:
        storeCollection?.collectionName ||
        storePool.collectionName ||
        `Collection ${storePool.collectionMint.slice(0, 6)}...`,

      // Static configuration data from store
      basePrice: storePool.basePrice
        ? parseFloat(storePool.basePrice) / 1e9
        : 0,
      growthFactor: storePool.growthFactor
        ? parseFloat(storePool.growthFactor) / 1e6
        : 0,
      collection: storePool.collectionMint,

      // Use API data for totalEscrowed (needed for migration progress)
      totalEscrowed: apiPoolInfo?.totalEscrowed || 0,

      // Use store-derived metrics for other fields
      currentSupply: estimatedSupply,
      protocolFeePercent: apiPoolInfo?.protocolFeePercent || 2,
      isActive:
        apiPoolInfo?.isActive !== undefined ? apiPoolInfo.isActive : true,
      migrationStatus: apiPoolInfo?.migrationStatus || "Active",
      creator: apiPoolInfo?.creator || "",

      // Add real-time metrics if available
      ...(metrics && {
        volume24h: metrics.volume24h,
        transactions24h: metrics.transactions24h,
        uniqueTraders24h: metrics.uniqueTraders24h,
        priceChange24h: metrics.priceChange24h,
        lastPrice: metrics.lastPrice,
      }),
    };

    return storeBasedPoolInfo;
  }, [storePool, storeCollection, poolDetails, metrics, apiPoolInfo]);

  // For now, return empty arrays for NFTs and history
  const nfts: NFT[] = [];
  const history: any[] = [];

  // Calculate last mint price
  const lastMintPrice = useMemo(() => {
    if (metrics?.lastPrice && metrics.lastPrice > 0) {
      return `${metrics.lastPrice.toFixed(4)} SOL`;
    }

    if (poolDetails?.history && poolDetails.history.length > 0) {
      const recentMints = poolDetails.history
        .filter((tx) => tx.instructionName === "mintNft" && tx.price)
        .sort((a, b) => (b.blockTime || 0) - (a.blockTime || 0));

      if (recentMints.length > 0 && recentMints[0].price) {
        return `${recentMints[0].price.toFixed(4)} SOL`;
      }
    }

    if (storePool?.basePrice) {
      const basePriceSOL = parseFloat(storePool.basePrice) / 1e9;
      return `${basePriceSOL.toFixed(4)} SOL`;
    }

    return "0.0001 SOL";
  }, [metrics, poolDetails, storePool]);

  // Calculate migration progress using API totalEscrowed
  const migrationProgress = useMemo(() => {
    if (!poolInfo || poolInfo.totalEscrowed === undefined) {
      return 0;
    }

    const threshold = 690; // 690 SOL migration threshold
    const progress = (poolInfo.totalEscrowed / threshold) * 100;
    const cappedProgress = Math.min(progress, 100); // Cap at 100%

    return cappedProgress;
  }, [poolInfo]);

  // Loading state
  const isLoading = storeLoading || poolInfoLoading;

  // Error handling
  const error = storeError || poolInfoError?.message || null;

  // Data source information
  const dataSource = useMemo(
    (): CollectionPageData["dataSource"] => ({
      poolInfo: "store" as const,
      nfts: "store" as const,
      history: "store" as const,
      metrics: metrics ? ("realtime" as const) : ("none" as const),
      connectionState: stats.connectionStatus,
      lastUpdate: stats.lastUpdate,
    }),
    [metrics, stats]
  );

  return {
    poolInfo,
    nfts,
    history,
    isLoading,
    error,
    lastMintPrice,
    migrationProgress,
    dataSource,
    hasRealtimeData: !!metrics,
  };
}
