// src/hooks/usePoolCollections.ts
import { useState, useEffect, useMemo } from "react";
import { useBondingCurveHistory } from "@/hooks/useBondingCurveHistory";

export interface PoolCollection {
  poolAddress: string;
  collectionName: string;
  collectionMint?: string;
}

/**
 * Hook to get pool addresses with their collection names
 *
 * @returns Object containing array of pools with collection names, loading state, and error
 */
export function usePoolCollections() {
  // Use transaction history to extract pool and collection data
  const {
    history,
    isLoading: historyLoading,
    error: historyError,
  } = useBondingCurveHistory();

  // Local state to track loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Process history to extract pools and their collection names
  const poolCollections = useMemo(() => {
    if (!history || history.length === 0) return [];

    try {
      // First, build a map of collection mints to names
      const collectionNameMap = new Map<string, string>();

      history.forEach((tx) => {
        if (
          tx.instructionName === "createCollectionNft" &&
          tx.args?.name &&
          tx.accounts &&
          tx.accounts.length > 1
        ) {
          const collectionMint = tx.accounts[1].toString();
          collectionNameMap.set(collectionMint, tx.args.name as string);
        }
      });

      // Next, map pools to collection mints and names
      const poolCollectionMap = new Map<string, PoolCollection>();

      history.forEach((tx) => {
        // For createPool transactions, link the pool to its collection
        if (
          tx.instructionName === "createPool" &&
          tx.poolAddress &&
          tx.accounts &&
          tx.accounts.length > 1
        ) {
          const poolAddress = tx.poolAddress;
          const collectionMint = tx.accounts[1].toString();
          const collectionName =
            collectionNameMap.get(collectionMint) ||
            `Collection ${collectionMint.slice(0, 6)}...`;

          poolCollectionMap.set(poolAddress, {
            poolAddress,
            collectionName,
            collectionMint,
          });
        }

        // For any transaction with a pool address, ensure the pool is in our map
        else if (tx.poolAddress && !poolCollectionMap.has(tx.poolAddress)) {
          poolCollectionMap.set(tx.poolAddress, {
            poolAddress: tx.poolAddress,
            collectionName: `Pool ${tx.poolAddress.slice(0, 6)}...`,
          });
        }
      });

      // Return all pool collections as an array
      return Array.from(poolCollectionMap.values());
    } catch (err) {
      console.error("Error processing pool collections:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error processing collections"
      );
      return [];
    }
  }, [history]);

  // Update loading state based on transaction history loading
  useEffect(() => {
    if (historyLoading) {
      setIsLoading(true);
      setError(null);
    } else {
      setIsLoading(false);
      if (historyError) {
        setError(
          typeof historyError === "object" &&
            historyError !== null &&
            "message" in historyError
            ? (historyError as Error).message
            : String(historyError)
        );
      }
    }
  }, [historyLoading, historyError]);

  return {
    poolCollections,
    isLoading,
    error,
    count: poolCollections.length,
  };
}

/**
 * Hook to get a specific pool collection by address
 *
 * @param poolAddress The pool address to look up
 * @returns The pool collection or null if not found
 */
export function usePoolCollection(poolAddress: string) {
  const { poolCollections, isLoading, error } = usePoolCollections();

  const poolCollection = useMemo(() => {
    if (!poolAddress || !poolCollections) return null;
    return (
      poolCollections.find((pool) => pool.poolAddress === poolAddress) || null
    );
  }, [poolAddress, poolCollections]);

  return {
    poolCollection,
    isLoading,
    error,
  };
}
