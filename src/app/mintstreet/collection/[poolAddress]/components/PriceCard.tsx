// src/app/mintstreet/collection/[poolAddress]/components/PriceCard.tsx - UPDATED with alternatives
import React from "react";
import { PoolInfo } from "../types";
import { formatSOL, formatProtocolFee } from "../utils/formatters";
import styles from "../page.module.scss";

interface PriceCardProps {
  poolInfo: PoolInfo;
  lastMintPrice: string;
}

export default function PriceCard({ poolInfo, lastMintPrice }: PriceCardProps) {
  // Helper function to format numbers safely
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

  return (
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

          {/* Alternative to Current Supply: Show estimated or transactions */}
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>
              {poolInfo.currentSupply > 0 ? "Estimated Supply" : "Pool Status"}
            </span>
            <span className={styles.infoValue}>
              {poolInfo.currentSupply > 0
                ? safeFormatNumber(poolInfo.currentSupply)
                : "Active"}
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

      {/* Real-time data section if available */}
      {(poolInfo.volume24h !== undefined ||
        poolInfo.transactions24h !== undefined) && (
        <div className={styles.realtimeStats}>
          <h3>24h Statistics</h3>
          <div className={styles.infoGrid}>
            {poolInfo.volume24h !== undefined && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Volume</span>
                <span className={styles.infoValue}>
                  {safeFormatSOL(poolInfo.volume24h)}
                </span>
              </div>
            )}

            {poolInfo.transactions24h !== undefined && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Transactions</span>
                <span className={styles.infoValue}>
                  {safeFormatNumber(poolInfo.transactions24h)}
                </span>
              </div>
            )}

            {poolInfo.lastPrice !== undefined && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Current Price</span>
                <span className={styles.infoValue}>
                  {safeFormatSOL(poolInfo.lastPrice)}
                </span>
              </div>
            )}

            {poolInfo.priceChange24h !== undefined && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>24h Change</span>
                <span
                  className={`${styles.infoValue} ${
                    poolInfo.priceChange24h >= 0
                      ? styles.positive
                      : styles.negative
                  }`}
                >
                  {poolInfo.priceChange24h >= 0 ? "+" : ""}
                  {poolInfo.priceChange24h.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
