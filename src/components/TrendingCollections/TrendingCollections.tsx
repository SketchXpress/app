"use client";

import { useRouter } from "next/navigation";
import React, { useState, useCallback, useMemo } from "react";
import { useTrendingCollections } from "@/hook/collections/useTrendingCollections";
import {
  DesktopCollectionTable,
  EmptyState,
  Header,
  MobileCollectionTable,
  SkeletonLoader,
} from "./Utility";
import styles from "./TrendingCollections.module.scss";

const TrendingCollections: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"trending" | "top">("trending");
  const [retryCount, setRetryCount] = useState(0);

  // Use optimized hook with same interface as before
  const {
    collections,
    leftCollections,
    rightCollections,
    isLoading,
    error,
    refresh,
    renderPoolPrice,
  } = useTrendingCollections({
    maxCollections: 8,
    sortBy: activeTab,
    enablePricing: true,
  });

  // Memoized handlers
  const handleTabChange = useCallback(
    (tab: string) => {
      if (tab !== "trending" && tab !== "top") return;
      if (tab === activeTab) return;
      setActiveTab(tab as "trending" | "top");
    },
    [activeTab]
  );

  const handleCollectionClick = useCallback(
    (poolAddress: string) => {
      router.push(`/mintstreet/collection/${poolAddress}`);
    },
    [router]
  );

  const handleImageError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      const target = e.target as HTMLImageElement;
      if (target.src.includes("defaultNFT.png")) return;
      target.src = "/assets/images/defaultNFT.png";
      target.onerror = null;
    },
    []
  );

  const handleRetry = useCallback(() => {
    setRetryCount((prev) => prev + 1);
    refresh();
  }, [refresh]);

  // Component state
  const componentState = useMemo(() => {
    const hasData = collections.length > 0;
    const showSkeleton = isLoading && !hasData;
    const showContent = hasData;
    const showEmpty = !isLoading && !hasData && !error;

    return { hasData, showSkeleton, showContent, showEmpty };
  }, [collections.length, isLoading, error]);

  // Removed status indicators - keeping UI clean

  // Error handling
  if (error && !componentState.hasData) {
    return (
      <section className={styles.trendingSection}>
        <div className={styles.container}>
          <Header activeTab={activeTab} onTabChange={handleTabChange} />
          <div className={styles.errorContainer}>
            <p role="alert">
              Error loading collections: {error}
              {retryCount > 0 && ` (Attempt ${retryCount})`}
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
    <section className={styles.trendingSection}>
      <div className={styles.container}>
        <Header activeTab={activeTab} onTabChange={handleTabChange} />

        {/* Main content */}
        {componentState.showSkeleton && <SkeletonLoader />}

        {componentState.showEmpty && <EmptyState />}

        {componentState.showContent && (
          <div className={styles.content}>
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
          </div>
        )}
      </div>
    </section>
  );
};

export default React.memo(TrendingCollections);
