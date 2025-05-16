import React, { useMemo, useCallback, useEffect, useState } from "react";

import { useCollectionsStore } from "@/stores/collectionsStore";
import type {
  DynamicCollection,
  TrendingCollectionsConfig,
  TrendingCollectionsResult,
} from "@/types/collections";

const getStableImage = (poolAddress: string): string => {
  const PLACEHOLDER_IMAGES = [
    "/assets/images/defaultNFT.png",
    "/assets/images/nft1.jpeg",
    "/assets/images/nft2.avif",
    "/assets/images/nft3.jpg",
    "/assets/images/nft4.jpg",
    "/assets/images/nft5.png",
    "/assets/images/nft6.webp",
  ];

  const hash = poolAddress
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const imageIndex = hash % PLACEHOLDER_IMAGES.length;
  return PLACEHOLDER_IMAGES[imageIndex];
};

const fetchMetadataImage = async (uri: string): Promise<string | null> => {
  try {
    // Validate URI format
    if (!uri || uri === "google.com" || uri.length < 10) {
      console.warn("❌ Invalid URI:", uri);
      return null;
    }

    // Ensure it's a proper URL
    const validUrl = uri;
    if (!uri.startsWith("http://") && !uri.startsWith("https://")) {
      console.warn("❌ URI missing protocol:", uri);
      return null;
    }

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(validUrl, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`❌ HTTP ${response.status} for ${validUrl}`);
      return null;
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.warn("❌ Non-JSON response:", contentType);
      return null;
    }

    const metadata = await response.json();

    return metadata.image || null;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        console.warn("⏱️ Fetch timeout for:", uri);
      } else {
        console.warn("❌ Failed to fetch metadata:", error.message);
      }
    } else {
      console.warn("❌ Unexpected error:", error);
    }
    return null;
  }
};

export function useTrendingCollections(
  config: TrendingCollectionsConfig = {}
): TrendingCollectionsResult {
  const {
    maxCollections = 8,
    enablePricing = true,
    sortBy = "trending",
  } = config;

  const [loadedImages, setLoadedImages] = useState<Map<string, string>>(
    new Map()
  );

  // Get data from shared store
  const {
    getTrendingCollections,
    connectionState,
    lastUpdate,
    isLoading,
    collections: allCollections,
    pools: allPools,
    poolMetrics,
    error: storeError,
  } = useCollectionsStore();

  const trendingData = useMemo(() => {
    const trending = getTrendingCollections(maxCollections);
    return trending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    getTrendingCollections,
    maxCollections,
    allPools.length,
    allCollections.length,
    poolMetrics.size,
  ]);

  // Fetch images for collections that have valid URIs
  useEffect(() => {
    const fetchImages = async () => {
      const imagesToFetch = new Map<string, string>();

      // Collect all URIs that need to be fetched
      trendingData.forEach((item) => {
        const collection = item.collection;
        if (
          collection?.uri &&
          !loadedImages.has(collection.uri) &&
          collection.uri !== "google.com" &&
          collection.uri.startsWith("http")
        ) {
          imagesToFetch.set(collection.uri, collection.collectionMint);
        }
      });

      if (imagesToFetch.size === 0) {
        return;
      }

      const imagePromises = Array.from(imagesToFetch.entries()).map(
        async ([uri, collectionMint]) => {
          const image = await fetchMetadataImage(uri);
          return { uri, collectionMint, image };
        }
      );

      const results = await Promise.allSettled(imagePromises);

      const newImages = new Map(loadedImages);

      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value.image) {
          newImages.set(result.value.uri, result.value.image);
        }
      });

      if (newImages.size > loadedImages.size) {
        setLoadedImages(newImages);
      }
    };

    const timeoutId = setTimeout(fetchImages, 500);
    return () => clearTimeout(timeoutId);
  }, [trendingData, loadedImages]);

  // Convert to DynamicCollection format with loaded images
  const processedCollections = useMemo(() => {
    return trendingData
      .sort((a, b) => {
        switch (sortBy) {
          case "top":
            // Sort by base price (highest first)
            const basePriceA = parseFloat(a.pool.basePrice || "0") / 1e9; // Convert lamports to SOL
            const basePriceB = parseFloat(b.pool.basePrice || "0") / 1e9;
            return basePriceB - basePriceA;
          default: // "trending"
            return b.trendingScore - a.trendingScore;
        }
      })
      .slice(0, maxCollections)
      .map((item, index): DynamicCollection => {
        const { pool, collection, metrics } = item;

        // Get image from loaded metadata or use placeholder
        let image = getStableImage(pool.poolAddress);

        if (collection?.uri && loadedImages.has(collection.uri)) {
          image = loadedImages.get(collection.uri)!;
        } else if (collection?.image) {
          image = collection.image;
        }

        return {
          id: pool.poolAddress,
          rank: index + 1,
          name:
            collection?.collectionName ||
            pool.collectionName ||
            `Collection ${pool.collectionMint.slice(0, 6)}...`,
          image,
          verified: true,
          nftCount: metrics.transactions24h,
          totalVolume: metrics.volume24h,
          poolAddress: pool.poolAddress,
          metrics,
          trendingScore: item.trendingScore,
        };
      });
  }, [trendingData, sortBy, maxCollections, loadedImages]);

  // Create render function for pool prices with trending indicators
  const renderPoolPrice = useCallback(
    (collection: DynamicCollection): React.ReactNode => {
      const trendingItem = trendingData.find(
        (item) =>
          item.pool.poolAddress === (collection.poolAddress || collection.id)
      );

      if (!trendingItem) {
        return React.createElement(
          "div",
          { className: "price" },
          React.createElement(
            "div",
            { className: "priceText" },
            `${collection.totalVolume.toFixed(4)} SOL`
          )
        );
      }

      const { metrics, pool } = trendingItem;
      const priceChangeClass =
        metrics.priceChange24h >= 0 ? "text-green-500" : "text-red-500";

      // Check if we have actual volume/price data
      if (enablePricing && metrics.lastPrice > 0) {
        // Show current price with 24h change
        return React.createElement(
          "div",
          { className: "text-right" },
          React.createElement(
            "div",
            { className: priceChangeClass },
            `${metrics.lastPrice.toFixed(4)} SOL`
          ),
          React.createElement(
            "div",
            { className: `text-xs ${priceChangeClass}` },
            `${
              metrics.priceChange24h >= 0 ? "+" : ""
            }${metrics.priceChange24h.toFixed(1)}%`
          )
        );
      } else if (pool.basePrice && parseFloat(pool.basePrice) > 0) {
        // Show base price from pool creation (highlighted when sorting by top)
        const basePriceSOL = parseFloat(pool.basePrice) / 1e9; // Convert lamports to SOL
        const isTopSort = sortBy === "top";
        const priceClass = isTopSort
          ? "text-blue-600 font-semibold"
          : "text-blue-500";
        return React.createElement(
          "div",
          { className: "text-right" },
          React.createElement(
            "div",
            { className: priceClass },
            `${basePriceSOL.toFixed(4)} SOL`
          ),
          React.createElement(
            "div",
            { className: "text-xs text-gray-500" },
            isTopSort ? "Base Price" : "Base Price"
          )
        );
      } else if (metrics.transactions24h > 0) {
        // Show volume with transaction count
        return React.createElement(
          "div",
          { className: "text-right" },
          React.createElement(
            "div",
            { className: "text-purple-500" },
            `${metrics.volume24h.toFixed(4)} SOL`
          ),
          React.createElement(
            "div",
            { className: "text-xs text-gray-500" },
            `${metrics.transactions24h} txns`
          )
        );
      } else {
        // No data available
        return React.createElement(
          "div",
          { className: "text-right" },
          React.createElement("div", { className: "text-gray-400" }, "No Data"),
          React.createElement(
            "div",
            { className: "text-xs text-gray-400" },
            "0 txns"
          )
        );
      }
    },
    [enablePricing, trendingData, sortBy]
  );

  // Split collections for desktop layout
  const { leftCollections, rightCollections } = useMemo(
    () => ({
      leftCollections: processedCollections.slice(0, 4),
      rightCollections: processedCollections.slice(4, 8),
    }),
    [processedCollections]
  );

  // Manual refresh function
  const refetch = useCallback(() => {
    return Promise.resolve();
  }, []);

  // Error handling
  const error = useMemo(() => {
    if (storeError) return storeError;
    if (connectionState === "error")
      return "Connection error - using cached data";
    return null;
  }, [storeError, connectionState]);

  // Loading state (only show loading if we have no data at all)
  const isLoadingState = useMemo(() => {
    return isLoading && processedCollections.length === 0;
  }, [isLoading, processedCollections.length]);

  return {
    collections: processedCollections,
    leftCollections,
    rightCollections,
    isLoading: isLoadingState,
    isLoadingPrices: false,
    error,
    refetch,
    renderPoolPrice,
    connectionState,
    lastUpdate,
    stats: {
      totalCollections: processedCollections.length,
      connectionStatus: connectionState,
      lastUpdate,
      hasMetrics: trendingData.some((item) => item.metrics.volume24h > 0),
      totalVolume: trendingData.reduce(
        (sum, item) => sum + item.metrics.volume24h,
        0
      ),
      totalTransactions: trendingData.reduce(
        (sum, item) => sum + item.metrics.transactions24h,
        0
      ),
    },
  };
}

// Export helper functions for testing
export { getStableImage };
