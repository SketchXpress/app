// src/app/mintstreet/collection/[poolAddress]/components/BondingCurveCard.tsx - UPDATED
import React from "react";
import { PoolInfo } from "../types";
import { formatSOL, formatPercentage } from "../utils/formatters";
import styles from "../page.module.scss";

interface BondingCurveCardProps {
  poolInfo: PoolInfo;
  migrationProgress: number;
}

const MIGRATION_THRESHOLD = 690; // SOL

export default function BondingCurveCard({
  poolInfo,
  migrationProgress,
}: BondingCurveCardProps) {
  // Safe formatting with fallbacks
  const safeFormatSOL = (value: number | undefined): string => {
    if (value === undefined || value === null || isNaN(value)) {
      return "0.0000 SOL";
    }
    return formatSOL(value);
  };

  const safeFormatPercentage = (value: number | undefined): string => {
    if (value === undefined || value === null || isNaN(value)) {
      return "0.0%";
    }
    return formatPercentage(value);
  };

  // Calculate migration status text
  const getMigrationStatusText = (): string => {
    if (poolInfo.totalEscrowed >= MIGRATION_THRESHOLD) {
      return "Ready for Migration";
    }
    if (poolInfo.totalEscrowed > 0) {
      return "Accumulating SOL";
    }
    return poolInfo.migrationStatus || "Active";
  };

  // Get status style
  const getStatusStyle = (): string => {
    if (poolInfo.totalEscrowed >= MIGRATION_THRESHOLD) {
      return styles.statusReady;
    }
    if (poolInfo.isActive) {
      return styles.statusActive;
    }
    return styles.statusInactive;
  };

  // Calculate progress bar style with minimum visible width
  const getProgressBarStyle = (): React.CSSProperties => {
    const progress = Math.max(migrationProgress, 0);
    const minWidth = progress > 0 ? Math.max(progress, 2) : 0; // Minimum 2% if any progress
    return {
      width: `${minWidth}%`,
      backgroundColor: progress >= 100 ? "#10b981" : "#3b82f6", // Green when complete, blue otherwise
    };
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Bonding Curve</h2>
      <div className={styles.cardContent}>
        <div className={styles.totalSol}>
          <span className={styles.totalSolLabel}>Total SOL Escrowed</span>
          <span className={styles.totalSolValue}>
            {safeFormatSOL(poolInfo.totalEscrowed)}
          </span>
        </div>

        <div className={styles.progressContainer}>
          <div className={styles.progressHeader}>
            <span>Migration Progress</span>
            <span>{safeFormatPercentage(migrationProgress)}</span>
          </div>

          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={getProgressBarStyle()}
            />
          </div>

          <div className={styles.progressFooter}>
            <span>
              {poolInfo.totalEscrowed?.toFixed(2) || "0.00"} /{" "}
              {MIGRATION_THRESHOLD} SOL
            </span>
            {migrationProgress >= 100 && (
              <span className={styles.migrationReady}>
                🎉 Migration Available!
              </span>
            )}
          </div>
        </div>

        <div className={styles.migrationStatus}>
          <span className={getStatusStyle()}>{getMigrationStatusText()}</span>
        </div>

        {/* Additional bonding curve info */}
        <div className={styles.bondingCurveInfo}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Pool Status:</span>
            <span
              className={
                poolInfo.isActive ? styles.statusActive : styles.statusInactive
              }
            >
              {poolInfo.isActive ? "Active" : "Inactive"}
            </span>
          </div>

          {poolInfo.totalEscrowed > 0 && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Remaining to Migration:</span>
              <span className={styles.infoValue}>
                {formatSOL(
                  Math.max(0, MIGRATION_THRESHOLD - poolInfo.totalEscrowed)
                )}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
