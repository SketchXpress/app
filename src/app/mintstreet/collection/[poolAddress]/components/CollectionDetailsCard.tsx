// app/src/app/mintstreet/collection/[poolAddress]/components/CollectionDetailsCard.tsx

import React from "react";
import { PoolInfo } from "../types";
import { formatAddress } from "../utils/formatters";
import styles from "../page.module.scss";

interface CollectionDetailsCardProps {
  poolInfo: PoolInfo;
}

export default function CollectionDetailsCard({
  poolInfo,
}: CollectionDetailsCardProps) {
  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Collection Details</h2>
      <div className={styles.cardContent}>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Status</span>
          <span
            className={
              poolInfo.isActive ? styles.statusActive : styles.statusInactive
            }
          >
            {poolInfo.isActive ? "Active" : "Inactive"}
          </span>
        </div>

        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Creator</span>
          <span className={styles.detailValue} title={poolInfo.creator}>
            {formatAddress(poolInfo.creator)}
          </span>
        </div>
      </div>
    </div>
  );
}
