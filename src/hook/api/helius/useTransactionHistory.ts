/* eslint-disable @typescript-eslint/no-explicit-any */
import { PublicKey } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";
import { IDL as BondingCurveIDL } from "@/utils/idl";
import { BorshInstructionCoder } from "@coral-xyz/anchor";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAnchorContext } from "@/contexts/AnchorContextProvider";
import { useGlobalCache } from "@/hook/shared/state/useGlobalCache";
import { useDeduplicateRequests } from "@/hook/shared/utils/useDeduplicateRequests";
import { processTransactionFast } from "@/hooks/useBondingCurveHistory/extractors";
import { PROGRAM_PUBLIC_KEY } from "@/hooks/useBondingCurveHistory/constants";
import { solanaRPCManager } from "@/lib/solanaRPCManager";

// Types
export interface HistoryItem {
  signature: string;
  blockTime: number | null | undefined;
  instructionName: string;
  accounts: PublicKey[];
  args: any;
  description: string;
  type: string;
  source: string;
  error: any;
  poolAddress?: string;
  price?: number;
  isPriceLoading?: boolean;
  priceLoadAttempted?: boolean;
}

export interface UseTransactionHistoryConfig {
  limit: number;
  staleTime?: number;
  gcTime?: number;
}

// Enhanced fetch function with rate limiting
const fetchTransactionHistory = async (
  limit: number,
  beforeSig?: string,
  program?: any
): Promise<HistoryItem[]> => {
  const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;

  if (!HELIUS_API_KEY) {
    throw new Error("Helius API key not configured");
  }

  // Ensure limit does not exceed Helius API constraints (1-100)
  const apiLimit = Math.max(1, Math.min(limit, 100));

  const API_BASE = `https://api-devnet.helius.xyz/v0`;
  let url = `${API_BASE}/addresses/${PROGRAM_PUBLIC_KEY.toBase58()}/transactions?api-key=${HELIUS_API_KEY}&limit=${apiLimit}`;

  if (beforeSig) {
    url += `&before=${beforeSig}`;
  }

  // Use rate limiter for the request
  return solanaRPCManager.queueRequest("helius-transactions", async () => {
    let retries = 3;
    let delay = 1000;

    while (retries > 0) {
      try {
        const response = await fetch(url);

        if (response.status === 429) {
          const retryAfter = response.headers.get("retry-after");
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          delay *= 2;
          retries--;
          continue;
        }

        if (!response.ok) {
          // Log the URL that caused the error for easier debugging
          console.error(`Helius API request failed for URL: ${url}`);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const transactions = await response.json();
        if (!Array.isArray(transactions)) {
          throw new Error("Invalid response format from Helius API");
        }

        // Process transactions
        const instructionCoder = program?.coder
          .instruction as BorshInstructionCoder;
        if (!instructionCoder) {
          throw new Error("Instruction coder not available");
        }

        return transactions.map((tx: any) => {
          const basicInfo = {
            timestamp: tx.timestamp || Math.floor(Date.now() / 1000),
          };
          return processTransactionFast(
            tx,
            basicInfo,
            instructionCoder,
            PROGRAM_PUBLIC_KEY,
            BondingCurveIDL
          );
        });
      } catch (error) {
        if (retries === 1) {
          throw error;
        }
        console.warn(
          `Error fetching transactions, ${retries - 1} retries left:`,
          error
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        retries--;
      }
    }

    throw new Error("Failed to fetch transactions after all retries");
  });
};

// Main Hook
export function useTransactionHistory(
  config: UseTransactionHistoryConfig = { limit: 100 } // Default limit set to 100 (Helius max)
) {
  const { limit, staleTime = 120 * 1000, gcTime = 10 * 60 * 1000 } = config;

  // Ensure the limit used by the hook internally respects the API constraint
  const effectiveLimit = Math.max(1, Math.min(limit, 100));

  const { program } = useAnchorContext();
  const { deduplicatedFetch } = useDeduplicateRequests<HistoryItem[]>();
  const cache = useGlobalCache();

  // Local state for pagination
  const [allHistory, setAllHistory] = useState<HistoryItem[]>([]);
  const [lastSignature, setLastSignature] = useState<string | undefined>();
  const [canLoadMore, setCanLoadMore] = useState(true);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);

  // Initial fetch using React Query
  const {
    data: initialHistory,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["transactionHistory", effectiveLimit], // Use effectiveLimit in queryKey
    queryFn: () =>
      deduplicatedFetch(
        `tx-history-${effectiveLimit}`,
        () => fetchTransactionHistory(effectiveLimit, undefined, program), // Pass effectiveLimit
        60000 // 1 minute deduplication window
      ),
    enabled: !!program,
    staleTime,
    gcTime,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Don't auto-retry on rate limit errors
      const errorMessage = error?.message || "";
      if (errorMessage.includes("429")) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) =>
      Math.min(5000 * Math.pow(2, attemptIndex), 30000),
  });

  // Update state when initial data loads
  useEffect(() => {
    if (initialHistory && initialHistory.length > 0) {
      setAllHistory(initialHistory);

      // Set pagination cursor
      const lastSig = initialHistory[initialHistory.length - 1]?.signature;
      setLastSignature(lastSig);

      // Check if we can load more
      setCanLoadMore(initialHistory.length === effectiveLimit); // Use effectiveLimit

      // Disabled background price loading to prevent rate limiting
      setIsLoadingPrices(false);
    }
  }, [initialHistory, effectiveLimit]);

  // Load more function (simplified)
  const loadMore = useCallback(async () => {
    if (!canLoadMore || !lastSignature || isLoading) return;

    try {
      const moreHistory = await deduplicatedFetch(
        `tx-history-${effectiveLimit}-${lastSignature}`,
        () => fetchTransactionHistory(effectiveLimit, lastSignature, program), // Pass effectiveLimit
        60000
      );

      if (moreHistory.length === 0) {
        setCanLoadMore(false);
        return;
      }

      // Merge new data with existing
      setAllHistory((current) => {
        const existingSignatures = new Set(
          current.map((item) => item.signature)
        );
        const newItems = moreHistory.filter(
          (item: { signature: string }) =>
            !existingSignatures.has(item.signature)
        );
        return [...current, ...newItems];
      });

      // Update pagination
      const newLastSig = moreHistory[moreHistory.length - 1]?.signature;
      setLastSignature(newLastSig);
      setCanLoadMore(moreHistory.length === effectiveLimit); // Use effectiveLimit
    } catch (error) {
      console.error("Error loading more transactions:", error);
    }
  }, [
    canLoadMore,
    lastSignature,
    isLoading,
    deduplicatedFetch,
    effectiveLimit, // Use effectiveLimit
    program,
  ]);

  // Clear cache function
  const clearCache = useCallback(() => {
    cache.clear();
    setAllHistory([]);
    setLastSignature(undefined);
    setCanLoadMore(true);
    refetch();
  }, [cache, refetch]);

  // Performance stats
  const stats = useMemo(
    () => ({
      totalItems: allHistory.length,
      itemsWithPrices: allHistory.filter((item) => item.price !== undefined)
        .length,
      isLoadingPrices,
    }),
    [allHistory, isLoadingPrices]
  );

  return {
    history: allHistory,
    isLoading,
    isLoadingPrices,
    error,
    loadMore,
    canLoadMore,
    clearCache,
    stats,
    refetch,
  };
}

// Compatibility export for existing code
export { useTransactionHistory as useBondingCurveHistory };
