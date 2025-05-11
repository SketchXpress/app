"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAnchorContext } from "@/contexts/AnchorContextProvider";
import { useTransactionHistory } from "@/hooks/queries/useTransactionHistory";
import { usePoolPrices } from "@/hooks/queries/usePoolPrices";
import { processTrendingCollections } from "@/utils/processTrendingCollections"; // Assuming this utility is optimized or backend processing is considered
import { DynamicCollection } from "@/types/collections";
import styles from "./TrendingCollections.module.scss";
import {
  DesktopCollectionTable,
  EmptyState,
  Header,
  MobileCollectionTable,
  SkeletonLoader,
} from "./Utility"; // Assuming these are optimized/memoized if necessary

// Array of placeholder images. Ensure these paths are correct and images exist in /public
const PLACEHOLDER_NFT_IMAGES = [
  "/assets/images/nft1.jpeg",
  "/assets/images/nft2.avif",
  "/assets/images/nft3.jpg",
  "/assets/images/nft4.jpg",
  "/assets/images/nft5.png",
  "/assets/images/nft6.webp",
];

/**
 * @typedef {object} ProcessedPoolData
 * @property {string} poolAddress - The address of the pool.
 * @property {string} name - The name of the pool.
 * @property {number} nftCount - The number of NFTs in the pool.
 * @property {number} totalVolume - The total volume of the pool.
 * @property {number} timestamp - The timestamp of the last activity or creation.
 */

/**
 * TrendingCollections component displays a list of trending and top volume NFT collections.
 * It fetches transaction history, processes it to identify collections, and then fetches their prices.
 * Handles loading, error, and empty states, and allows switching between "trending" and "top volume" views.
 *
 * @component
 * @returns {React.ReactElement} The rendered trending collections section.
 */
const TrendingCollections: React.FC = () => {
  const router = useRouter();
  const { program } = useAnchorContext();

  const [activeTab, setActiveTab] = useState<"trending" | "top">("trending");
  const [error, setError] = useState<string | null>(null);
  const [processedCollections, setProcessedCollections] = useState<DynamicCollection[]>([]);
  const [poolAddressesForPricing, setPoolAddressesForPricing] = useState<string[]>([]);

  // Fetch transaction history - consider if 50 is the optimal limit or if pagination is needed for the source hook.
  // Recommendation: The core logic of `processTrendingCollections` should ideally be on the backend for performance.
  const {
    data: history,
    isLoading: historyLoading,
    error: historyError
  } = useTransactionHistory(50);

  // Fetch pool prices based on derived pool addresses
  const {
    data: prices,
    isLoading: pricesLoading,
    error: pricesError
  } = usePoolPrices(poolAddressesForPricing);

  const isProgramInitialized = !!program;

  // Memoized function to get a random NFT image
  const getRandomNftImage = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * PLACEHOLDER_NFT_IMAGES.length);
    return PLACEHOLDER_NFT_IMAGES[randomIndex];
  }, []);

  // Effect to process history and derive collections
  useEffect(() => {
    if (historyLoading) return;

    if (historyError) {
      setError(historyError instanceof Error ? historyError.message : "Failed to load transaction history.");
      setProcessedCollections([]);
      return;
    }

    if (!history || history.length === 0) {
      setProcessedCollections([]);
      setError(null); // Clear previous errors if any
      return;
    }

    try {
      // Recommendation: `processTrendingCollections` should be highly optimized if it remains client-side.
      // Ideally, this processing happens on a backend and returns pre-sorted/filtered data.
      const poolData = processTrendingCollections(history);

      const sortedPools = [...poolData];
      if (activeTab === "trending") {
        sortedPools.sort((a, b) => b.timestamp - a.timestamp); // Sort by most recent
      } else { // activeTab === "top"
        sortedPools.sort((a, b) => b.totalVolume - a.totalVolume); // Sort by highest volume
      }

      const topPools = sortedPools.slice(0, 8);

      const formattedCollections: DynamicCollection[] = topPools.map((pool, index) => ({
        id: pool.poolAddress,
        rank: index + 1,
        name: pool.name || `Collection ${pool.poolAddress.slice(0, 6)}...`,
        image: getRandomNftImage(), // Placeholder image logic
        verified: true, // Assuming verification logic exists or is static
        nftCount: pool.nftCount,
        totalVolume: pool.totalVolume,
        // poolAddress is part of pool object, ensure it is passed if needed by DynamicCollection type
      }));

      setProcessedCollections(formattedCollections);
      setPoolAddressesForPricing(formattedCollections.map(c => c.id));
      setError(null); // Clear previous errors
    } catch (err) {
      console.error("Error processing collections:", err);
      setError(err instanceof Error ? err.message : "An error occurred while processing collections.");
      setProcessedCollections([]);
    }
  }, [history, historyLoading, historyError, activeTab, getRandomNftImage]);

  // Effect to handle price loading errors
  useEffect(() => {
    if (pricesError) {
      console.error("Error fetching pool prices:", pricesError);
      // Decide how to handle price errors, e.g., show a message or fallback display for prices
      // For now, it will just log, and renderPoolPrice will fallback to volume.
    }
  }, [pricesError]);

  const handleTabChange = useCallback((tab: string) => {
    if (tab !== "trending" && tab !== "top") return;
    if (tab === activeTab) return;
    setActiveTab(tab);
    // Data will re-process due to `activeTab` dependency in the main useEffect
  }, [activeTab]);

  const handleCollectionClick = useCallback((poolAddress: string) => {
    router.push(`/mintstreet/collection/${poolAddress}`);
  }, [router]);

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    target.src = "/assets/images/defaultNFT.png"; // Ensure this fallback image exists in /public
    target.onerror = null; // Prevent infinite loop
  }, []);

  const renderPoolPrice = useCallback((collection: DynamicCollection): React.ReactNode => {
    if (isProgramInitialized && !pricesLoading && prices && typeof prices === "object" && collection.id in prices) {
      const price = prices[collection.id];
      if (typeof price === "number") {
        return <div className={styles.priceCell}>{price.toFixed(4)} SOL</div>;
      }
    }
    // Fallback to showing total volume if price isn't available or still loading
    return <div className={styles.priceCell}>{collection.totalVolume.toFixed(4)} SOL</div>;
  }, [isProgramInitialized, pricesLoading, prices]);

  const { leftCollections, rightCollections } = useMemo(() => ({
    leftCollections: processedCollections.slice(0, 4),
    rightCollections: processedCollections.slice(4, 8),
  }), [processedCollections]);

  const isLoading = historyLoading || (poolAddressesForPricing.length > 0 && pricesLoading);

  if (error && !isLoading && processedCollections.length === 0) {
    return (
      <section className={styles.trendingSection} aria-labelledby="trending-collections-heading">
        <div className={styles.container}>
          <Header activeTab={activeTab} onTabChange={handleTabChange} />
          <div className={styles.errorContainer}>
            <p role="alert">Error loading collections: {error}</p>
            <button className={styles.retryButton} onClick={() => window.location.reload()}>
              Retry Page
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.trendingSection} aria-labelledby="trending-collections-heading">
      <h2 id="trending-collections-heading" className="sr-only">Trending NFT Collections</h2>
      <div className={styles.container}>
        <Header activeTab={activeTab} onTabChange={handleTabChange} />

        {isLoading ? (
          <SkeletonLoader />
        ) : processedCollections.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <DesktopCollectionTable
              leftCollections={leftCollections}
              rightCollections={rightCollections}
              onCollectionClick={handleCollectionClick}
              renderPoolPrice={renderPoolPrice}
              handleImageError={handleImageError}
            // Consider passing a unique key prefix if items can be unstable
            />
            <MobileCollectionTable
              collections={processedCollections}
              onCollectionClick={handleCollectionClick}
              renderPoolPrice={renderPoolPrice}
              handleImageError={handleImageError}
            // Consider passing a unique key prefix
            />
          </>
        )}
      </div>
    </section>
  );
};

export default React.memo(TrendingCollections);

