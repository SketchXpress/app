import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useCollectionsStore } from "@/stores/collectionsStore";
import type { DynamicCollection } from "@/types/collections";

// Cache interface - updated to store all data
interface CachedTrendingData {
  allCollections: DynamicCollection[]; // Store all collections
  displayCollections: DynamicCollection[]; // Store current display (8 for UI)
  lastUpdate: number;
  lastStoreUpdate: number;
  version: number;
  currentSortBy: string; // Remember which sort was cached
}

// Hook configuration interface
interface UseTrendingCollectionsConfig {
  maxCollections?: number;
  sortBy?: "trending" | "top";
  enablePricing?: boolean;
  refreshInterval?: number;
}

// Hook return type
interface TrendingCollectionsResult {
  collections: DynamicCollection[];
  leftCollections: DynamicCollection[];
  rightCollections: DynamicCollection[];
  isLoading: boolean;
  isRefreshing: boolean;
  isStale: boolean;
  error: string | null;
  lastUpdate: number;
  refresh: () => Promise<void>;
  renderPoolPrice: (collection: DynamicCollection) => React.ReactNode;
  connectionState: string;
  stats: {
    totalCollections: number;
    totalCachedCollections: number;
    isCacheHit: boolean;
    lastRefresh: number;
    transactionsProcessed: number;
  };
}

// Configuration
const CACHE_KEY = "trending_collections_cache";
const CACHE_VERSION = 1;
const DEFAULT_REFRESH_INTERVAL = 10000; // 10 seconds
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes max age

export function useTrendingCollections(
  config: UseTrendingCollectionsConfig = {}
): TrendingCollectionsResult {
  const {
    maxCollections = 8,
    sortBy = "trending",
    enablePricing = true,
    refreshInterval = DEFAULT_REFRESH_INTERVAL,
  } = config;

  // State
  const [cachedData, setCachedData] = useState<CachedTrendingData | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [loadedImages, setLoadedImages] = useState<Map<string, string>>(
    new Map()
  );

  // Refs for optimization
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);
  const lastProcessedStoreUpdateRef = useRef<number>(0);
  const imageLoadingRef = useRef(false);

  // Get data from the store (this is already populated by useRealTimeCollections)
  const collections = useCollectionsStore((state) => state.collections);
  const pools = useCollectionsStore((state) => state.pools);
  const connectionState = useCollectionsStore((state) => state.connectionState);
  const lastUpdate = useCollectionsStore((state) => state.lastUpdate);
  const isLoading = useCollectionsStore((state) => state.isLoading);
  const storeError = useCollectionsStore((state) => state.error);
  const getTrendingCollections = useCollectionsStore(
    (state) => state.getTrendingCollections
  );

  // Load cached data on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed: CachedTrendingData = JSON.parse(cached);

        // Check cache validity
        const isValid =
          parsed.version === CACHE_VERSION &&
          Date.now() - parsed.lastUpdate < CACHE_TTL;

        if (isValid) {
          setCachedData(parsed);
          console.log(
            "📦 Loaded cached trending data:",
            parsed.allCollections?.length || 0,
            "total collections,",
            parsed.displayCollections?.length || 0,
            "displayed"
          );
        } else {
          localStorage.removeItem(CACHE_KEY);
          console.log("🗑️ Cleared stale cache");
        }
      }
    } catch (error) {
      console.error("❌ Error loading cache:", error);
      localStorage.removeItem(CACHE_KEY);
    }
  }, []);

  // Helper function for fetching metadata images
  const fetchMetadataImage = useCallback(
    async (uri: string): Promise<string | null> => {
      try {
        if (!uri || uri === "google.com" || uri.length < 10) {
          return null;
        }

        if (!uri.startsWith("http://") && !uri.startsWith("https://")) {
          return null;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(uri, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          return null;
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          return null;
        }

        const metadata = await response.json();
        return metadata.image || null;
      } catch {
        return null;
      }
    },
    []
  );
  // Helper function for stable image
  const getStableImage = useCallback((poolAddress: string): string => {
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
    return PLACEHOLDER_IMAGES[hash % PLACEHOLDER_IMAGES.length];
  }, []);

  // Process store data into trending collections using the existing store logic
  const processStoreDataToTrending =
    useCallback((): CachedTrendingData | null => {
      try {
        // Get ALL trending data, not limited
        const trendingData = getTrendingCollections(100); // Get up to 100 collections

        if (trendingData.length === 0) {
          return null;
        }

        // Convert ALL to DynamicCollection format
        const allProcessedCollections: DynamicCollection[] = trendingData.map(
          (item) => {
            const { pool, collection, metrics } = item;

            // Get image from collection or use stable fallback, with fetched images
            let image = getStableImage(pool.poolAddress);
            if (collection?.image) {
              image = collection.image;
            } else if (collection?.uri && loadedImages.has(collection.uri)) {
              image = loadedImages.get(collection.uri)!;
            } else if (
              collection?.uri &&
              collection.uri !== "google.com" &&
              collection.uri.startsWith("http")
            ) {
              // Keep stable image for now, will be updated when fetched
              image = getStableImage(pool.poolAddress);
            }

            return {
              id: pool.poolAddress,
              rank: 0, // Will be set after sorting
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
              trendingScore: item.trendingScore || 0,
            };
          }
        );

        // Apply sorting to ALL collections based on sortBy parameter
        let allSortedCollections: DynamicCollection[];

        if (sortBy === "top") {
          // Sort ALL by base price for "top" - highest base price first
          allSortedCollections = [...allProcessedCollections].sort((a, b) => {
            const poolA = pools.find((p) => p.poolAddress === a.poolAddress);
            const poolB = pools.find((p) => p.poolAddress === b.poolAddress);

            // Convert base price from lamports to SOL for comparison
            const priceA = poolA?.basePrice
              ? parseFloat(poolA.basePrice) / 1e9
              : 0;
            const priceB = poolB?.basePrice
              ? parseFloat(poolB.basePrice) / 1e9
              : 0;

            // Sort highest to lowest (descending)
            return priceB - priceA;
          });
        } else {
          // Trending sort (by trending score) - your original logic
          allSortedCollections = [...allProcessedCollections].sort(
            (a, b) => (b.trendingScore || 0) - (a.trendingScore || 0)
          );
        }

        // Assign ranks to ALL collections
        const allFinalCollections = allSortedCollections.map((col, index) => ({
          ...col,
          rank: index + 1,
        }));

        // Get display collections (limited to maxCollections for UI)
        const displayCollections = allFinalCollections.slice(0, maxCollections);

        return {
          allCollections: allFinalCollections, // Store ALL collections
          displayCollections, // Store limited for display
          lastUpdate: Date.now(),
          lastStoreUpdate: lastUpdate,
          currentSortBy: sortBy,
          version: CACHE_VERSION,
        };
      } catch (error) {
        console.error("❌ Error processing store data:", error);
        return null;
      }
    }, [
      getTrendingCollections,
      maxCollections,
      sortBy,
      lastUpdate,
      getStableImage,
      pools,
      loadedImages,
    ]);

  // Image fetching effect
  useEffect(() => {
    if (imageLoadingRef.current || !cachedData?.allCollections.length) return;

    const fetchImages = async () => {
      imageLoadingRef.current = true;

      try {
        const imagesToFetch = new Map<string, string>();

        // Collect URIs that need fetching from the current trending data
        const trendingData = getTrendingCollections(maxCollections);
        trendingData.forEach((item) => {
          const collection = item.collection;
          if (
            collection?.uri &&
            !loadedImages.has(collection.uri) &&
            collection.uri !== "google.com" &&
            collection.uri.startsWith("http")
          ) {
            imagesToFetch.set(collection.uri, item.pool.poolAddress);
          }
        });

        if (imagesToFetch.size === 0) {
          imageLoadingRef.current = false;
          return;
        }

        // Batch fetch with limited concurrency
        const BATCH_SIZE = 3;
        const entries = Array.from(imagesToFetch.entries());
        const newImages = new Map(loadedImages);

        for (let i = 0; i < entries.length; i += BATCH_SIZE) {
          const batch = entries.slice(i, i + BATCH_SIZE);

          const promises = batch.map(async ([uri, poolAddress]) => {
            try {
              const image = await fetchMetadataImage(uri);
              return { uri, poolAddress, image };
            } catch {
              return { uri, poolAddress, image: null };
            }
          });

          const results = await Promise.allSettled(promises);

          results.forEach((result) => {
            if (result.status === "fulfilled" && result.value.image) {
              newImages.set(result.value.uri, result.value.image);
            }
          });

          // Small delay between batches
          if (i + BATCH_SIZE < entries.length) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        if (newImages.size > loadedImages.size) {
          setLoadedImages(newImages);
        }
      } catch (error) {
        console.error("Error fetching images:", error);
      } finally {
        imageLoadingRef.current = false;
      }
    };

    const timeoutId = setTimeout(fetchImages, 300);
    return () => clearTimeout(timeoutId);
  }, [
    cachedData?.allCollections,
    loadedImages,
    getTrendingCollections,
    maxCollections,
    fetchMetadataImage,
  ]);

  // Check for new data and update cache
  const refreshTrendingData = useCallback(async () => {
    if (isRefreshingRef.current) return;

    isRefreshingRef.current = true;
    setIsStale(false);

    try {
      // Check if store has been updated since our last processing OR sort changed
      const hasNewStoreData =
        lastUpdate !== lastProcessedStoreUpdateRef.current;
      const hasSortChanged = cachedData?.currentSortBy !== sortBy;

      if (hasNewStoreData || !cachedData || hasSortChanged) {
        const newTrendingData = processStoreDataToTrending();

        if (newTrendingData && newTrendingData.allCollections.length > 0) {
          setCachedData(newTrendingData);
          lastProcessedStoreUpdateRef.current = lastUpdate;

          // Save to localStorage
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(newTrendingData));
            console.log(
              "💾 Cached all trending data:",
              newTrendingData.allCollections.length,
              "total collections"
            );
          } catch (error) {
            console.warn("⚠️ Failed to cache data:", error);
          }
        }
      }

      setLastRefresh(Date.now());
    } catch (error) {
      console.error("❌ Error refreshing trending data:", error);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [lastUpdate, cachedData, processStoreDataToTrending, sortBy]);

  // Auto-refresh effect
  useEffect(() => {
    // Initial processing when store data is available
    if (
      (collections.length > 0 || pools.length > 0) &&
      (!cachedData || lastProcessedStoreUpdateRef.current !== lastUpdate)
    ) {
      refreshTrendingData();
    }

    // Set up interval for checking new data
    if (refreshInterval > 0) {
      refreshTimerRef.current = setInterval(() => {
        const timeSinceLastRefresh = Date.now() - lastRefresh;
        if (timeSinceLastRefresh >= refreshInterval) {
          setIsStale(true);
          refreshTrendingData();
        }
      }, refreshInterval);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [
    collections.length,
    pools.length,
    lastUpdate,
    cachedData,
    lastRefresh,
    refreshInterval,
    refreshTrendingData,
  ]);

  // Refresh when sortBy changes (for tab switching)
  const refreshOnSortChange = useCallback(() => {
    if (cachedData) {
      refreshTrendingData();
    }
  }, [cachedData, refreshTrendingData]);

  useEffect(() => {
    refreshOnSortChange();
  }, [sortBy, refreshOnSortChange]);

  // Split collections for desktop layout
  const { leftCollections, rightCollections } = useMemo(() => {
    const collections = cachedData?.displayCollections || [];
    return {
      leftCollections: collections.slice(0, 4),
      rightCollections: collections.slice(4, 8),
    };
  }, [cachedData?.displayCollections]);

  // Price rendering function - your original logic
  const renderPoolPrice = useCallback(
    (collection: DynamicCollection): React.ReactNode => {
      const metrics = collection.metrics;

      if (!metrics) {
        return React.createElement(
          "div",
          { className: "text-right" },
          React.createElement("div", { className: "text-gray-400" }, "No Data")
        );
      }

      try {
        // Your original price rendering logic
        if (enablePricing && metrics.lastPrice > 0) {
          const priceChangeClass =
            metrics.priceChange24h >= 0 ? "text-green-500" : "text-red-500";
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
        } else {
          // Fallback to base price or volume
          const pool = pools.find(
            (p) => p.poolAddress === collection.poolAddress
          );
          if (pool?.basePrice && parseFloat(pool.basePrice) > 0) {
            const basePriceSOL = parseFloat(pool.basePrice) / 1e9;
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
                { className: "text-xs text-gray-400" },
                "Base Price"
              )
            );
          } else if (metrics.transactions24h > 0) {
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
                { className: "text-xs text-gray-400" },
                `${metrics.transactions24h} txns`
              )
            );
          } else {
            return React.createElement(
              "div",
              { className: "text-right" },
              React.createElement(
                "div",
                { className: "text-gray-400" },
                "No Data"
              ),
              React.createElement(
                "div",
                { className: "text-xs text-gray-400" },
                "0 txns"
              )
            );
          }
        }
      } catch (error) {
        console.error("Error rendering price:", error);
        return React.createElement(
          "div",
          { className: "text-right" },
          React.createElement("div", { className: "text-gray-400" }, "Error")
        );
      }
    },
    [enablePricing, pools, sortBy]
  );

  // Manual refresh function
  const refresh = useCallback(async () => {
    await refreshTrendingData();
  }, [refreshTrendingData]);

  return {
    collections: cachedData?.displayCollections || [],
    leftCollections,
    rightCollections,
    isLoading: isLoading && !cachedData,
    isRefreshing: isRefreshingRef.current,
    isStale,
    error: storeError,
    lastUpdate: cachedData?.lastUpdate || 0,
    refresh,
    renderPoolPrice,
    connectionState,
    stats: {
      totalCollections: cachedData?.displayCollections.length || 0,
      totalCachedCollections: cachedData?.allCollections.length || 0, // New stat
      isCacheHit: !!cachedData,
      lastRefresh,
      transactionsProcessed: collections.length + pools.length, // Approximation
    },
  };
}
