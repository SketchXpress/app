/* eslint-disable @typescript-eslint/no-explicit-any */
// src/hook/api/realtime/useRealTimeCollections.ts - Fixed to properly update store
import { useState, useEffect, useCallback, useRef } from "react";
import { useSSEConnection, SSEEvent } from "./useSSEConnection";
import { useTransactionHistory } from "../helius/useTransactionHistory";
import { useCollectionsStore } from "@/stores/collectionsStore";

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
  useMockData?: boolean;
}

export function useRealTimeCollections(
  options: UseRealTimeCollectionsOptions = {}
) {
  const {
    enableSSE = true,
    fallbackPolling = true,
    newItemExpiry = 5 * 60 * 1000,
    useMockData = false,
  } = options;

  // Get store actions and state - now includes pool-specific actions
  const {
    collections,
    pools,
    poolMetrics,
    addCollections,
    addPools,
    updatePoolMetrics,
    clearNewIndicators,
    setConnectionState,
    setLoading,
    setError,
    newCollectionsCount,
    newPoolsCount,
    lastUpdate,
    connectionState,
    // Pool-specific actions for real-time updates
    addTransactionToPool,
    addNFTToPool,
  } = useCollectionsStore();

  // Local state for error handling
  const [localError, setLocalError] = useState<string | null>(null);
  const isInitializedRef = useRef(false);

  // SSE connection
  const {
    connectionState: sseConnectionState,
    subscribe,
    isConnected,
    error: sseError,
  } = useSSEConnection({
    endpoint: "/api/collections/sse",
    autoReconnect: true,
    reconnectDelay: 5000,
    maxReconnectAttempts: 3,
  });

  // Update connection state in store
  useEffect(() => {
    console.log("📡 SSE Connection state:", sseConnectionState);
    setConnectionState(sseConnectionState);
  }, [sseConnectionState, setConnectionState]);

  // Fallback polling
  const {
    history,
    isLoading: historyLoading,
    error: historyError,
    refetch,
  } = useTransactionHistory({
    limit: 100,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Update loading and error state in store
  useEffect(() => {
    setLoading(historyLoading && !useMockData);
    const errorToSet =
      sseError || (!useMockData ? historyError?.message || null : null);
    setError(errorToSet);
    setLocalError(errorToSet);
  }, [
    historyLoading,
    useMockData,
    sseError,
    historyError,
    setLoading,
    setError,
  ]);

  // Process transaction history (initial load and fallback)
  const processTransactionHistory = useCallback(
    (transactions: any[]) => {
      console.log("🔍 Processing transactions:", transactions.length);
      const newCollections: Collection[] = [];
      const newPools: Pool[] = [];
      const collectionMap = new Map();

      // First pass: collect collection metadata
      transactions.forEach((tx) => {
        if (
          tx.instructionName === "createCollectionNft" &&
          tx.args?.name &&
          tx.accounts
        ) {
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
            timestamp: tx.blockTime || 0,
          });
          console.log("✅ Found collection:", tx.args.name);
        }
      });

      // Second pass: process pools
      transactions.forEach((tx) => {
        if (
          tx.instructionName === "createPool" &&
          tx.poolAddress &&
          tx.accounts
        ) {
          const collectionMint = tx.accounts[1].toString();
          const collectionInfo = collectionMap.get(collectionMint);

          newPools.push({
            poolAddress: tx.poolAddress,
            collectionMint,
            collectionName:
              collectionInfo?.name ||
              `Collection ${collectionMint.slice(0, 6)}...`,
            signature: tx.signature,
            timestamp: tx.blockTime || 0,
            basePrice: tx.args?.basePrice?.toString(),
            growthFactor: tx.args?.growthFactor?.toString(),
          });
          console.log(
            "✅ Found pool:",
            tx.poolAddress,
            "for collection:",
            collectionInfo?.name
          );
        }
      });

      console.log("📊 Processing complete:", {
        foundCollections: newCollections.length,
        foundPools: newPools.length,
      });

      // Update store with new data
      if (newCollections.length > 0) {
        console.log("📝 Adding collections to store:", newCollections.length);
        addCollections(newCollections);
      }
      if (newPools.length > 0) {
        console.log("📝 Adding pools to store:", newPools.length);
        addPools(newPools);
      }
    },
    [addCollections, addPools]
  );

  // Load data on initialization
  useEffect(() => {
    if (isInitializedRef.current) return;

    console.log("🚀 Initializing data...");

    // Check if we have a rate limit error
    const isRateLimited =
      historyError?.message?.includes("429") ||
      historyError?.message?.includes("Too Many Requests");

    if (isRateLimited && pools.length === 0 && collections.length === 0) {
      console.log("⚠️ Rate limited, skipping initialization");
      isInitializedRef.current = true;
      return;
    }

    // Process actual history if available
    if (history && history.length > 0) {
      console.log(
        "📚 Processing initial transaction history...",
        history.length,
        "transactions"
      );
      processTransactionHistory(history);
      isInitializedRef.current = true;
    }
  }, [
    history,
    historyError,
    processTransactionHistory,
    pools.length,
    collections.length,
  ]);

  // Process transaction history as fallback
  useEffect(() => {
    if (!isConnected && fallbackPolling && history && history.length > 0) {
      console.log("📡 SSE disconnected, processing history as fallback...");
      processTransactionHistory(history);
    }
  }, [isConnected, fallbackPolling, history, processTransactionHistory]);

  // Handle SSE events
  useEffect(() => {
    if (!enableSSE || useMockData) return;

    console.log("📡 Setting up SSE event listeners...");

    // Subscribe to collection events
    const unsubscribeCollections = subscribe(
      "newCollections",
      (event: SSEEvent) => {
        console.log("📡 Received SSE newCollections event:", event.data);
        if (event.data && Array.isArray(event.data)) {
          const collections = event.data.map((collection: any) => ({
            ...collection,
            isNew: true,
          }));
          addCollections(collections);
        }
      }
    );

    // Subscribe to pool events
    const unsubscribePools = subscribe("newPools", (event: SSEEvent) => {
      console.log("📡 Received SSE newPools event:", event.data);
      if (event.data && Array.isArray(event.data)) {
        const pools = event.data.map((pool: any) => ({
          ...pool,
          isNew: true,
        }));
        addPools(pools);
      }
    });

    // Subscribe to volume updates
    const unsubscribeVolume = subscribe("volumeUpdate", (event: SSEEvent) => {
      console.log("📡 Received SSE volumeUpdate event:", event.data);
      if (event.data && event.data.updatedPools) {
        updatePoolMetrics(event.data.updatedPools);
      }
    });

    // NEW: Subscribe to pool-specific transaction events
    const unsubscribePoolTransactions = subscribe(
      "poolTransaction",
      (event: SSEEvent) => {
        console.log("📡 Received SSE poolTransaction event:", event.data);

        if (event.data && event.data.poolAddress && event.data.transaction) {
          const { poolAddress, transaction, transactionType } = event.data;

          // Add transaction to pool history
          addTransactionToPool(poolAddress, transaction);

          // If it's a mint, add NFT to pool
          if (transactionType === "mintNft" && transaction.args) {
            const nft = {
              mintAddress: transaction.accounts[1]?.toString() || "",
              name: transaction.args.name,
              symbol: transaction.args.symbol,
              uri: transaction.args.uri,
              timestamp: transaction.blockTime,
              signature: transaction.signature,
              price: transaction.price,
              minterAddress: transaction.accounts[0]?.toString() || "",
            };

            addNFTToPool(poolAddress, nft);
            console.log(`Added NFT to pool ${poolAddress}:`, nft.name);
          }

          console.log(`Processed ${transactionType} for pool ${poolAddress}`);
        }
      }
    );

    return () => {
      console.log("🔌 Unsubscribing from SSE events");
      unsubscribeCollections();
      unsubscribePools();
      unsubscribeVolume();
      unsubscribePoolTransactions(); // Added cleanup for pool transactions
    };
  }, [
    enableSSE,
    subscribe,
    addCollections,
    addPools,
    updatePoolMetrics,
    addTransactionToPool, // Added to dependencies
    addNFTToPool, // Added to dependencies
    useMockData,
  ]);

  // Clear "new" indicators after expiry
  useEffect(() => {
    if (newItemExpiry <= 0) return;

    const interval = setInterval(() => {
      const now = Date.now();

      // Check if any items are old enough to clear "new" status
      const hasOldNewItems =
        [
          ...collections.filter(
            (c) => c.isNew && now - c.timestamp * 1000 > newItemExpiry
          ),
          ...pools.filter(
            (p) => p.isNew && now - p.timestamp * 1000 > newItemExpiry
          ),
        ].length > 0;

      if (hasOldNewItems) {
        clearNewIndicators();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [newItemExpiry, collections, pools, clearNewIndicators]);

  // Manual refresh function
  const refresh = useCallback(() => {
    console.log("🔄 Manual refresh triggered");
    clearNewIndicators();

    // Don't refetch if using mock data
    if (useMockData) {
      console.log("🎭 Using mock data - no refetch needed");
      return;
    }

    console.log("📡 Triggering refetch...");
    refetch()
      .then(() => {
        console.log("✅ Refetch completed");
        setError(null);
        setLocalError(null);
      })
      .catch((error) => {
        console.error("❌ Refetch failed:", error);
        const errorMsg = error.message;
        setError(errorMsg);
        setLocalError(errorMsg);
      });
  }, [refetch, clearNewIndicators, useMockData, setError]);

  // Log final state
  useEffect(() => {
    console.log("📊 Final state:", {
      collections: collections.length,
      pools: pools.length,
      poolsWithMetrics: poolMetrics.size,
      newCollections: newCollectionsCount,
      newPools: newPoolsCount,
      connectionState,
      isInitialized: isInitializedRef.current,
    });
  }, [
    collections,
    pools,
    poolMetrics,
    newCollectionsCount,
    newPoolsCount,
    connectionState,
  ]);

  return {
    collections,
    pools,
    poolMetrics,
    newCollectionsCount,
    newPoolsCount,
    lastUpdate,
    connectionState,
    isConnected,
    isLoading: historyLoading && !useMockData,
    error: localError,
    refresh,
    stats: {
      totalCollections: collections.length,
      totalPools: pools.length,
      connectionStatus: connectionState,
      lastUpdate,
    },
  };
}
