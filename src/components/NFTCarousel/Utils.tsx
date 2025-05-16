import React from "react";
import styles from "./NFTCarousel.module.scss";

export const NFTSkeleton: React.FC = () => (
  <div className={styles.card}>
    <div className={styles.imageWrapper}>
      <div className={styles.skeletonImage}></div>
      <div className={styles.infoOverlay}>
        <div className={styles.infoContent}>
          <div className={styles.skeletonTitle}></div>
          <div className={styles.floorPriceWrapper}>
            <div className={styles.skeletonFloor}></div>
          </div>
        </div>
        <div className={styles.skeletonButton}></div>
      </div>
    </div>
  </div>
);

export const LoadingDots: React.FC<{ className?: string }> = ({
  className = "",
}) => (
  <div className={`${styles.loadingDots} ${className}`}>
    <span></span>
    <span></span>
    <span></span>
  </div>
);

export const ErrorBadge: React.FC<{ message?: string }> = ({
  message = "Failed to load",
}) => (
  <div className={styles.errorBadge}>
    <span>⚠️</span>
    <span>{message}</span>
  </div>
);
