import styles from './NFTCarousel.module.scss';

export const NFTSkeleton = () => (
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
