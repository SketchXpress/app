"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useSSEConnection } from "./useSSEConnection";
import { useCollectionsStore, PoolMetrics } from "@/stores/collectionsStore";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTransactionHistory } from "../helius/useTransactionHistory";

// Type declarations for browser APIs
declare global {
  interface Window {
    scheduler?: {
      postTask: (callback: () => void, options?: { priority: string }) => void;
    };
  }
}

// ===== PERFORMANCE OPTIMIZATIONS =====

// 1. Moved interfaces to module level to prevent recreation
export interface Collection {
  collectionMint: string;
  collectionName: string;
  symbol?: string;
  uri?: string;
  signature: string;
  timestamp: number;
  isNew?: boolean;
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

export interface UseRealTimeCollectionsOptions {
  enableSSE?: boolean;
  fallbackPolling?: boolean;
  newItemExpiry?: number;
  enableMetricsCalculation?: boolean;
  metricsTimeWindow?: number;
  // New optimization options
  batchSize?: number;
  debounceDelay?: number;
  maxConcurrentRequests?: number;
  enableMemoryOptimization?: boolean;
}

interface ProcessingStats {
  collections: number;
  pools: number;
  mints: number;
  sells: number;
  other: number;
  metricsCalculated: number;
  processingTime: number;
}

// 2. Memoized constants to prevent recreation
const DEFAULT_PROCESSING_STATS: ProcessingStats = {
  collections: 0,
  pools: 0,
  mints: 0,
  sells: 0,
  other: 0,
  metricsCalculated: 0,
  processingTime: 0,
};

const DEFAULT_OPTIONS: Required<UseRealTimeCollectionsOptions> = {
  enableSSE: true,
  fallbackPolling: true,
  newItemExpiry: 5 * 60 * 1000,
  enableMetricsCalculation: true,
  metricsTimeWindow: 24 * 60 * 60 * 1000,
  batchSize: 50,
  debounceDelay: 100,
  maxConcurrentRequests: 3,
  enableMemoryOptimization: true,
};

// 3. Debounce utility for batching updates
function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>(undefined);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay]
  );
}

// 4. Request queue for network optimization
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private running = 0;
  private maxConcurrent: number;

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const request = this.queue.shift()!;

    try {
      await request();
    } finally {
      this.running--;
      this.process();
    }
  }
}

export function useRealTimeCollections(
  options: UseRealTimeCollectionsOptions = {}
) {
  // 5. Merge options with defaults using useMemo
  const config = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [options]);

  const {
    enableMetricsCalculation,
    metricsTimeWindow,
    batchSize,
    debounceDelay,
    maxConcurrentRequests,
    enableMemoryOptimization,
  } = config;

  // 6. Selective store subscriptions to prevent unnecessary re-renders
  const collections = useCollectionsStore((state) => state.collections);
  const pools = useCollectionsStore((state) => state.pools);
  const poolMetrics = useCollectionsStore((state) => state.poolMetrics);
  const newCollectionsCount = useCollectionsStore(
    (state) => state.newCollectionsCount
  );
  const newPoolsCount = useCollectionsStore((state) => state.newPoolsCount);
  const lastUpdate = useCollectionsStore((state) => state.lastUpdate);
  const connectionState = useCollectionsStore((state) => state.connectionState);

  // 7. Batch store actions to reduce re-renders
  const storeActions = useMemo(
    () => ({
      addCollections: useCollectionsStore.getState().addCollections,
      addPools: useCollectionsStore.getState().addPools,
      updatePoolMetrics: useCollectionsStore.getState().updatePoolMetrics,
      clearNewIndicators: useCollectionsStore.getState().clearNewIndicators,
      setConnectionState: useCollectionsStore.getState().setConnectionState,
      setLoading: useCollectionsStore.getState().setLoading,
      setError: useCollectionsStore.getState().setError,
      addTransactionToPool: useCollectionsStore.getState().addTransactionToPool,
      addNFTToPool: useCollectionsStore.getState().addNFTToPool,
    }),
    []
  );

  // 8. Optimized local state
  const [localError, setLocalError] = useState<string | null>(null);
  const [processingStats, setProcessingStats] = useState<ProcessingStats>(
    DEFAULT_PROCESSING_STATS
  );

  // 9. Performance tracking refs
  const performanceRef = useRef({
    isInitialized: false,
    previousHistoryLength: 0,
    metricsCalculationTime: 0,
    requestQueue: new RequestQueue(maxConcurrentRequests),
    abortController: new AbortController(),
  });

  // 10. Optimized SSE connection with memoized config
  const sseConfig = useMemo(
    () => ({
      endpoint: "/api/collections/sse",
      autoReconnect: true,
      reconnectDelay: 5000,
      maxReconnectAttempts: 3,
    }),
    []
  );

  const {
    connectionState: sseConnectionState,
    isConnected,
    error: sseError,
  } = useSSEConnection(sseConfig);

  // 11. Optimized transaction history with memoized config
  const historyConfig = useMemo(
    () => ({
      limit: batchSize * 2,
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      autoFetchAll: true,
      emptyBatchesToConfirm: 2,
    }),
    [batchSize]
  );

  const {
    history,
    isLoading: historyLoading,
    error: historyError,
    refetch,
    stats,
  } = useTransactionHistory(historyConfig);

  // 12. Debounced connection state update
  const debouncedSetConnectionState = useDebounce(
    storeActions.setConnectionState,
    debounceDelay
  );

  useEffect(() => {
    debouncedSetConnectionState(sseConnectionState);
  }, [sseConnectionState, debouncedSetConnectionState]);

  // 13. Optimized error handling
  const consolidatedError = useMemo(() => {
    return sseError || historyError?.message || null;
  }, [sseError, historyError?.message]);

  useEffect(() => {
    storeActions.setLoading(historyLoading);
    storeActions.setError(consolidatedError);
    setLocalError(consolidatedError);
  }, [historyLoading, consolidatedError, storeActions]);

  // 14. High-performance metrics calculation with async processing
  const calculatePoolMetrics = useCallback(
    async (
      transactions: any[],
      timeWindow: number = metricsTimeWindow
    ): Promise<Map<string, PoolMetrics>> => {
      const startTime = performance.now();

      const metricsMap = new Map<string, PoolMetrics>();
      const now = Date.now();
      const cutoffTime = now - timeWindow;
      const uniqueTraders = new Map<string, Set<string>>();

      // Optimized filtering with early return
      const recentTransactions = transactions.filter((tx) => {
        if (!tx.blockTime || !tx.poolAddress) return false;
        const txTime = tx.blockTime * 1000;
        return txTime >= cutoffTime;
      });

      // Process transactions in chunks to prevent blocking
      const processChunk = (startIndex: number): Promise<void> => {
        return new Promise((resolve) => {
          const processSlice = () => {
            const endIndex = Math.min(
              startIndex + batchSize,
              recentTransactions.length
            );

            for (let i = startIndex; i < endIndex; i++) {
              const tx = recentTransactions[i];
              const poolAddress = tx.poolAddress;
              const isTradeTransaction =
                tx.instructionName === "mintNft" ||
                tx.instructionName === "sellNft";

              if (!isTradeTransaction) continue;

              // Initialize metrics efficiently
              if (!metricsMap.has(poolAddress)) {
                metricsMap.set(poolAddress, {
                  volume24h: 0,
                  transactions24h: 0,
                  uniqueTraders24h: 0,
                  priceChange24h: 0,
                  lastPrice: 0,
                });
                uniqueTraders.set(poolAddress, new Set());
              }

              const metrics = metricsMap.get(poolAddress)!;
              const tradersSet = uniqueTraders.get(poolAddress)!;

              metrics.transactions24h++;

              if (tx.price && typeof tx.price === "number" && tx.price > 0) {
                metrics.volume24h += tx.price;
                metrics.lastPrice = tx.price;
              }

              if (tx.accounts?.[0]) {
                tradersSet.add(tx.accounts[0].toString());
                metrics.uniqueTraders24h = tradersSet.size;
              }
            }

            if (endIndex < recentTransactions.length) {
              setTimeout(() => processChunk(endIndex).then(resolve), 0);
            } else {
              resolve();
            }
          };

          if (typeof requestIdleCallback !== "undefined") {
            requestIdleCallback(processSlice);
          } else {
            setTimeout(processSlice, 0);
          }
        });
      };

      // Process all chunks
      await processChunk(0);

      // Calculate price changes
      metricsMap.forEach((metrics, poolAddress) => {
        const poolTransactions = recentTransactions
          .filter((tx) => tx.poolAddress === poolAddress && tx.price > 0)
          .sort((a, b) => (a.blockTime || 0) - (b.blockTime || 0));

        if (poolTransactions.length >= 2) {
          const firstPrice = poolTransactions[0].price;
          const lastPrice = poolTransactions[poolTransactions.length - 1].price;
          if (firstPrice > 0) {
            metrics.priceChange24h =
              ((lastPrice - firstPrice) / firstPrice) * 100;
          }
        }
      });

      performanceRef.current.metricsCalculationTime =
        performance.now() - startTime;
      return metricsMap;
    },
    [metricsTimeWindow, batchSize]
  );

  // 15. Optimized transaction processing with batching
  const processTransactionHistory = useCallback(
    async (transactions: any[]): Promise<ProcessingStats> => {
      const startTime = performance.now();

      try {
        // Process in chunks to prevent blocking
        const chunkSize = Math.ceil(
          transactions.length / maxConcurrentRequests
        );
        const chunks = [];

        for (let i = 0; i < transactions.length; i += chunkSize) {
          chunks.push(transactions.slice(i, i + chunkSize));
        }

        // Process chunks concurrently
        const chunkResults = await Promise.all(
          chunks.map((chunk) =>
            performanceRef.current.requestQueue.add(async () => {
              const newCollections: Collection[] = [];
              const newPools: Pool[] = [];
              const collectionMap = new Map<
                string,
                { name: string; symbol?: string; uri?: string }
              >();

              let collectionTxs = 0,
                poolTxs = 0,
                mintTxs = 0,
                sellTxs = 0;

              // Process chunk
              chunk.forEach((tx) => {
                // Collections
                if (
                  tx.instructionName === "createCollectionNft" &&
                  tx.args?.name &&
                  tx.accounts?.length > 1
                ) {
                  collectionTxs++;
                  const collectionMint = tx.accounts[1].toString();

                  collectionMap.set(collectionMint, {
                    name: tx.args.name,
                    symbol: tx.args.symbol,
                    uri: tx.args.uri,
                  });

                  newCollections.push({
                    collectionMint,
                    collectionName: tx.args.name,
                    symbol: tx.args.symbol,
                    uri: tx.args.uri,
                    signature: tx.signature,
                    timestamp: tx.blockTime || Math.floor(Date.now() / 1000),
                  });
                }

                // Pools
                if (
                  tx.instructionName === "createPool" &&
                  tx.poolAddress &&
                  tx.accounts?.length > 1
                ) {
                  poolTxs++;
                  const collectionMint = tx.accounts[1].toString();
                  const collectionInfo = collectionMap.get(collectionMint);

                  newPools.push({
                    poolAddress: tx.poolAddress,
                    collectionMint,
                    collectionName:
                      collectionInfo?.name ||
                      `Collection ${collectionMint.slice(0, 6)}...`,
                    signature: tx.signature,
                    timestamp: tx.blockTime || Math.floor(Date.now() / 1000),
                    basePrice: tx.args?.basePrice?.toString(),
                    growthFactor: tx.args?.growthFactor?.toString(),
                  });
                }

                // Count trades
                if (tx.instructionName === "mintNft") mintTxs++;
                if (tx.instructionName === "sellNft") sellTxs++;
              });

              return {
                newCollections,
                newPools,
                collectionTxs,
                poolTxs,
                mintTxs,
                sellTxs,
              };
            })
          )
        );

        // Merge results
        const mergedCollections: Collection[] = [];
        const mergedPools: Pool[] = [];
        let totalCollectionTxs = 0,
          totalPoolTxs = 0,
          totalMintTxs = 0,
          totalSellTxs = 0;

        chunkResults.forEach((result) => {
          mergedCollections.push(...result.newCollections);
          mergedPools.push(...result.newPools);
          totalCollectionTxs += result.collectionTxs;
          totalPoolTxs += result.poolTxs;
          totalMintTxs += result.mintTxs;
          totalSellTxs += result.sellTxs;
        });

        // Batch store updates
        const updates: Array<() => void> = [];

        if (mergedCollections.length > 0) {
          updates.push(() => storeActions.addCollections(mergedCollections));
        }

        if (mergedPools.length > 0) {
          updates.push(() => storeActions.addPools(mergedPools));
        }

        // Execute updates in next tick to batch them
        requestAnimationFrame(() => {
          updates.forEach((update) => update());
        });

        // Calculate metrics
        let metricsCalculated = 0;
        if (
          enableMetricsCalculation &&
          (totalMintTxs > 0 || totalSellTxs > 0)
        ) {
          const metricsMap = await calculatePoolMetrics(transactions);

          if (metricsMap.size > 0) {
            const metricsUpdates = Array.from(metricsMap.entries()).map(
              ([poolAddress, metrics]) => ({ poolAddress, metrics })
            );

            requestAnimationFrame(() => {
              storeActions.updatePoolMetrics(metricsUpdates);
            });
            metricsCalculated = metricsMap.size;
          }
        }

        const processingTime = performance.now() - startTime;
        const stats: ProcessingStats = {
          collections: mergedCollections.length,
          pools: mergedPools.length,
          mints: totalMintTxs,
          sells: totalSellTxs,
          other:
            transactions.length -
            totalCollectionTxs -
            totalPoolTxs -
            totalMintTxs -
            totalSellTxs,
          metricsCalculated,
          processingTime,
        };

        setProcessingStats(stats);
        return stats;
      } catch (error) {
        console.error("Error processing transaction history:", error);
        setLocalError(
          error instanceof Error ? error.message : "Processing error"
        );
        return {
          ...DEFAULT_PROCESSING_STATS,
          processingTime: performance.now() - startTime,
        };
      }
    },
    [
      maxConcurrentRequests,
      storeActions,
      enableMetricsCalculation,
      calculatePoolMetrics,
    ]
  );

  // 16. Optimized history processing with intersection observer pattern
  useEffect(() => {
    if (!history || !stats?.completed) return;

    const { previousHistoryLength } = performanceRef.current;

    if (
      stats.completed &&
      history.length > 0 &&
      history.length !== previousHistoryLength
    ) {
      performanceRef.current.previousHistoryLength = history.length;

      // Use scheduler for better performance
      const processHistory = () => {
        console.log(
          "🔄 Processing complete transaction history:",
          history.length,
          "transactions"
        );
        processTransactionHistory(history).then((result) => {
          console.log("✅ Processing complete:", result);
        });
      };

      if (typeof window !== "undefined" && window.scheduler?.postTask) {
        window.scheduler.postTask(processHistory, {
          priority: "user-blocking",
        });
      } else if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(processHistory);
      } else {
        setTimeout(processHistory, 0);
      }
    }
  }, [history, stats?.completed, stats?.totalItems, processTransactionHistory]);

  // 17. Memory optimization with cleanup
  useEffect(() => {
    if (!enableMemoryOptimization) return;

    const cleanup = () => {
      // Clear old data periodically - this would need store actions to implement
      if (collections.length > 1000) {
        console.log(
          "Memory optimization: Collections exceed limit, cleanup needed"
        );
        // Future: implement store action to trim collections
      }

      if (pools.length > 1000) {
        console.log("Memory optimization: Pools exceed limit, cleanup needed");
        // Future: implement store action to trim pools
      }
    };

    const interval = setInterval(cleanup, 5 * 60 * 1000); // Every 5 minutes
    return () => clearInterval(interval);
  }, [
    collections.length,
    pools.length,
    enableMemoryOptimization,
    collections,
    pools,
  ]);

  // 18. Cleanup on unmount
  useEffect(() => {
    const abortController = performanceRef.current.abortController;
    return () => {
      abortController.abort();
    };
  }, []);

  // 19. Memoized return value to prevent unnecessary re-renders
  return useMemo(
    () => ({
      collections,
      pools,
      poolMetrics,
      newCollectionsCount,
      newPoolsCount,
      lastUpdate,
      connectionState,
      isConnected,
      isLoading: historyLoading,
      error: localError,
      refresh: async () => {
        try {
          console.log("🔄 Manual refresh triggered");
          storeActions.clearNewIndicators();
          await refetch();
          storeActions.setError(null);
          setLocalError(null);
          console.log("✅ Manual refresh completed");
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : "Refresh failed";
          console.error("❌ Manual refresh failed:", errorMsg);
          storeActions.setError(errorMsg);
          setLocalError(errorMsg);
        }
      },
      stats: {
        totalCollections: collections.length,
        totalPools: pools.length,
        totalPoolMetrics: poolMetrics.size,
        connectionStatus: connectionState,
        lastUpdate,
        transactionsProcessed: history?.length || 0,
        processingStats,
        metricsCalculationTime: performanceRef.current.metricsCalculationTime,
        hasMetrics: poolMetrics.size > 0,
        isSSEConnected: isConnected,
        lastProcessedHistoryLength:
          performanceRef.current.previousHistoryLength,
      },
    }),
    [
      collections,
      pools,
      poolMetrics,
      newCollectionsCount,
      newPoolsCount,
      lastUpdate,
      connectionState,
      isConnected,
      historyLoading,
      localError,
      history?.length,
      processingStats,
      storeActions,
      refetch,
    ]
  );
}
