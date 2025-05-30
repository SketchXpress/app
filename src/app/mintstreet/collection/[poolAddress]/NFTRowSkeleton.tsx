"use client";

import React from "react";
import styles from "./PoolNFTsGrid.module.scss";

const NFTRowSkeleton: React.FC = () => {
  return (
    <tr className={styles.skeletonRow}>
      <td className={styles.indexCell}>
        <div className={`${styles.skeleton} ${styles.skeletonTextShort}`}></div>
      </td>
      <td className={styles.imageCell}>
        <div className={styles.skeletonImageWrapper}>
          <div className={`${styles.skeleton} ${styles.skeletonImage}`}></div>
        </div>
      </td>
      <td className={styles.nameCell}>
        <div
          className={`${styles.skeleton} ${styles.skeletonTextMedium}`}
        ></div>
      </td>
      <td className={styles.symbolCell}>
        <div className={`${styles.skeleton} ${styles.skeletonTextShort}`}></div>
      </td>
      <td className={styles.priceCell}>
        <div className={`${styles.skeleton} ${styles.skeletonTextShort}`}></div>
      </td>
      <td className={styles.timeCell}>
        <div
          className={`${styles.skeleton} ${styles.skeletonTextMedium}`}
        ></div>
      </td>
      <td className={styles.timeCell}>
        <div
          className={`${styles.skeleton} ${styles.skeletonTextMedium}`}
        ></div>
      </td>
      <td className={styles.actionsCell}>
        <div className={`${styles.skeleton} ${styles.skeletonButton}`}></div>
        <div className={`${styles.skeleton} ${styles.skeletonButton}`}></div>
      </td>
    </tr>
  );
};

export default NFTRowSkeleton;
