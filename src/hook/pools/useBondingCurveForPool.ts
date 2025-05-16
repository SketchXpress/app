import { useMemo } from "react";
import { useCollectionsStore } from "@/stores/collectionsStore";
import { useTransactionHistory } from "@/hook/api/helius/useTransactionHistory";

export function useBondingCurveForPool(poolAddress: string | undefined) {
  const { getPoolDetailsWithRealtime } = useCollectionsStore();
  const storeData = poolAddress
    ? getPoolDetailsWithRealtime(poolAddress)
    : null;

  const shouldFetchFromAPI =
    !storeData?.history || storeData.history.length === 0;

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
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const filteredApiHistory = useMemo(() => {
    if (!shouldFetchFromAPI || !poolAddress || !apiHistory) return [];
    return apiHistory.filter((item) => item.poolAddress === poolAddress);
  }, [apiHistory, poolAddress, shouldFetchFromAPI]);

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
      latestTransaction: finalHistory[0],
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
