"use client";

import React from "react";
import { useParams } from "next/navigation";

import { usePoolNfts, PoolNft } from "@/hook/pools/usePoolNFTs";
import { useOptimizedCollectionData } from "@/hook/collections/useOptimizedCollectionData";

import PoolNFTsGrid from "./PoolNFTsGrid";
import PriceCard from "./components/PriceCard";
import CollectionChart from "./CollectionChart";
import CollectionHeader from "./components/CollectionHeader";
import BondingCurveCard from "./components/BondingCurveCard";
import CollectionDetailsCard from "./components/CollectionDetailsCard";
import {
  LoadingState,
  ErrorState,
  InvalidPoolAddress,
} from "./components/LoadingError";

import styles from "./page.module.scss";

interface NFT {
  mintAddress: string;
  name: string;
  symbol: string;
  uri?: string;
  timestamp: number;
  signature: string;
  price: number;
  image?: string;
  minterAddress?: string;
}

export default function CollectionDetailPage() {
  const params = useParams();

  const poolAddress = Array.isArray(params.poolAddress)
    ? params.poolAddress[0]
    : params.poolAddress || "";

  const {
    poolInfo,
    isLoading: isLoadingPoolInfo,
    error: errorPoolInfo,
    lastMintPrice,
    migrationProgress,
  } = useOptimizedCollectionData(poolAddress);

  const {
    nfts: rawPoolGridNfts,
    isLoading: isLoadingPoolGridNfts,
    error: errorDataPoolGridNfts,
  } = usePoolNfts(poolAddress);

  // Transform PoolNft[] to NFT[] to match PoolNFTsGridProps
  const mappedPoolGridNfts: NFT[] = React.useMemo(() => {
    if (!rawPoolGridNfts) return [];
    return rawPoolGridNfts.map(
      (nft: PoolNft): NFT => ({
        mintAddress: nft.mintAddress,
        name: nft.name || "Unnamed NFT",
        symbol: nft.symbol || "UNSYM",
        uri: nft.uri,
        timestamp: nft.timestamp || 0,
        signature: nft.signature,
        price: nft.price || 0,
        image: undefined,
        minterAddress: nft.minterAddress,
      })
    );
  }, [rawPoolGridNfts]);

  const gridErrorString: string | null = React.useMemo(() => {
    if (!errorDataPoolGridNfts) return null;
    if (errorDataPoolGridNfts instanceof Error) {
      return errorDataPoolGridNfts.message;
    }
    return String(errorDataPoolGridNfts);
  }, [errorDataPoolGridNfts]);

  // Check for invalid pool address
  if (!poolAddress) {
    return <InvalidPoolAddress poolAddress={poolAddress} />;
  }

  // Show error if there's a critical error and no pool info at all
  if (errorPoolInfo && !poolInfo) {
    return (
      <ErrorState
        message={errorPoolInfo || "Could not load pool information."}
      />
    );
  }

  // Render the page with component-level loading states
  return (
    <div className={styles.container}>
      {/* Header Section - Show loading state or content */}
      {isLoadingPoolInfo && !poolInfo ? (
        <div className={styles.headerSkeleton}>
          <div className={styles.skeletonTitle}></div>
          <div className={styles.skeletonSubtitle}></div>
        </div>
      ) : poolInfo ? (
        <CollectionHeader poolInfo={poolInfo} poolAddress={poolAddress} />
      ) : (
        <div className={styles.headerError}>
          <h1>Collection Details Unavailable</h1>
          <p>Pool: {poolAddress}</p>
        </div>
      )}

      <main className={styles.content}>
        <section className={styles.chartSection}>
          {/* Chart - Always show, it handles its own loading */}
          <CollectionChart poolAddress={poolAddress} />

          {/* NFTs Grid - Pass loading and error states to component */}
          <PoolNFTsGrid
            nfts={mappedPoolGridNfts}
            isLoading={isLoadingPoolGridNfts}
            error={gridErrorString}
            poolAddress={poolAddress}
          />
        </section>

        <section className={styles.infoSection}>
          {/* Price Card - Show loading or content */}
          {isLoadingPoolInfo && !poolInfo ? (
            <div className={styles.card}>
              <div className={styles.cardTitle}>Price Information</div>
              <div className={styles.cardContent}>
                <div className={styles.loadingContent}>
                  <LoadingState message="Loading price data..." />
                </div>
              </div>
            </div>
          ) : poolInfo ? (
            <PriceCard
              poolInfo={poolInfo}
              lastMintPrice={lastMintPrice}
              poolAddress={poolAddress}
            />
          ) : (
            <div className={styles.card}>
              <div className={styles.cardTitle}>Price Information</div>
              <div className={styles.cardContent}>
                <div className={styles.errorContent}>
                  <p>Unable to load price information</p>
                </div>
              </div>
            </div>
          )}

          {/* Bonding Curve Card - Show loading or content */}
          {isLoadingPoolInfo && !poolInfo ? (
            <div className={styles.card}>
              <div className={styles.cardTitle}>Bonding Curve</div>
              <div className={styles.cardContent}>
                <div className={styles.loadingContent}>
                  <LoadingState message="Loading bonding curve data..." />
                </div>
              </div>
            </div>
          ) : poolInfo ? (
            <BondingCurveCard
              poolInfo={poolInfo}
              migrationProgress={migrationProgress}
            />
          ) : (
            <div className={styles.card}>
              <div className={styles.cardTitle}>Bonding Curve</div>
              <div className={styles.cardContent}>
                <div className={styles.errorContent}>
                  <p>Unable to load bonding curve data</p>
                </div>
              </div>
            </div>
          )}

          {/* Collection Details Card - Show loading or content */}
          {isLoadingPoolInfo && !poolInfo ? (
            <div className={styles.card}>
              <div className={styles.cardTitle}>Collection Details</div>
              <div className={styles.cardContent}>
                <div className={styles.loadingContent}>
                  <LoadingState message="Loading collection details..." />
                </div>
              </div>
            </div>
          ) : poolInfo ? (
            <CollectionDetailsCard poolInfo={poolInfo} />
          ) : (
            <div className={styles.card}>
              <div className={styles.cardTitle}>Collection Details</div>
              <div className={styles.cardContent}>
                <div className={styles.errorContent}>
                  <p>Unable to load collection details</p>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
