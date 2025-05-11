"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAnchorContext } from "@/contexts/AnchorContextProvider";
import { useTransactionHistory } from "@/hooks/queries/useTransactionHistory";
import { usePoolPrices } from "@/hooks/queries/usePoolPrices";
import { processTrendingCollections } from "@/utils/processTrendingCollections";
import { DynamicCollection } from "@/types/collections";
import styles from "./TrendingCollections.module.scss";
import {
  DesktopCollectionTable,
  EmptyState,
  Header,
  MobileCollectionTable,
  SkeletonLoader,
} from "./Utility";



const TrendingCollections: React.FC = () => {
  const router = useRouter();
  const { program } = useAnchorContext();

  const [activeTab, setActiveTab] = useState<"trending" | "top">("trending");
  const [error, setError] = useState<string | null>(null);
  const [processedCollections, setProcessedCollections] = useState<DynamicCollection[]>([]);
  const [poolAddressesForPricing, setPoolAddressesForPricing] = useState<string[]>([]);

  // Fetch transaction history
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

  // Placeholder NFT images for fallback
  const PLACEHOLDER_NFT_IMAGES = [
    "/assets/images/defaultNFT.png",
    "/assets/images/placeholder1.png",
    "/assets/images/placeholder2.png",
    "/assets/images/placeholder3.png",
  ];

  // Memoized function to get a random NFT image (used as fallback)
  const getRandomNftImage = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * PLACEHOLDER_NFT_IMAGES.length);
    return PLACEHOLDER_NFT_IMAGES[randomIndex];
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setError(null);
      return;
    }

    const processData = async () => {
      try {
        // Process trending collections with metadata fetching (now async)
        const poolData = await processTrendingCollections(history);

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
          name: pool.name,
          // Use the dynamic image from metadata, fallback to placeholder if not available
          image: pool.image || getRandomNftImage(),
          verified: true,
          nftCount: pool.nftCount,
          totalVolume: pool.totalVolume,
        }));

        setProcessedCollections(formattedCollections);
        setPoolAddressesForPricing(formattedCollections.map(c => c.id));
        setError(null);
      } catch (err) {
        console.error("Error processing collections:", err);
        setError(err instanceof Error ? err.message : "An error occurred while processing collections.");
        setProcessedCollections([]);
      }
    };

    // Execute the async processing
    processData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, historyLoading, historyError, activeTab]);

  // Effect to handle price loading errors
  useEffect(() => {
    if (pricesError) {
      console.error("Error fetching pool prices:", pricesError);
    }
  }, [pricesError]);

  const handleTabChange = useCallback((tab: string) => {
    if (tab !== "trending" && tab !== "top") return;
    if (tab === activeTab) return;
    setActiveTab(tab);
  }, [activeTab]);

  const handleCollectionClick = useCallback((poolAddress: string) => {
    router.push(`/mintstreet/collection/${poolAddress}`);
  }, [router]);

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    target.src = "/assets/images/defaultNFT.png";
    target.onerror = null;
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
            />
            <MobileCollectionTable
              collections={processedCollections}
              onCollectionClick={handleCollectionClick}
              renderPoolPrice={renderPoolPrice}
              handleImageError={handleImageError}
            />
          </>
        )}
      </div>
    </section>
  );
};

export default React.memo(TrendingCollections);