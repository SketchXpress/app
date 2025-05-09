"use client";

import { useRouter } from "next/navigation";
import styles from "./TrendingCollections.module.scss";
import { DynamicCollection } from "@/types/collections";
import { usePoolPrices } from '@/hooks/queries/usePoolPrices';
import { useAnchorContext } from "@/contexts/AnchorContextProvider";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTransactionHistory } from '@/hooks/queries/useTransactionHistory';
import { processTrendingCollections } from '@/utils/processTrendingCollections';
import { DesktopCollectionTable, EmptyState, Header, MobileCollectionTable, SkeletonLoader } from "./Utility";

// Main Component
const TrendingCollections: React.FC = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("trending");
  const [error, setError] = useState<string | null>(null);
  const [dataProcessed, setDataProcessed] = useState(false);
  const [poolAddresses, setPoolAddresses] = useState<string[]>([]);
  const [collections, setCollections] = useState<DynamicCollection[]>([]);

  // Get wallet and Anchor context
  const { program } = useAnchorContext();


  const { data: history, isLoading: historyLoading, error: historyError } = useTransactionHistory(50);
  const { data: prices, isLoading: pricesLoading } = usePoolPrices(poolAddresses);

  // Checking wallet and program state
  const isProgramInitialized = !!program;

  // Get a random NFT image from the available images
  const getRandomNftImage = useCallback(() => {
    const nftImages = [
      "/nft1.jpeg",
      "/nft2.avif",
      "/nft3.jpg",
      "/nft4.jpg",
      "/nft5.png",
      "/nft6.webp",
    ];

    // Select a random image from the array
    const randomIndex = Math.floor(Math.random() * nftImages.length);
    return nftImages[randomIndex];
  }, []);

  // Update loading state when history loading changes
  useEffect(() => {
    if (historyLoading) {
      setIsLoading(true);
    }
  }, [historyLoading]);

  // Process history data when it's available
  useEffect(() => {
    if (historyLoading) {
      return;
    }

    try {
      if (historyError) {
        setError(historyError instanceof Error ? historyError.message : 'An unknown error occurred');
        setIsLoading(false);
        return;
      }

      // Set collections to empty array if no history
      if (!history || history.length === 0) {
        setCollections([]);
        setIsLoading(false);
        setDataProcessed(true);
        return;
      }

      // Process collections from history
      const poolData = processTrendingCollections(history);

      // Sort based on active tab
      let sortedPools = [...poolData];
      if (activeTab === "trending") {
        sortedPools.sort((a, b) => b.timestamp - a.timestamp);
      } else {
        sortedPools.sort((a, b) => b.totalVolume - a.totalVolume);
      }

      // Take top 8
      sortedPools = sortedPools.slice(0, 8);

      const formattedCollections: DynamicCollection[] = sortedPools.map(
        (pool, index) => ({
          id: pool.poolAddress,
          rank: index + 1,
          name: pool.name,
          image: getRandomNftImage(),
          verified: true,
          nftCount: pool.nftCount,
          totalVolume: pool.totalVolume,
        })
      );

      setPoolAddresses(formattedCollections.map((collection) => collection.id));
      setCollections(formattedCollections);
      setIsLoading(false);
      setDataProcessed(true);
    } catch (err) {
      console.error("Error processing collections:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
      setIsLoading(false);
      setDataProcessed(true);
    }
  }, [history, historyLoading, historyError, activeTab, getRandomNftImage]);

  // Handle tab change
  const handleTabChange = useCallback(
    (tab: string) => {
      // If clicking the same tab, don't trigger loading state
      if (tab === activeTab) {
        return;
      }
      setActiveTab(tab);
      // When changing tabs, show skeleton loader while data is being sorted
      setIsLoading(true);
      setDataProcessed(false);
    },
    [activeTab]
  );

  // Handle collection click - Navigate to collection page
  const handleCollectionClick = useCallback(
    (poolAddress: string) => {
      router.push(`/mintstreet/collection/${poolAddress}`);
    },
    [router]
  );

  // Handle image error
  const handleImageError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      const target = e.target as HTMLImageElement;
      target.src = "/defaultNFT.png";
    },
    []
  );

  const renderPoolPrice = useCallback(
    (collection: DynamicCollection) => {
      // If program is initialized and prices are loaded, use the price
      if (
        isProgramInitialized &&
        !pricesLoading &&
        prices &&
        typeof prices === 'object' &&
        collection.id in prices
      ) {
        const price = prices[collection.id];
        if (typeof price === 'number') {
          return (
            <div className={styles.priceCell}>
              {price.toFixed(4)} SOL
            </div>
          );
        }
      }

      // Fallback to showing total volume
      return (
        <div className={styles.priceCell}>
          {collection.totalVolume.toFixed(4)} SOL
        </div>
      );
    },
    [isProgramInitialized, pricesLoading, prices]
  );

  // Split collections for two columns - memoized to prevent unnecessary recalculations
  const { leftCollections, rightCollections } = useMemo(() => {
    return {
      leftCollections: collections.slice(0, 4),
      rightCollections: collections.slice(4, 8),
    };
  }, [collections]);

  // Render error state
  if (error) {
    return (
      <section className={styles.trendingSection}>
        <div className={styles.container}>
          <Header activeTab={activeTab} onTabChange={handleTabChange} />
          <div className={styles.errorContainer}>
            <p>Error loading collections: {error}</p>
            <button
              className={styles.retryButton}
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.trendingSection}>
      <div className={styles.container}>
        <Header activeTab={activeTab} onTabChange={handleTabChange} />

        {isLoading || historyLoading || !dataProcessed ? (
          <SkeletonLoader />
        ) : collections.length === 0 ? (
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
              collections={collections}
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

export default TrendingCollections;
