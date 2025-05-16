"use client";

import React from "react";
import { useParams } from "next/navigation";

import { usePoolNfts, PoolNft } from "@/hook/pools/usePoolNFTs";
import { useOptimizedCollectionData } from "@/hook/collections/useOptimizedCollectionData";

import PoolNFTsGrid from "./PoolNFTsGrid";
import PriceCard from "./components/PriceCard";
import CollectionChart from "./CollectionChart";
import CollectionHeader from "./components/CollectionHeader";
import BondingCurveCard from "./components/BondingCurveCard";
import CollectionDetailsCard from "./components/CollectionDetailsCard";
import {
  LoadingState,
  ErrorState,
  InvalidPoolAddress,
} from "./components/LoadingError";

import styles from "./page.module.scss";

interface NFT {
  mintAddress: string;
  name: string;
  symbol: string;
  uri?: string;
  timestamp: number;
  signature: string;
  price: number;
  image?: string;
  minterAddress?: string;
}

export default function CollectionDetailPage() {
  const params = useParams();

  const poolAddress = Array.isArray(params.poolAddress)
    ? params.poolAddress[0]
    : params.poolAddress || "";

  const {
    poolInfo,
    isLoading: isLoadingPoolInfo,
    error: errorPoolInfo,
    lastMintPrice,
    migrationProgress,
  } = useOptimizedCollectionData(poolAddress);

  const {
    nfts: rawPoolGridNfts,
    isLoading: isLoadingPoolGridNfts,
    error: errorDataPoolGridNfts,
  } = usePoolNfts(poolAddress);

  // Transform PoolNft[] to NFT[] to match PoolNFTsGridProps
  const mappedPoolGridNfts: NFT[] = React.useMemo(() => {
    if (!rawPoolGridNfts) return [];
    return rawPoolGridNfts.map(
      (nft: PoolNft): NFT => ({
        mintAddress: nft.mintAddress,
        name: nft.name || "Unnamed NFT",
        symbol: nft.symbol || "UNSYM",
        uri: nft.uri,
        timestamp: nft.timestamp || 0,
        signature: nft.signature,
        price: nft.price || 0,
        image: undefined,
        minterAddress: nft.minterAddress,
      })
    );
  }, [rawPoolGridNfts]);

  const gridErrorString: string | null = React.useMemo(() => {
    if (!errorDataPoolGridNfts) return null;
    if (errorDataPoolGridNfts instanceof Error) {
      return errorDataPoolGridNfts.message;
    }
    return String(errorDataPoolGridNfts);
  }, [errorDataPoolGridNfts]);

  if (!poolAddress) {
    return <InvalidPoolAddress poolAddress={poolAddress} />;
  }

  if (isLoadingPoolInfo) {
    return <LoadingState />;
  }

  if (errorPoolInfo || !poolInfo) {
    return (
      <ErrorState
        message={errorPoolInfo || "Could not load pool information."}
      />
    );
  }

  return (
    <div className={styles.container}>
      <CollectionHeader poolInfo={poolInfo} poolAddress={poolAddress} />

      <main className={styles.content}>
        <section className={styles.chartSection}>
          <CollectionChart poolAddress={poolAddress} />

          <PoolNFTsGrid
            nfts={mappedPoolGridNfts}
            isLoading={isLoadingPoolGridNfts}
            error={gridErrorString}
            poolAddress={poolAddress}
          />
        </section>

        <section className={styles.infoSection}>
          <PriceCard poolInfo={poolInfo} lastMintPrice={lastMintPrice} />

          <BondingCurveCard
            poolInfo={poolInfo}
            migrationProgress={migrationProgress}
          />

          <CollectionDetailsCard poolInfo={poolInfo} />
        </section>
      </main>
    </div>
  );
}
