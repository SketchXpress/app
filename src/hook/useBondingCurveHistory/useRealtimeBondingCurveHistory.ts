/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect, useCallback } from "react";
import { useBondingCurveForPool } from "@/hook/pools/useBondingCurveForPool";
import {
  useSSEConnection,
  SSEEvent,
} from "@/hook/api/realtime/useSSEConnection";

import { BondingCurveHistoryResult, PerformanceStats } from "./types";

export interface UseRealtimeBondingCurveHistoryOptions {
  enableSSE?: boolean;
  fallbackToPolling?: boolean;
  updateInterval?: number;
}

export function useRealtimeBondingCurveHistory(
  poolAddress: string,
  options: UseRealtimeBondingCurveHistoryOptions = {}
): BondingCurveHistoryResult {
  const {
    enableSSE = true,
    fallbackToPolling = true,
    updateInterval = 10000,
  } = options;

  const [connectionState, setConnectionState] = useState("disconnected");
  const [lastRealTimeUpdate, setLastRealTimeUpdate] = useState(Date.now());
  const [usingRealTimeData, setUsingRealTimeData] = useState(enableSSE);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);

  // Get base history from the regular hook
  const {
    history,
    isLoading,
    error,
    refetch,
    clearCache,
    stats: baseStats,
    globalStats,
    loadMore,
    canLoadMore,
  } = useBondingCurveForPool(poolAddress);

  // Set up SSE connection
  const {
    connectionState: sseConnectionState,
    subscribe,
    isConnected,
    error: sseError,
  } = useSSEConnection({
    endpoint: `/api/collections/sse/transactions/${poolAddress}`,
    autoReconnect: true,
    reconnectDelay: 5000,
    maxReconnectAttempts: 3,
  });

  // Update connection state
  useEffect(() => {
    setConnectionState(sseConnectionState);
    setUsingRealTimeData(isConnected && enableSSE);
  }, [sseConnectionState, isConnected, enableSSE]);

  // Handle real-time updates with proper typing
  useEffect(() => {
    if (!enableSSE || !subscribe) return;

    const handleNewTransaction = (event: SSEEvent) => {
      setLastRealTimeUpdate(Date.now());
      // Trigger a refetch to get updated data
      if (refetch) {
        refetch();
      }
    };

    const unsubscribe = subscribe("newTransaction", handleNewTransaction);

    return () => {
      unsubscribe();
    };
  }, [enableSSE, subscribe, refetch]);

  // Fallback polling if SSE is not working
  useEffect(() => {
    if (fallbackToPolling && !isConnected && !isLoading) {
      const interval = setInterval(() => {
        if (refetch) {
          refetch();
        }
      }, updateInterval);

      return () => clearInterval(interval);
    }
  }, [fallbackToPolling, isConnected, isLoading, refetch, updateInterval]);

  // Create enhanced statistics that match the PerformanceStats interface
  const enhancedStats: PerformanceStats = {
    totalApiCalls: 0, // Default values since we don't have access to these stats
    totalRpcCalls: 0,
    avgResponseTime: 0,
    successfulPriceExtractions: history.filter(
      (item) => item.price !== undefined
    ).length,
    failedPriceExtractions: history.filter((item) => item.price === undefined)
      .length,
    cacheHits: 0,
    lastFetchTime: 0,
  };

  const reconnect = useCallback(() => {
    // Force a reconnection
    setConnectionState("connecting");
    setLastRealTimeUpdate(Date.now());
    if (refetch) {
      refetch();
    }
  }, [refetch]);

  // Handle error conversion from Error to string
  const formattedError = error
    ? typeof error === "string"
      ? error
      : error
    : sseError
    ? typeof sseError === "string"
      ? sseError
      : String(sseError)
    : null;

  return {
    history,
    isLoading,
    isLoadingPrices,
    error: formattedError,
    refetch,
    clearCache,
    stats: enhancedStats,
    globalStats,
    loadMore,
    canLoadMore,
    reconnect,
    connectionState,
    usingRealTimeData,
  } as BondingCurveHistoryResult & {
    reconnect: () => void;
    connectionState: string;
    usingRealTimeData: boolean;
  };
}
