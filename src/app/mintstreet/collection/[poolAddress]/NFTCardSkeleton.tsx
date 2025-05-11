"use client";

import React from 'react';
import styles from './PoolNFTsGrid.module.scss'; // Assuming shared styles or create a new one

/**
 * NFTCardSkeleton component renders a placeholder card for the NFT mobile view during loading.
 * It mimics the structure of an actual NFT card with styled placeholders.
 */
const NFTCardSkeleton: React.FC = () => {
  return (
    <div className={`${styles.card} ${styles.skeletonCard}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardImageWrapper}>
          <div className={`${styles.skeleton} ${styles.skeletonCardImage}`}></div>
        </div>
        <div className={styles.cardInfo}>
          <div className={`${styles.skeleton} ${styles.skeletonTextShort} ${styles.skeletonCardIndex}`}></div>
          <div className={`${styles.skeleton} ${styles.skeletonTextMedium} ${styles.skeletonCardName}`}></div>
          <div className={`${styles.skeleton} ${styles.skeletonTextShort} ${styles.skeletonCardSymbol}`}></div>
        </div>
      </div>
      <div className={styles.cardDetails}>
        <div className={styles.cardDetail}>
          <div className={`${styles.skeleton} ${styles.skeletonTextShort}`}></div>
          <div className={`${styles.skeleton} ${styles.skeletonTextMedium}`}></div>
        </div>
        <div className={styles.cardDetail}>
          <div className={`${styles.skeleton} ${styles.skeletonTextShort}`}></div>
          <div className={`${styles.skeleton} ${styles.skeletonTextMedium}`}></div>
        </div>
      </div>
      <div className={styles.cardActions}>
        <div className={`${styles.skeleton} ${styles.skeletonButton}`}></div>
        <div className={`${styles.skeleton} ${styles.skeletonButton}`}></div>
      </div>
    </div>
  );
};

export default NFTCardSkeleton;

