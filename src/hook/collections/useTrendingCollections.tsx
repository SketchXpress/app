/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTransactionHistory } from "@/hook/api/helius/";
import { usePoolPrices } from "@/hook/api/anchor/usePoolPrices";
import { processTrendingCollections } from "@/utils/processTrendingCollections";
import { fetchMetadataBatch } from "@/utils/metadataUtils";
import type {
  DynamicCollection,
  TrendingCollectionsConfig,
  TrendingCollectionsResult,
} from "@/types/collections";

// Constants
const PLACEHOLDER_NFT_IMAGES = [
  "/assets/images/defaultNFT.png",
  "/assets/images/nft1.jpeg",
  "/assets/images/nft2.avif",
  "/assets/images/nft3.jpg",
  "/assets/images/nft4.jpg",
  "/assets/images/nft5.png",
  "/assets/images/nft6.webp",
];

// Helper Functions
const getStableImage = (
  poolAddress: string,
  images: string[] = PLACEHOLDER_NFT_IMAGES
): string => {
  if (!poolAddress) return images[0];

  // Create a simple hash from the pool address
  const hash = poolAddress
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const imageIndex = hash % images.length;
  return images[imageIndex];
};

const sortCollections = (
  collections: any[],
  sortBy: "trending" | "top"
): any[] => {
  const sorted = [...collections];

  if (sortBy === "trending") {
    sorted.sort((a, b) => b.timestamp - a.timestamp); // Sort by most recent
  } else {
    sorted.sort((a, b) => b.totalVolume - a.totalVolume); // Sort by highest volume
  }

  return sorted;
};

// Main Hook
export function useTrendingCollections(
  config: TrendingCollectionsConfig = {}
): TrendingCollectionsResult {
  const {
    maxCollections = 8,
    enablePricing = true,
    sortBy = "trending",
    refreshInterval,
  } = config;

  // States
  const [processedCollections, setProcessedCollections] = useState<
    DynamicCollection[]
  >([]);
  const [poolAddressesForPricing, setPoolAddressesForPricing] = useState<
    string[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch transaction history
  const {
    history,
    isLoading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useTransactionHistory({
    limit: 100,
    staleTime: refreshInterval || 60 * 1000,
  });

  // Fetch pool prices
  const {
    data: prices,
    isLoading: pricesLoading,
    error: pricesError,
    refetch: refetchPrices,
  } = usePoolPrices(poolAddressesForPricing, {
    enabled: enablePricing && poolAddressesForPricing.length > 0,
    staleTime: 30 * 1000,
  });

  // Process transaction history into collections
  useEffect(() => {
    if (historyLoading) return;

    if (historyError) {
      setError(
        historyError instanceof Error
          ? historyError.message
          : "Failed to load transaction history."
      );
      setProcessedCollections([]);
      return;
    }

    if (!history || history.length === 0) {
      setProcessedCollections([]);
      setError(null);
      return;
    }

    const processData = async () => {
      try {
        // Process trending collections with metadata fetching
        const poolData = await processTrendingCollections(history);
        console.log("Pool data with URIs:", poolData);

        // Sort collections based on configuration
        const sortedPools = sortCollections(poolData, sortBy);

        // Take only the top collections
        const topPools = sortedPools.slice(0, maxCollections);

        // Collect all URIs that need fetching
        const urisToFetch = topPools
          .filter((pool) => pool.uri && !pool.image)
          .map((pool) => pool.uri!)
          .filter((uri, index, self) => self.indexOf(uri) === index); // Remove duplicates

        // Batch fetch metadata
        if (urisToFetch.length > 0) {
          const metadataResults = await fetchMetadataBatch(urisToFetch);

          // Update pools with fetched metadata
          topPools.forEach((pool) => {
            if (pool.uri && metadataResults.has(pool.uri)) {
              const metadata = metadataResults.get(pool.uri);
              if (metadata) {
                pool.name = metadata.name || pool.name;
                pool.image = metadata.image;
              }
            }
          });
        }

        // Format collections with fetched metadata images
        const formattedCollections: DynamicCollection[] = topPools.map(
          (pool, index) => ({
            id: pool.poolAddress,
            rank: index + 1,
            name: pool.name,
            // Use metadata image if available, otherwise use stable fallback
            image:
              pool.image ||
              getStableImage(pool.poolAddress, PLACEHOLDER_NFT_IMAGES),
            verified: true,
            nftCount: pool.nftCount,
            totalVolume: pool.totalVolume,
          })
        );

        setProcessedCollections(formattedCollections);

        // Extract unique pool addresses for pricing
        if (enablePricing) {
          const uniquePoolAddresses = [
            ...new Set(formattedCollections.map((c) => c.id)),
          ];
          setPoolAddressesForPricing(uniquePoolAddresses);
        }

        setError(null);
      } catch (err) {
        console.error("Error processing collections:", err);
        setError(
          err instanceof Error
            ? err.message
            : "An error occurred while processing collections."
        );
        setProcessedCollections([]);
      }
    };

    processData();
  }, [
    history,
    historyLoading,
    historyError,
    sortBy,
    maxCollections,
    enablePricing,
  ]);

  // Handle price loading errors
  useEffect(() => {
    if (pricesError) {
      console.error("Error fetching pool prices:", pricesError);
    }
  }, [pricesError]);

  // Create render props for pool prices
  const renderPoolPrice = useCallback(
    (collection: DynamicCollection): React.ReactNode => {
      if (!enablePricing) {
        return React.createElement(
          "div",
          { className: "price-cell" },
          `${collection.totalVolume.toFixed(4)} SOL`
        );
      }

      if (
        !pricesLoading &&
        prices &&
        typeof prices === "object" &&
        collection.id in prices
      ) {
        const price = prices[collection.id];
        if (typeof price === "number") {
          return React.createElement(
            "div",
            { className: "price-cell" },
            `${price.toFixed(4)} SOL`
          );
        }
      }

      // Fallback to showing total volume if price isn't available or still loading
      return React.createElement(
        "div",
        { className: "price-cell" },
        `${collection.totalVolume.toFixed(4)} SOL`
      );
    },
    [enablePricing, pricesLoading, prices]
  );

  // Split collections into left and right columns for desktop display
  const { leftCollections, rightCollections } = useMemo(
    () => ({
      leftCollections: processedCollections.slice(0, 4),
      rightCollections: processedCollections.slice(4, 8),
    }),
    [processedCollections]
  );

  // Combined loading state
  const isLoading =
    historyLoading ||
    (enablePricing && poolAddressesForPricing.length > 0 && pricesLoading);

  // Combined refetch function
  const refetch = useCallback(() => {
    refetchHistory();
    if (enablePricing && poolAddressesForPricing.length > 0) {
      refetchPrices();
    }
  }, [
    refetchHistory,
    refetchPrices,
    enablePricing,
    poolAddressesForPricing.length,
  ]);

  return {
    collections: processedCollections,
    leftCollections,
    rightCollections,
    isLoading,
    isLoadingPrices: pricesLoading,
    error,
    refetch,
    renderPoolPrice,
  };
}

// Export helper functions for testing
export { getStableImage, sortCollections };
