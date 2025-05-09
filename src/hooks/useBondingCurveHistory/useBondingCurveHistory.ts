/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetchHeliusData } from "./network";
import { processTransactionFast } from "./extractors";
import { PublicKey, Connection } from "@solana/web3.js";
import { IDL as BondingCurveIDL } from "../../utils/idl";
import { useState, useEffect, useCallback } from "react";
import { createTimer, findAccountIndex } from "./helpers";
import { HistoryItem, BondingCurveHistoryResult } from "./types";
import {
  AnchorProvider,
  Idl,
  BorshInstructionCoder,
  Program,
} from "@coral-xyz/anchor";

import {
  HELIUS_API_BASE,
  HELIUS_API_KEY,
  PROGRAM_PUBLIC_KEY,
  DEFAULT_LIMIT,
  DEFAULT_MAX_CACHE_SIZE,
  DEFAULT_CACHE_TTL,
} from "./constants";
import {
  initializeCache,
  serializeCache,
  pruneCache,
  clearAllCaches,
} from "./cache";

/**
 * Hook to fetch transaction history for the bonding curve program with optimized
 * caching and price extraction.
 *
 * @param limit - Maximum number of transactions to fetch (default: 50)
 * @param maxCacheSize - Maximum number of transactions to store in cache (default: 500)
 * @param cacheTTL - Cache time-to-live in milliseconds (default: 1 hour)
 * @returns Object containing history items, loading states, and utility functions
 */
export function useBondingCurveHistory(
  limit: number = 50,
  maxCacheSize: number = DEFAULT_MAX_CACHE_SIZE,
  cacheTTL: number = DEFAULT_CACHE_TTL
): BondingCurveHistoryResult {
  // State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingPrices, setIsLoadingPrices] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [canLoadMore, setCanLoadMore] = useState<boolean>(true);
  const [lastSignature, setLastSignature] = useState<string | undefined>(
    undefined
  );

  // Cache state
  const [transactionCache, setTransactionCache] = useState<
    Map<string, HistoryItem>
  >(initializeCache().transactionCache);
  const [signatureCache, setSignatureCache] = useState<Set<string>>(
    initializeCache().signatureCache
  );

  // Performance stats
  const [performance, setPerformance] = useState({
    totalApiCalls: 0,
    totalRpcCalls: 0,
    avgResponseTime: 0,
    successfulPriceExtractions: 0,
    failedPriceExtractions: 0,
    lastFetchTime: 0,
  });

  // Keep connection/provider for Anchor Coder
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const connection = new Connection(
    `${HELIUS_API_BASE}/?api-key=${HELIUS_API_KEY}`,
    "confirmed"
  );

  const provider = new AnchorProvider(connection, {} as any, {
    commitment: "confirmed",
  });

  const program = new Program(
    BondingCurveIDL as Idl,
    PROGRAM_PUBLIC_KEY,
    provider
  );
  const instructionCoder = program.coder.instruction as BorshInstructionCoder;

  // Load prices in background for all sell operations with batch processing
  const loadSellPricesInBackground = useCallback(async () => {
    // Get all items that need price loading
    const itemsNeedingPrices = history.filter(
      (item) => item.isPriceLoading && !item.priceLoadAttempted
    );

    if (itemsNeedingPrices.length === 0) {
      setIsLoadingPrices(false);
      return;
    }

    setIsLoadingPrices(true);

    // Process in batches of signatures
    const batchSize = 10; // Larger batch size for getParsedTransactions
    for (let i = 0; i < itemsNeedingPrices.length; i += batchSize) {
      const batch = itemsNeedingPrices.slice(i, i + batchSize);
      const signatures = batch.map((item) => item.signature);

      try {
        // Get transaction data for multiple signatures at once
        const txs = await connection.getParsedTransactions(signatures, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });

        // Process results
        const results = batch.map((item, index) => {
          const tx = txs[index];
          let extractedPrice: number | undefined = undefined;

          // Extract the price from transaction data if available
          if (tx && tx.meta && item.instructionName === "sellNft") {
            // Find escrow address from accounts
            let escrowAddress: string | undefined;
            const idlInstruction = BondingCurveIDL.instructions.find(
              (ix) => ix.name === "sellNft"
            );

            if (idlInstruction) {
              const escrowIndex = findAccountIndex(idlInstruction, "escrow");
              if (escrowIndex !== -1 && item.accounts.length > escrowIndex) {
                escrowAddress = item.accounts[escrowIndex].toBase58();
              }
            }

            if (escrowAddress) {
              // Find the escrow account in the transaction
              const accountKeys = tx.transaction.message.accountKeys.map(
                (key) =>
                  typeof key === "string"
                    ? key
                    : key.pubkey
                    ? key.pubkey.toBase58()
                    : key.toString()
              );

              const escrowIndex = accountKeys.findIndex(
                (key) => key === escrowAddress
              );

              if (
                escrowIndex !== -1 &&
                tx.meta.preBalances &&
                tx.meta.postBalances &&
                escrowIndex < tx.meta.preBalances.length &&
                escrowIndex < tx.meta.postBalances.length
              ) {
                // Calculate the balance change
                const preBalance = tx.meta.preBalances[escrowIndex];
                const postBalance = tx.meta.postBalances[escrowIndex];
                const balanceChange = preBalance - postBalance;

                // Convert lamports to SOL if there was a significant change
                if (balanceChange > 1000) {
                  extractedPrice = balanceChange / 1_000_000_000; // LAMPORTS_PER_SOL

                  // Update performance metrics
                  setPerformance((prev) => ({
                    ...prev,
                    successfulPriceExtractions:
                      prev.successfulPriceExtractions + 1,
                  }));
                } else {
                  // Track failed extraction
                  setPerformance((prev) => ({
                    ...prev,
                    failedPriceExtractions: prev.failedPriceExtractions + 1,
                  }));
                }
              } else {
                // Track failed extraction
                setPerformance((prev) => ({
                  ...prev,
                  failedPriceExtractions: prev.failedPriceExtractions + 1,
                }));
              }
            }
          }

          return {
            signature: item.signature,
            price: extractedPrice,
            priceLoadAttempted: true,
            isPriceLoading: false,
          };
        });

        // Update history with the new prices
        setHistory((prevHistory) => {
          const updatedHistory = [...prevHistory];

          results.forEach((result) => {
            const index = updatedHistory.findIndex(
              (item) => item.signature === result.signature
            );
            if (index !== -1) {
              updatedHistory[index] = {
                ...updatedHistory[index],
                price: result.price,
                priceLoadAttempted: true,
                isPriceLoading: false,
              };
            }
          });

          return updatedHistory;
        });

        // Also update the transaction cache
        setTransactionCache((prevCache) => {
          const newCache = new Map(prevCache);

          results.forEach((result) => {
            if (newCache.has(result.signature)) {
              const item = newCache.get(result.signature)!;
              newCache.set(result.signature, {
                ...item,
                price: result.price,
                priceLoadAttempted: true,
                isPriceLoading: false,
              });
            }
          });

          return newCache;
        });
      } catch (error) {
        console.error("Error loading batch prices:", error);

        // Mark these items as attempted even on error to avoid infinite retries
        setHistory((prevHistory) => {
          const updatedHistory = [...prevHistory];

          batch.forEach((item) => {
            const index = updatedHistory.findIndex(
              (h) => h.signature === item.signature
            );
            if (index !== -1) {
              updatedHistory[index] = {
                ...updatedHistory[index],
                priceLoadAttempted: true,
                isPriceLoading: false,
              };
            }
          });

          return updatedHistory;
        });
      }

      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < itemsNeedingPrices.length) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    setIsLoadingPrices(false);
  }, [history, connection, setPerformance]);

  // Main fetch function - optimized for speed
  const fetchHeliusHistory = useCallback(
    async (beforeSig?: string) => {
      if (isLoading) return;
      setIsLoading(true);
      setError(null);

      const fetchTimer = createTimer(
        `Total fetch operation${beforeSig ? " (pagination)" : " (initial)"}`
      );

      try {
        // 1. Compute a sane limit
        const safeLimit =
          Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT;

        // 2. Fetch transaction data - build params
        const params: Record<string, string> = {
          limit: safeLimit.toString(),
        };

        if (beforeSig) {
          params.before = beforeSig;
        }

        // Execute fetch with our utility function
        const resp = await fetchHeliusData(
          `/addresses/${PROGRAM_PUBLIC_KEY.toBase58()}/transactions`,
          params,
          setPerformance
        );

        const txs = await resp.json();

        // 3. Check for end of data
        if (!Array.isArray(txs) || txs.length === 0) {
          setCanLoadMore(false);
          setIsLoading(false);
          fetchTimer.stop();
          return;
        }

        if (txs.length < safeLimit) {
          setCanLoadMore(false);
        }

        // 4. Update pagination cursor
        const lastSig = txs[txs.length - 1].signature;
        setLastSignature(lastSig);

        // 5. Filter out transactions we've already seen
        const newTxs = txs.filter((tx) => !signatureCache.has(tx.signature));

        // Track signatures we've seen
        setSignatureCache((prev) => {
          const s = new Set(prev);
          newTxs.forEach((tx) => s.add(tx.signature));
          return s;
        });

        if (newTxs.length === 0) {
          setIsLoading(false);
          fetchTimer.stop();
          return;
        }

        // 6. Fast initial processing (synchronous, no RPC calls)
        console.log(`Processing ${newTxs.length} new transactions`);

        const processTimer = createTimer("Fast transaction processing");
        const processedItems = newTxs.map((tx) => {
          const info = { timestamp: tx.timestamp };
          return processTransactionFast(
            tx,
            info,
            instructionCoder,
            PROGRAM_PUBLIC_KEY,
            BondingCurveIDL
          );
        });
        processTimer.stop();

        // 7. Update the history state with new transactions
        setHistory((prev) => {
          const seen = new Set(prev.map((item) => item.signature));
          const newItems = processedItems.filter(
            (item) => !seen.has(item.signature)
          );

          // Sort by block time, most recent first
          return [...newItems, ...prev].sort(
            (a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0)
          );
        });

        // 8. Update the transaction cache
        setTransactionCache((prev) => {
          const newCache = new Map(prev);
          processedItems.forEach((item) => {
            newCache.set(item.signature, item);
          });
          return newCache;
        });

        const totalTime = fetchTimer.stop();

        // 9. Update performance stats
        setPerformance((prev) => ({
          ...prev,
          lastFetchTime: totalTime,
        }));

        // 10. Trigger background price loading for sell operations
        setTimeout(() => {
          loadSellPricesInBackground();
        }, 100);
      } catch (err: any) {
        console.error("Error in fetchHeliusHistory:", err);
        setError(err.message || "Failed to fetch transaction history");
        setCanLoadMore(false);
        fetchTimer.stop();
      } finally {
        setIsLoading(false);
      }
    },
    [
      isLoading,
      limit,
      signatureCache,
      loadSellPricesInBackground,
      instructionCoder,
    ]
  );

  // Load more function
  const loadMore = useCallback(() => {
    if (canLoadMore && lastSignature && !isLoading) {
      fetchHeliusHistory(lastSignature);
    }
  }, [canLoadMore, lastSignature, isLoading, fetchHeliusHistory]);

  // Clear cache function
  const clearCache = useCallback(() => {
    setTransactionCache(new Map());
    setSignatureCache(new Set());
    setHistory([]);
    setLastSignature(undefined);
    setCanLoadMore(true);
    clearAllCaches();
    setPerformance({
      totalApiCalls: 0,
      totalRpcCalls: 0,
      avgResponseTime: 0,
      successfulPriceExtractions: 0,
      failedPriceExtractions: 0,
      lastFetchTime: 0,
    });
  }, []);

  // Cache maintenance - remove old items if cache exceeds size limit
  useEffect(() => {
    if (transactionCache.size > maxCacheSize) {
      // Use our utility function to prune cache
      setTransactionCache((prev) =>
        pruneCache(
          prev,
          maxCacheSize,
          (a, b) => (a[1].blockTime ?? 0) - (b[1].blockTime ?? 0)
        )
      );

      // Also prune signature cache to match
      setSignatureCache((prev) => {
        const txKeys = new Set([...transactionCache.keys()]);
        return new Set([...prev].filter((sig) => txKeys.has(sig)));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionCache.size, maxCacheSize]);

  // Initial data load from localStorage if available
  useEffect(() => {
    try {
      const cachedDataString = localStorage.getItem(
        "bondingCurveTransactionCache"
      );
      if (cachedDataString) {
        const parsed = JSON.parse(cachedDataString);

        // Convert objects back to HistoryItems with PublicKey objects
        const historyItems = Object.values(parsed).map((item: any) => ({
          ...item,
          accounts: item.accounts
            ? item.accounts.map((acc: string) => new PublicKey(acc))
            : [],
        }));

        // Sort by block time
        historyItems.sort(
          (a: any, b: any) => (b.blockTime ?? 0) - (a.blockTime ?? 0)
        );

        setHistory(historyItems);

        // Populate caches
        const signatures = new Set(historyItems.map((item) => item.signature));
        setSignatureCache(signatures);

        const cacheMap = new Map();
        historyItems.forEach((item) => {
          cacheMap.set(item.signature, item);
        });
        setTransactionCache(cacheMap);

        console.log(`Loaded ${historyItems.length} items from cache`);
      }
    } catch (err) {
      console.error("Error loading cache from localStorage:", err);
    }
  }, []);

  // Save cache to localStorage
  useEffect(() => {
    try {
      if (transactionCache.size > 0) {
        // Only save if we have items and not too frequently
        const saveTimer = createTimer("Save to localStorage");

        // Use our utility to serialize the cache
        const serializedCache = serializeCache(transactionCache);

        localStorage.setItem(
          "bondingCurveTransactionCache",
          JSON.stringify(serializedCache)
        );

        saveTimer.stop();
      }
    } catch (err) {
      console.error("Error saving cache to localStorage:", err);
    }
  }, [transactionCache]);

  // Cache expiration based on TTL
  useEffect(() => {
    const now = Date.now();
    const expirationTime = now - cacheTTL;

    // Find expired cache entries
    const expiredEntries = [...transactionCache.entries()].filter(
      ([, item]) => (item.blockTime ?? 0) < expirationTime
    );

    if (expiredEntries.length > 0) {
      setTransactionCache((prev) => {
        const newCache = new Map(prev);
        expiredEntries.forEach(([key]) => {
          newCache.delete(key);
        });
        return newCache;
      });

      setSignatureCache((prev) => {
        const newCache = new Set(prev);
        expiredEntries.forEach(([key]) => {
          newCache.delete(key);
        });
        return newCache;
      });
    }
  }, [transactionCache, cacheTTL]);

  // Initial data load
  useEffect(() => {
    if (history.length === 0 && !isLoading) {
      console.log("Initial data load");
      fetchHeliusHistory();
    }
  }, [history.length, isLoading, fetchHeliusHistory]);

  // Return the hook's values and functions
  return {
    history,
    isLoading,
    isLoadingPrices,
    error,
    loadMore,
    canLoadMore,
    clearCache,
    stats: performance,
  };
}
