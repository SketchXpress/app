// src/hook/pools/useBondingCurveForPool.ts - OPTIMIZED VERSION
import { useMemo } from "react";
import { useCollectionsStore } from "@/stores/collectionsStore";
import { useTransactionHistory } from "@/hook/api/helius/useTransactionHistory";

/**
 * Hook to get bonding curve history filtered by pool address
 * OPTIMIZED: Uses store data first, falls back to API only when needed
 * @param poolAddress - The pool address to filter transactions for
 * @returns Filtered transaction history for the specific pool
 */
export function useBondingCurveForPool(poolAddress: string | undefined) {
  // Get store data - this includes real-time webhook data
  const { getPoolDetailsWithRealtime } = useCollectionsStore();
  const storeData = poolAddress
    ? getPoolDetailsWithRealtime(poolAddress)
    : null;

  // Only fetch from API if we don't have store data
  const shouldFetchFromAPI =
    !storeData?.history || storeData.history.length === 0;

  // Conditional API fetch - only when store doesn't have data
  const {
    history: apiHistory,
    isLoading: apiLoading,
    error: apiError,
    loadMore,
    canLoadMore,
    clearCache,
    stats,
    refetch,
  } = useTransactionHistory({
    limit: 100,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Filter API history for the specific pool (only if needed)
  const filteredApiHistory = useMemo(() => {
    if (!shouldFetchFromAPI || !poolAddress || !apiHistory) return [];
    return apiHistory.filter((item) => item.poolAddress === poolAddress);
  }, [apiHistory, poolAddress, shouldFetchFromAPI]);

  // Use store data first, fallback to API data
  const finalHistory = useMemo(() => {
    if (storeData?.history && storeData.history.length > 0) {
      // Return store data (from webhooks/SSE)
      return storeData.history.sort(
        (a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0)
      );
    }
    // Fallback to filtered API data
    return filteredApiHistory;
  }, [storeData?.history, filteredApiHistory]);

  // Calculate pool-specific stats
  const poolStats = useMemo(() => {
    if (!finalHistory.length) return null;

    const mintTransactions = finalHistory.filter(
      (tx) => tx.instructionName === "mintNft"
    );
    const sellTransactions = finalHistory.filter(
      (tx) => tx.instructionName === "sellNft"
    );

    return {
      totalTransactions: finalHistory.length,
      mintCount: mintTransactions.length,
      sellCount: sellTransactions.length,
      totalVolume: finalHistory.reduce((sum, tx) => sum + (tx.price || 0), 0),
      latestTransaction: finalHistory[0], // Most recent first
      dataSource: storeData?.history ? "webhook" : "api",
    };
  }, [finalHistory, storeData?.history]);

  // Only show loading for API calls when store data is empty
  const isLoading = shouldFetchFromAPI ? apiLoading : false;
  const error = shouldFetchFromAPI ? apiError : null;

  return {
    history: finalHistory,
    isLoading,
    error: error?.message || null,
    loadMore: shouldFetchFromAPI ? loadMore : undefined,
    canLoadMore: shouldFetchFromAPI ? canLoadMore : false,
    clearCache: shouldFetchFromAPI ? clearCache : undefined,
    refetch: shouldFetchFromAPI ? refetch : undefined,
    stats: poolStats,
    globalStats: shouldFetchFromAPI ? stats : undefined,
    dataSource: poolStats?.dataSource || "store",
  };
}
