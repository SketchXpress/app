"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useReducer, useEffect, useCallback, useMemo, useRef } from "react";
import { PublicKey } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";
import { IDL as BondingCurveIDL } from "@/utils/idl";
import { BorshInstructionCoder } from "@coral-xyz/anchor";
import { solanaRPCManager } from "@/lib/solanaRPCManager";
import { useGlobalCache } from "@/hook/shared/state/useGlobalCache";
import { useAnchorContext } from "@/contexts/AnchorContextProvider";
import { PROGRAM_PUBLIC_KEY } from "@/hooks/useBondingCurveHistory/constants";
import { useDeduplicateRequests } from "@/hook/shared/utils/useDeduplicateRequests";
import { processTransactionFast } from "@/hooks/useBondingCurveHistory/extractors";

// ===== TYPES =====
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
  autoFetchAll?: boolean;
  maxBatches?: number;
  emptyBatchesToConfirm?: number;
  maxHistorySize?: number;
  autoFetchDelay?: number;
  enableOptimisticUpdates?: boolean;
}

// ===== STATE MANAGEMENT WITH REDUCER =====
interface TransactionState {
  items: HistoryItem[];
  signatureSet: Set<string>;
  lastSignature: string | undefined;
  lastUpdate: number;
  batchesLoaded: number;
  emptyBatchesReceived: number;
  canLoadMore: boolean;
  isLoadingMore: boolean;
  autoFetchCompleted: boolean;
  isInitialized: boolean;
  error: string | null;
}

type TransactionAction =
  | { type: "INITIALIZE"; payload: HistoryItem[] }
  | { type: "ADD_BATCH"; payload: HistoryItem[] }
  | { type: "SET_LOADING_MORE"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "COMPLETE_AUTO_FETCH" }
  | { type: "INCREMENT_EMPTY_BATCHES" }
  | { type: "RESET" }
  | { type: "UPDATE_LAST_SIGNATURE"; payload: string };

const initialState: TransactionState = {
  items: [],
  signatureSet: new Set(),
  lastSignature: undefined,
  lastUpdate: Date.now(),
  batchesLoaded: 0,
  emptyBatchesReceived: 0,
  canLoadMore: true,
  isLoadingMore: false,
  autoFetchCompleted: false,
  isInitialized: false,
  error: null,
};

// ===== OPTIMIZED REDUCER =====
function transactionReducer(
  state: TransactionState,
  action: TransactionAction,
  maxHistorySize: number = 1000,
  maxBatches: number = 10,
  emptyBatchesToConfirm: number = 2
): TransactionState {
  switch (action.type) {
    case "INITIALIZE": {
      const newItems = action.payload;
      const newSignatureSet = new Set(newItems.map((item) => item.signature));

      return {
        ...state,
        items: newItems,
        signatureSet: newSignatureSet,
        lastSignature: newItems[newItems.length - 1]?.signature,
        lastUpdate: Date.now(),
        batchesLoaded: 1,
        emptyBatchesReceived: 0,
        canLoadMore: newItems.length > 0,
        isInitialized: true,
        autoFetchCompleted: false,
      };
    }

    case "ADD_BATCH": {
      const newItems = action.payload;

      // Filter out duplicates efficiently
      const filteredNewItems = newItems.filter(
        (item) => !state.signatureSet.has(item.signature)
      );

      if (filteredNewItems.length === 0) {
        const newEmptyBatches = state.emptyBatchesReceived + 1;
        return {
          ...state,
          batchesLoaded: state.batchesLoaded + 1,
          emptyBatchesReceived: newEmptyBatches,
          canLoadMore: newEmptyBatches < emptyBatchesToConfirm,
          autoFetchCompleted: newEmptyBatches >= emptyBatchesToConfirm,
          lastUpdate: Date.now(),
        };
      }

      // Merge and apply LRU eviction in one pass
      const merged = [...state.items, ...filteredNewItems];
      const finalItems =
        merged.length > maxHistorySize ? merged.slice(-maxHistorySize) : merged;

      // Update signature set efficiently
      const newSignatureSet = new Set(finalItems.map((item) => item.signature));
      const newBatchesLoaded = state.batchesLoaded + 1;

      return {
        ...state,
        items: finalItems,
        signatureSet: newSignatureSet,
        lastSignature: filteredNewItems[filteredNewItems.length - 1]?.signature,
        lastUpdate: Date.now(),
        batchesLoaded: newBatchesLoaded,
        emptyBatchesReceived: 0,
        canLoadMore: newBatchesLoaded < maxBatches,
        autoFetchCompleted: newBatchesLoaded >= maxBatches,
      };
    }

    case "SET_LOADING_MORE":
      return { ...state, isLoadingMore: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "COMPLETE_AUTO_FETCH":
      return {
        ...state,
        autoFetchCompleted: true,
        canLoadMore: false,
      };

    case "INCREMENT_EMPTY_BATCHES": {
      const newEmptyBatches = state.emptyBatchesReceived + 1;
      return {
        ...state,
        emptyBatchesReceived: newEmptyBatches,
        canLoadMore: newEmptyBatches < emptyBatchesToConfirm,
        autoFetchCompleted: newEmptyBatches >= emptyBatchesToConfirm,
      };
    }

    case "RESET":
      return { ...initialState, lastUpdate: Date.now() };

    case "UPDATE_LAST_SIGNATURE":
      return { ...state, lastSignature: action.payload };

    default:
      return state;
  }
}

// ===== MEMOIZED FETCH FUNCTION =====
const createFetchFunction = (
  HELIUS_API_KEY: string | undefined,
  program: any,
  PROGRAM_PUBLIC_KEY: PublicKey
) => {
  return async (limit: number, beforeSig?: string): Promise<HistoryItem[]> => {
    if (!HELIUS_API_KEY) {
      throw new Error("Helius API key not configured");
    }

    const apiLimit = Math.max(1, Math.min(limit, 100));
    const API_BASE = `https://api-devnet.helius.xyz/v0`;
    let url = `${API_BASE}/addresses/${PROGRAM_PUBLIC_KEY.toBase58()}/transactions?api-key=${HELIUS_API_KEY}&limit=${apiLimit}`;

    if (beforeSig) {
      url += `&before=${beforeSig}`;
    }

    return solanaRPCManager.queueRequest("helius-transactions", async () => {
      const response = await fetch(url);

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        throw new Error(`Rate limited. Retry after ${waitTime}ms`);
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const transactions = await response.json();
      if (!Array.isArray(transactions)) {
        throw new Error("Invalid response format from Helius API");
      }

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
    });
  };
};

// ===== OPTIMIZED MAIN HOOK =====
export function useTransactionHistory(
  config: UseTransactionHistoryConfig = { limit: 100 }
) {
  const {
    limit,
    staleTime = 120 * 1000,
    gcTime = 10 * 60 * 1000,
    autoFetchAll = true,
    maxBatches = 10,
    emptyBatchesToConfirm = 2,
    maxHistorySize = 1000,
    autoFetchDelay = 150,
  } = config;

  const effectiveLimit = Math.max(1, Math.min(limit, 100));
  const { program } = useAnchorContext();
  const { deduplicatedFetch } = useDeduplicateRequests<HistoryItem[]>();
  const cache = useGlobalCache();

  // ===== STABLE REFS =====
  const autoFetchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const configRef = useRef({
    maxBatches,
    emptyBatchesToConfirm,
    maxHistorySize,
  });

  // Update config ref when values change
  configRef.current = { maxBatches, emptyBatchesToConfirm, maxHistorySize };

  // ===== REDUCER STATE =====
  const [state, dispatch] = useReducer(
    (state: TransactionState, action: TransactionAction) =>
      transactionReducer(
        state,
        action,
        configRef.current.maxHistorySize,
        configRef.current.maxBatches,
        configRef.current.emptyBatchesToConfirm
      ),
    initialState
  );

  // ===== MEMOIZED FETCH FUNCTION =====
  const fetchTransactionHistory = useMemo(() => {
    const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
    return createFetchFunction(HELIUS_API_KEY, program, PROGRAM_PUBLIC_KEY);
  }, [program]);

  // ===== STABLE QUERY CONFIGURATION =====
  const queryConfig = useMemo(
    () => ({
      queryKey: [
        "transactionHistory",
        effectiveLimit,
        program?.programId?.toString(),
      ],
      queryFn: () =>
        deduplicatedFetch(
          `tx-history-${effectiveLimit}`,
          () => fetchTransactionHistory(effectiveLimit),
          60000
        ),
      enabled: !!program && !state.isInitialized,
      staleTime,
      gcTime,
      refetchOnWindowFocus: false,
      retry: (failureCount: number, error: any) => {
        const errorMessage = error?.message || "";
        if (
          errorMessage.includes("429") ||
          errorMessage.includes("Rate limited")
        ) {
          return failureCount < 1; // Only retry rate limits once
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex: number) => {
        const baseDelay = 5000;
        return Math.min(baseDelay * Math.pow(2, attemptIndex), 30000);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      effectiveLimit,
      program?.programId,
      state.isInitialized,
      deduplicatedFetch,
      fetchTransactionHistory,
      staleTime,
      gcTime,
    ]
  );

  const {
    data: initialHistory,
    isLoading: isLoadingInitial,
    error,
    refetch,
  } = useQuery(queryConfig);

  // ===== OPTIMIZED LOAD MORE =====
  const loadMore = useCallback(async () => {
    if (
      !state.lastSignature ||
      isLoadingInitial ||
      state.isLoadingMore ||
      !state.canLoadMore ||
      state.autoFetchCompleted
    ) {
      return;
    }

    dispatch({ type: "SET_LOADING_MORE", payload: true });

    try {
      const moreHistory = await deduplicatedFetch(
        `tx-history-${effectiveLimit}-${state.lastSignature}`,
        () => fetchTransactionHistory(effectiveLimit, state.lastSignature),
        60000
      );

      dispatch({ type: "ADD_BATCH", payload: moreHistory });
    } catch (error) {
      console.error("Error loading transactions:", error);
      dispatch({
        type: "SET_ERROR",
        payload: error instanceof Error ? error.message : "Unknown error",
      });
      dispatch({ type: "COMPLETE_AUTO_FETCH" });
    } finally {
      dispatch({ type: "SET_LOADING_MORE", payload: false });
    }
  }, [
    state.lastSignature,
    state.isLoadingMore,
    state.canLoadMore,
    state.autoFetchCompleted,
    isLoadingInitial,
    deduplicatedFetch,
    effectiveLimit,
    fetchTransactionHistory,
  ]);

  // ===== EFFECTS =====

  // Handle initial data load
  useEffect(() => {
    if (initialHistory && initialHistory.length > 0 && !state.isInitialized) {
      dispatch({ type: "INITIALIZE", payload: initialHistory });
    }
  }, [initialHistory, state.isInitialized]);

  // Auto-fetch effect with cleanup
  useEffect(() => {
    if (
      autoFetchAll &&
      state.canLoadMore &&
      !isLoadingInitial &&
      !state.isLoadingMore &&
      !state.autoFetchCompleted &&
      state.lastSignature &&
      state.isInitialized
    ) {
      autoFetchTimerRef.current = setTimeout(loadMore, autoFetchDelay);
    }

    return () => {
      if (autoFetchTimerRef.current) {
        clearTimeout(autoFetchTimerRef.current);
        autoFetchTimerRef.current = null;
      }
    };
  }, [
    autoFetchAll,
    state.canLoadMore,
    state.isLoadingMore,
    state.autoFetchCompleted,
    state.lastSignature,
    state.isInitialized,
    isLoadingInitial,
    loadMore,
    autoFetchDelay,
  ]);

  // ===== MEMOIZED HANDLERS =====
  const clearCache = useCallback(() => {
    cache.clear();
    dispatch({ type: "RESET" });
    refetch();
  }, [cache, refetch]);

  // ===== MEMOIZED RETURN VALUE =====
  const returnValue = useMemo(
    () => ({
      history: state.items,
      isLoading: isLoadingInitial || state.isLoadingMore,
      isLoadingInitial,
      isLoadingMore: state.isLoadingMore,
      error: error?.message || state.error,
      loadMore,
      canLoadMore: state.canLoadMore,
      clearCache,
      stats: {
        totalItems: state.items.length,
        batchesLoaded: state.batchesLoaded,
        completed: state.autoFetchCompleted,
        lastUpdate: state.lastUpdate,
        isInitialized: state.isInitialized,
      },
      refetch,
      autoFetchCompleted: state.autoFetchCompleted,
    }),
    [
      state.items,
      state.isLoadingMore,
      state.canLoadMore,
      state.autoFetchCompleted,
      state.batchesLoaded,
      state.lastUpdate,
      state.isInitialized,
      state.error,
      isLoadingInitial,
      error?.message,
      loadMore,
      clearCache,
      refetch,
    ]
  );

  return returnValue;
}

// Compatibility export
export { useTransactionHistory as useBondingCurveHistory };
