import { useMemo } from "react";
import { usePoolInfo } from "@/hooks/usePoolInfo";
import { usePoolNfts } from "@/hooks/usePoolNFTs";
import { useBondingCurveForPool } from "@/hooks/useBondingCurveForPool";

import { PoolInfo, NFT, CollectionPageData } from "../types";

export function useCollectionData(poolAddress: string): CollectionPageData {
  const {
    data: info,
    isLoading: infoLoading,
    error: infoError,
  } = usePoolInfo(poolAddress) as {
    data: PoolInfo | undefined;
    isLoading: boolean;
    error: Error | null;
  };

  const { history, isLoading: historyLoading } =
    useBondingCurveForPool(poolAddress);

  const { nfts: rawNfts, error: nftsError } = usePoolNfts(poolAddress);

  // Processing NFTs to ensure all fields are present
  const nfts: NFT[] = useMemo(() => {
    return rawNfts.map((nft) => ({
      ...nft,
      name: nft.name || "Unnamed NFT",
      symbol: nft.symbol || "",
      uri: nft.uri || "",
      timestamp: nft.timestamp || 0,
      price: nft.price || 0,
    }));
  }, [rawNfts]);

  // Calculate last mint price from history
  const lastMintPrice = useMemo(() => {
    if (history.length === 0) return "N/A";

    const sortedHistory = [...history].sort(
      (a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0)
    );

    const lastPricedTx = sortedHistory.find(
      (tx) =>
        (tx.instructionName === "mintNft" ||
          tx.instructionName === "sellNft") &&
        tx.price
    );

    if (lastPricedTx && lastPricedTx.price) {
      return `${lastPricedTx.price.toFixed(4)} SOL`;
    }

    return "N/A";
  }, [history]);

  // Calculating migration progress percentage
  const migrationProgress = useMemo(() => {
    if (!info) return 0;
    const threshold = 690;
    const progress = (info.totalEscrowed / threshold) * 100;
    return Math.min(progress, 100);
  }, [info]);

  const isLoading = infoLoading || historyLoading;
  const error = infoError?.message || nftsError || null;

  return {
    poolInfo: info || null,
    nfts,
    history,
    isLoading,
    error,
    lastMintPrice,
    migrationProgress,
  };
}
