import React, { useEffect, useState } from "react";
import { PoolInfo } from "../types";
import { formatSOL, formatProtocolFee } from "../utils/formatters";
import styles from "../page.module.scss";
import { usePoolNfts } from "@/hook/pools/usePoolNFTs";

interface PriceCardProps {
  poolInfo: PoolInfo;
  lastMintPrice: string;
  poolAddress: string;
}

export default function PriceCard({
  poolInfo,
  lastMintPrice,
  poolAddress,
}: PriceCardProps) {
  const [calculatedLastMintPrice, setCalculatedLastMintPrice] = useState<
    string | null
  >(null);

  // Fetch NFTs directly in the component to ensure we get the latest data
  const { nfts, isLoading, stats } = usePoolNfts(poolAddress);

  // Calculate last mint price from NFTs
  useEffect(() => {
    if (nfts && nfts.length > 0) {
      // Sort by timestamp (newest first)
      const sortedNfts = [...nfts].sort(
        (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
      );

      // Get the most recent NFT with a valid price
      const latestNft = sortedNfts.find((nft) => nft.price && nft.price > 0);

      if (latestNft && latestNft.price) {
        setCalculatedLastMintPrice(`${latestNft.price.toFixed(4)} SOL`);
      }
    }
  }, [nfts]);

  const safeFormatSOL = (value: number | undefined): string => {
    if (value === undefined || value === null || isNaN(value)) {
      return "0.0000 SOL";
    }
    return formatSOL(value);
  };

  const safeFormatNumber = (value: number | undefined): string => {
    if (value === undefined || value === null || isNaN(value)) {
      return "0";
    }
    return value.toString();
  };

  const safeFormatPercent = (value: number | undefined): string => {
    if (value === undefined || value === null || isNaN(value)) {
      return "2.00%"; // Default protocol fee
    }
    return formatProtocolFee(value);
  };

  // Determine the most accurate last mint price to display
  const displayLastMintPrice = calculatedLastMintPrice || lastMintPrice;

  // Calculate minted NFTs
  const mintedNFTs = stats?.totalNfts || nfts?.length || 0;

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Price Information</h2>
      <div className={styles.cardContent}>
        <div className={styles.priceHighlight}>
          <span className={styles.priceLabel}>Last Mint Price</span>
          <span className={styles.priceValue}>
            {displayLastMintPrice}
            {isLoading && (
              <span className={styles.loadingIndicator}> (loading...)</span>
            )}
          </span>
        </div>

        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Base Price</span>
            <span className={styles.infoValue}>
              {safeFormatSOL(poolInfo.basePrice)}
            </span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Growth Factor</span>
            <span className={styles.infoValue}>
              {safeFormatNumber(poolInfo.growthFactor)}
            </span>
          </div>

          {/* Use a more accurate label for the NFT count */}
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Minted Assets</span>
            <span className={styles.infoValue}>
              {isLoading ? (
                <span className={styles.loadingIndicator}>Loading...</span>
              ) : (
                mintedNFTs
              )}
            </span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Protocol Fee</span>
            <span className={styles.infoValue}>
              {safeFormatPercent(poolInfo.protocolFeePercent)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
