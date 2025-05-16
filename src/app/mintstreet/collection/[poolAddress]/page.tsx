"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useOptimizedCollectionData } from "@/hook/collections/useOptimizedCollectionData";
import { usePoolNfts, PoolNft } from "@/hook/pools/usePoolNFTs"; // Import PoolNft type
import CollectionChart from "./CollectionChart";
import PoolNFTsGrid from "./PoolNFTsGrid";
import CollectionHeader from "./components/CollectionHeader";
import PriceCard from "./components/PriceCard";
import BondingCurveCard from "./components/BondingCurveCard";
import CollectionDetailsCard from "./components/CollectionDetailsCard";
import {
  LoadingState,
  ErrorState,
  InvalidPoolAddress,
} from "./components/LoadingError";
import styles from "./page.module.scss";

// Define the NFT type expected by PoolNFTsGrid, if not already globally available
// This should match the interface in PoolNFTsGrid.tsx
interface NFT {
  mintAddress: string;
  name: string;
  symbol: string;
  uri?: string;
  timestamp: number;
  signature: string;
  price: number;
  image?: string; // This is optional, PoolNFTsGrid should handle it or use uri
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
    error: errorDataPoolGridNfts, // Original error object (Error | null)
  } = usePoolNfts(poolAddress);

  // Transform PoolNft[] to NFT[] to match PoolNFTsGridProps
  const mappedPoolGridNfts: NFT[] = React.useMemo(() => {
    if (!rawPoolGridNfts) return [];
    return rawPoolGridNfts.map(
      (nft: PoolNft): NFT => ({
        mintAddress: nft.mintAddress,
        name: nft.name || "Unnamed NFT", // Provide default for name
        symbol: nft.symbol || "UNSYM", // Provide default for symbol
        uri: nft.uri, // Pass the metadata URI
        timestamp: nft.timestamp || 0, // Provide default for timestamp
        signature: nft.signature,
        price: nft.price || 0, // Provide default for price
        image: undefined, // Set image to undefined as PoolNft does not have a direct image URL.
        // PoolNFTsGrid should use the 'uri' to fetch metadata and then the image.
        minterAddress: nft.minterAddress,
      })
    );
  }, [rawPoolGridNfts]);

  // Convert Error object to string for PoolNFTsGrid error prop
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
            nfts={mappedPoolGridNfts} // Use mapped NFTs
            isLoading={isLoadingPoolGridNfts}
            error={gridErrorString} // Use stringified error
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
