"use client";

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import styles from './page.module.scss';
import { usePoolInfo } from '@/hooks/usePoolInfo';
import { useBondingCurveForPool } from '@/hooks/useBondingCurveForPool';
import { usePoolNfts } from '@/hooks/usePoolNFTs'; // Import the new hook
import CollectionChart from './CollectionChart';
import PoolNFTsGrid from './PoolNFTsGrid'; // Import the NFT grid component
import { Loader2 } from 'lucide-react';

export default function CollectionDetailPage() {
  const params = useParams();
  // Extract the pool address (handle array case by taking first element)
  const poolAddress = Array.isArray(params.poolAddress)
    ? params.poolAddress[0]
    : params.poolAddress || '';

  // Always call hooks unconditionally at the top level
  const { info, loading: infoLoading, error: infoError } = usePoolInfo(poolAddress);
  const { history, isLoading: historyLoading } = useBondingCurveForPool(poolAddress);
  const { nfts, isLoading: nftsLoading, error: nftsError } = usePoolNfts(poolAddress);

  // Calculate last mint price from history
  const lastMintPrice = useMemo(() => {
    if (history.length === 0) return "N/A";

    // Sort by blockTime descending to get the most recent
    const sortedHistory = [...history].sort((a, b) =>
      (b.blockTime ?? 0) - (a.blockTime ?? 0)
    );

    // Find the most recent mint or sell transaction with a price
    const lastPricedTx = sortedHistory.find(tx =>
      (tx.instructionName === "mintNft" || tx.instructionName === "sellNft") && tx.price
    );

    if (lastPricedTx && lastPricedTx.price) {
      return `${lastPricedTx.price.toFixed(4)} SOL`;
    }

    return "N/A";
  }, [history]);

  // Calculate migration progress percentage
  const migrationProgress = useMemo(() => {
    if (!info) return 0;
    const threshold = 690; // 690 SOL
    const progress = (info.totalEscrowed / threshold) * 100;
    return Math.min(progress, 100); // Cap at 100%
  }, [info]);

  // Helper to format addresses for display
  const formatAddress = (address: string) => {
    if (!address || address.length <= 12) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 6)}`;
  };

  // Check for invalid pool address - do this AFTER calling hooks
  if (!poolAddress) {
    return (
      <div className={styles.errorContainer}>
        <h2>Invalid Pool Address</h2>
        <p>The provided pool address is invalid. Please check the URL and try again.</p>
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
  if (infoError || !info) {
    return (
      <div className={styles.errorContainer}>
        <h2>Error Loading Pool</h2>
        <p>{infoError || "Could not load pool information."}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          Collection: {formatAddress(info.collection)}
        </h1>
        <div className={styles.poolAddress}>
          Pool: <span>{formatAddress(poolAddress)}</span>
        </div>
      </header>

      <main className={styles.content}>
        {/* Left side - Chart */}
        <section className={styles.chartSection}>
          <CollectionChart poolAddress={poolAddress} />

          {/* NFTs Grid - Below the chart */}
          <PoolNFTsGrid
            nfts={nfts.map(nft => ({
              ...nft,
              name: nft.name || 'Unnamed NFT',
              symbol: nft.symbol || '',
              uri: nft.uri || '',
              timestamp: nft.timestamp || 0,
              price: nft.price || 0
            }))}
            isLoading={nftsLoading}
            error={nftsError}
          />
        </section>

        {/* Right side - Pool info */}
        <section className={styles.infoSection}>
          {/* Price card */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Price Information</h2>
            <div className={styles.cardContent}>
              <div className={styles.priceHighlight}>
                <span className={styles.priceLabel}>Last Mint Price</span>
                <span className={styles.priceValue}>{lastMintPrice}</span>
              </div>

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Base Price</span>
                  <span className={styles.infoValue}>{info.basePrice.toFixed(4)} SOL</span>
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
                  <span className={styles.infoValue}>{info.protocolFeePercent}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bonding curve card */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Bonding Curve</h2>
            <div className={styles.cardContent}>
              <div className={styles.totalSol}>
                <span className={styles.totalSolLabel}>Total SOL</span>
                <span className={styles.totalSolValue}>{info.totalEscrowed.toFixed(4)} SOL</span>
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
                <span className={info.isActive ? styles.statusActive : styles.statusInactive}>
                  {info.migrationStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Creator info card */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Collection Details</h2>
            <div className={styles.cardContent}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Status</span>
                <span className={info.isActive ? styles.statusActive : styles.statusInactive}>
                  {info.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Creator</span>
                <span className={styles.detailValue} title={info.creator}>
                  {formatAddress(info.creator)}
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}