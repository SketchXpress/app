// src/hook/pools/useBondingCurveForPool.ts
import { useMemo } from "react";
import { useTransactionHistory } from "@/hook/api/helius/useTransactionHistory";

/**
 * Hook to get bonding curve history filtered by pool address
 * Uses real-time transaction data instead of polling Helius API
 * @param poolAddress - The pool address to filter transactions for
 * @returns Filtered transaction history for the specific pool
 */
export function useBondingCurveForPool(poolAddress: string | undefined) {
  // Use the existing transaction history hook that handles real-time data
  const {
    history,
    isLoading,
    error,
    loadMore,
    canLoadMore,
    clearCache,
    stats,
    refetch,
  } = useTransactionHistory({
    limit: 100,
    staleTime: 60 * 1000, // 1 minute - reduce API calls
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Filter history for the specific pool
  const filteredHistory = useMemo(() => {
    if (!poolAddress || !history) return [];

    return history.filter((item) => {
      // Check if this transaction is related to the specific pool
      return item.poolAddress === poolAddress;
    });
  }, [history, poolAddress]);

  // Calculate pool-specific stats
  const poolStats = useMemo(() => {
    if (!filteredHistory.length) return null;

    const mintTransactions = filteredHistory.filter(
      (tx) => tx.instructionName === "mintNft"
    );
    const sellTransactions = filteredHistory.filter(
      (tx) => tx.instructionName === "sellNft"
    );

    return {
      totalTransactions: filteredHistory.length,
      mintCount: mintTransactions.length,
      sellCount: sellTransactions.length,
      totalVolume: filteredHistory.reduce(
        (sum, tx) => sum + (tx.price || 0),
        0
      ),
      latestTransaction: filteredHistory[0], // Most recent first
    };
  }, [filteredHistory]);

  return {
    history: filteredHistory,
    isLoading,
    error,
    loadMore,
    canLoadMore,
    clearCache,
    refetch,
    stats: poolStats,
    globalStats: stats, // Include global stats as well
  };
}
