"use client";

import React, { ReactNode, useMemo } from "react";
import { useParams } from "next/navigation";
import styles from "./page.module.scss";
import { useBondingCurveForPool } from "@/hook/pools/useBondingCurveForPool";
import { usePoolNfts } from "@/hook/pools/usePoolNFTs";
import CollectionChart from "./CollectionChart";
import PoolNFTsGrid from "./PoolNFTsGrid";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import ConnectionStatus from "@/components/ConnectionStatus";
import { useRealtimePoolData, useRealtimePoolStats } from "@/hook/core";

// Enhanced pool info interface with real-time data
interface PoolInfo {
  collectionName: ReactNode;
  totalEscrowed: number;
  basePrice: number;
  growthFactor: number;
  currentSupply: number;
  protocolFeePercent: number;
  isActive: boolean;
  migrationStatus: string;
  creator: string;
  collection: string;
  // Real-time fields
  volume24h?: number;
  transactions24h?: number;
  priceChange24h?: number;
  lastPrice?: number;
  hasRealtimeData?: boolean;
  connectionState?: string;
}

export default function CollectionDetailPage() {
  const params = useParams();
  // Extract the pool address (handle array case by taking first element)
  const poolAddress = Array.isArray(params.poolAddress)
    ? params.poolAddress[0]
    : params.poolAddress || "";

  // Enhanced pool data with real-time integration
  const {
    poolInfo: enhancedInfo,
    isLoading: infoLoading,
    error: infoError,
    connectionState,
    hasRealtimeData,
    lastUpdate,
  } = useRealtimePoolData(poolAddress);

  // Real-time pool statistics
  const { stats: realtimeStats } = useRealtimePoolStats(poolAddress);

  // Existing hooks (unchanged)
  const { history, isLoading: historyLoading } =
    useBondingCurveForPool(poolAddress);
  const {
    nfts,
    isLoading: nftsLoading,
    error: nftsError,
  } = usePoolNfts(poolAddress);

  // Calculate last mint price from history (keeping existing logic)
  const lastMintPrice = useMemo(() => {
    if (history.length === 0) return "N/A";

    // Sort by blockTime descending to get the most recent
    const sortedHistory = [...history].sort(
      (a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0)
    );

    // Find the most recent mint or sell transaction with a price
    const lastPricedTx = sortedHistory.find(
      (tx) =>
        (tx.instructionName === "mintNft" ||
          tx.instructionName === "sellNft") &&
        tx.price
    );

    if (lastPricedTx && lastPricedTx.price) {
      return `${lastPricedTx.price.toFixed(4)} SOL`;
    }

    return "N/A";
  }, [history]);

  // Enhanced migration progress with real-time data
  const migrationProgress = useMemo(() => {
    if (!enhancedInfo) return 0;
    const threshold = 690; // 690 SOL
    const progress = (enhancedInfo.totalEscrowed / threshold) * 100;
    return Math.min(progress, 100); // Cap at 100%
  }, [enhancedInfo]);

  // Helper to format addresses for display
  const formatAddress = (address: string) => {
    if (!address || address.length <= 12) return address;
    return `${address.substring(0, 6)}...${address.substring(
      address.length - 6
    )}`;
  };

  // Format price change with color
  const formatPriceChange = (change: number) => {
    const isPositive = change >= 0;
    const icon = isPositive ? TrendingUp : TrendingDown;
    const colorClass = isPositive ? styles.positive : styles.negative;

    return (
      <span className={`${styles.priceChange} ${colorClass}`}>
        {React.createElement(icon, { size: 16 })}
        {isPositive ? "+" : ""}
        {change.toFixed(2)}%
      </span>
    );
  };

  // Check for invalid pool address
  if (!poolAddress) {
    return (
      <div className={styles.errorContainer}>
        <h2>Invalid Pool Address</h2>
        <p>
          The provided pool address is invalid. Please check the URL and try
          again.
        </p>
      </div>
    );
  }

  // Loading state
  if (infoLoading || historyLoading) {
    return (
      <div className={styles.loadingContainer}>
        <Loader2 className={styles.loadingSpinner} />
        <p>Loading pool data...</p>
      </div>
    );
  }

  // Error state
  if (infoError || !enhancedInfo) {
    return (
      <div className={styles.errorContainer}>
        <h2>Error Loading Pool</h2>
        <p>{infoError ? infoError : "Could not load pool information."}</p>
      </div>
    );
  }

  // Cast enhancedInfo to match existing interface for compatibility
  const info = enhancedInfo as PoolInfo;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <h1 className={styles.title}>
            Collection: {formatAddress(info.collection)}({info.collectionName})
          </h1>

          {/* Real-time connection status */}
          <ConnectionStatus
            connectionState={connectionState}
            hasRealtimeData={hasRealtimeData}
            lastUpdate={lastUpdate}
            size="md"
          />
        </div>

        <div className={styles.poolAddress}>
          Pool: <span>{formatAddress(poolAddress)}</span>
        </div>

        {/* Real-time statistics bar */}
        {realtimeStats && (
          <div className={styles.realtimeStats}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>24h Volume</span>
              <span className={styles.statValue}>
                {realtimeStats.volume24h.toFixed(4)} SOL
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>24h Transactions</span>
              <span className={styles.statValue}>
                {realtimeStats.transactions24h}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>24h Traders</span>
              <span className={styles.statValue}>
                {realtimeStats.uniqueTraders24h}
              </span>
            </div>
            {realtimeStats.priceChange24h !== undefined && (
              <div className={styles.statItem}>
                <span className={styles.statLabel}>24h Change</span>
                {formatPriceChange(realtimeStats.priceChange24h)}
              </div>
            )}
          </div>
        )}
      </header>

      <main className={styles.content}>
        {/* Left side - Chart */}
        <section className={styles.chartSection}>
          <CollectionChart
            poolAddress={poolAddress}
            hasRealtimeData={hasRealtimeData}
            connectionState={connectionState}
          />

          {/* NFTs Grid - Below the chart */}
          <PoolNFTsGrid
            nfts={nfts.map((nft) => ({
              ...nft,
              name: nft.name || "Unnamed NFT",
              symbol: nft.symbol || "",
              uri: nft.uri || "",
              timestamp: nft.timestamp || 0,
              price: nft.price || 0,
            }))}
            isLoading={nftsLoading}
            error={nftsError?.message || null}
            poolAddress={poolAddress}
          />
        </section>

        {/* Right side - Pool info */}
        <section className={styles.infoSection}>
          {/* Enhanced Price card with real-time data */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Price Information</h2>
              {hasRealtimeData && (
                <span className={styles.liveIndicator}>
                  <span className={styles.liveDot}></span>
                  LIVE
                </span>
              )}
            </div>
            <div className={styles.cardContent}>
              {/* Real-time last price if available */}
              {info.lastPrice && hasRealtimeData ? (
                <div className={styles.priceHighlight}>
                  <span className={styles.priceLabel}>Current Price</span>
                  <span className={styles.priceValue}>
                    {info.lastPrice.toFixed(4)} SOL
                  </span>
                  {info.priceChange24h !== undefined && (
                    <div className={styles.priceChangeContainer}>
                      {formatPriceChange(info.priceChange24h)}
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.priceHighlight}>
                  <span className={styles.priceLabel}>Last Mint Price</span>
                  <span className={styles.priceValue}>{lastMintPrice}</span>
                </div>
              )}

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Base Price</span>
                  <span className={styles.infoValue}>
                    {info.basePrice.toFixed(4)} SOL
                  </span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Growth Factor</span>
                  <span className={styles.infoValue}>{info.growthFactor}</span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Current Supply</span>
                  <span className={styles.infoValue}>{info.currentSupply}</span>
                </div>

                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Protocol Fee</span>
                  <span className={styles.infoValue}>
                    {(info.protocolFeePercent / 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Bonding curve card */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Bonding Curve</h2>
            <div className={styles.cardContent}>
              <div className={styles.totalSol}>
                <span className={styles.totalSolLabel}>Total SOL</span>
                <span className={styles.totalSolValue}>
                  {info.totalEscrowed.toFixed(4)} SOL
                </span>
              </div>

              <div className={styles.progressContainer}>
                <div className={styles.progressHeader}>
                  <span>Migration Progress</span>
                  <span>{migrationProgress.toFixed(1)}%</span>
                </div>

                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${migrationProgress}%` }}
                  />
                </div>

                <div className={styles.progressFooter}>
                  <span>{info.totalEscrowed.toFixed(2)} / 690 SOL</span>
                </div>
              </div>

              <div className={styles.migrationStatus}>
                <span
                  className={
                    info.isActive ? styles.statusActive : styles.statusInactive
                  }
                >
                  {info.migrationStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Enhanced Collection details with real-time data */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Collection Details</h2>
            <div className={styles.cardContent}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Status</span>
                <span
                  className={
                    info.isActive ? styles.statusActive : styles.statusInactive
                  }
                >
                  {info.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Creator</span>
                <span className={styles.detailValue} title={info.creator}>
                  {formatAddress(info.creator)}
                </span>
              </div>

              {/* Show data source */}
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Data Source</span>
                <span className={styles.detailValue}>
                  {hasRealtimeData ? "Real-time + API" : "API Only"}
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
