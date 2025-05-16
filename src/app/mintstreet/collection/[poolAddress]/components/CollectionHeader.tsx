// app/src/app/mintstreet/collection/[poolAddress]/components/CollectionHeader.tsx

import React from "react";
import { formatAddress } from "../utils/formatters";
import { PoolInfo } from "../types";
import styles from "../page.module.scss";

interface CollectionHeaderProps {
  poolInfo: PoolInfo;
  poolAddress: string;
}

export default function CollectionHeader({
  poolInfo,
  poolAddress,
}: CollectionHeaderProps) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>
        Collection: {formatAddress(poolInfo.collection)} (
        {poolInfo.collectionName})
      </h1>
      <div className={styles.poolAddress}>
        Pool: <span>{formatAddress(poolAddress)}</span>
      </div>
    </header>
  );
}
