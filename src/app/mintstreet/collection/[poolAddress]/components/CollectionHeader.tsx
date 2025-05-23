import React from "react";

import { PoolInfo } from "../types";
import { formatAddress } from "../utils/formatters";

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
        Collection: {poolInfo.collectionName} (
        {formatAddress(poolInfo.collection)})
      </h1>
      <div className={styles.poolAddress}>
        Pool: <span>{formatAddress(poolAddress)}</span>
      </div>
    </header>
  );
}
