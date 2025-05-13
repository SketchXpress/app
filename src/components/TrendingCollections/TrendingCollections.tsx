// TrendingCollections.tsx with improved error handling
"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTrendingCollections } from "@/hook/collections/useTrendingCollections";
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
  const [activeTab, setActiveTab] = useState<"trending" | "top">("trending");
  const [rateLimitError, setRateLimitError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Use the trending collections hook with rate limiting
  const {
    collections,
    leftCollections,
    rightCollections,
    isLoading,
    error,
    refetch,
    renderPoolPrice,
  } = useTrendingCollections({
    maxCollections: 8,
    enablePricing: true,
    sortBy: activeTab,
    refreshInterval: 120 * 1000, // Increase to 2 minutes to reduce rate limiting
  });

  // Monitor errors for rate limiting
  useEffect(() => {
    if (error && error.includes("429")) {
      setRateLimitError(true);
      // Auto-retry after delay if rate limited
      const retryDelay = Math.min(5000 * Math.pow(2, retryCount), 30000);
      setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        refetch();
      }, retryDelay);
    } else {
      setRateLimitError(false);
      setRetryCount(0);
    }
  }, [error, retryCount, refetch]);

  // Handle tab changes with debouncing
  const handleTabChange = useCallback(
    (tab: string) => {
      if (tab !== "trending" && tab !== "top") return;
      if (tab === activeTab) return;
      setActiveTab(tab);
    },
    [activeTab]
  );

  // Handle collection clicks
  const handleCollectionClick = useCallback(
    (poolAddress: string) => {
      router.push(`/mintstreet/collection/${poolAddress}`);
    },
    [router]
  );

  // Handle image errors with better fallback
  const handleImageError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      const target = e.target as HTMLImageElement;
      const currentSrc = target.src;

      // Prevent infinite loop
      if (currentSrc.includes("defaultNFT.png")) return;

      target.src = "/assets/images/defaultNFT.png";
      target.onerror = null;
    },
    []
  );

  // Handle manual retry
  const handleRetry = useCallback(() => {
    setRateLimitError(false);
    setRetryCount(0);
    refetch();
  }, [refetch]);

  // Rate limit specific error
  if (rateLimitError) {
    return (
      <section
        className={styles.trendingSection}
        aria-labelledby="trending-collections-heading"
      >
        <div className={styles.container}>
          <Header activeTab={activeTab} onTabChange={handleTabChange} />
          <div className={styles.errorContainer}>
            <p role="alert">
              Service temporarily busy. Retrying automatically...
              {retryCount > 0 && ` (Attempt ${retryCount})`}
            </p>
            <button className={styles.retryButton} onClick={handleRetry}>
              Retry Now
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Other errors with retry option
  if (error && !isLoading && collections.length === 0) {
    return (
      <section
        className={styles.trendingSection}
        aria-labelledby="trending-collections-heading"
      >
        <div className={styles.container}>
          <Header activeTab={activeTab} onTabChange={handleTabChange} />
          <div className={styles.errorContainer}>
            <p role="alert">
              {error.includes("CORS")
                ? "Unable to load collection metadata due to network restrictions"
                : `Error loading collections: ${error}`}
            </p>
            <button className={styles.retryButton} onClick={handleRetry}>
              Retry
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={styles.trendingSection}
      aria-labelledby="trending-collections-heading"
    >
      <h2 id="trending-collections-heading" className="sr-only">
        Trending NFT Collections
      </h2>
      <div className={styles.container}>
        <Header activeTab={activeTab} onTabChange={handleTabChange} />

        {isLoading ? (
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

export default React.memo(TrendingCollections);
