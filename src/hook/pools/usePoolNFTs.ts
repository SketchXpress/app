import { useMemo } from "react";
import { useTransactionHistory } from "@/hook/api/helius/useTransactionHistory";
import type { HistoryItem } from "@/hook/api/helius/useTransactionHistory";

/**
 * Represents a single NFT minted into a pool.
 */
export interface PoolNft {
  mintAddress: string;
  name?: string;
  symbol?: string;
  uri?: string;
  timestamp?: number;
  signature: string;
  price?: number;
  minterAddress?: string;
}

export function usePoolNfts(poolAddress: string) {
  const { history, isLoading, error } = useTransactionHistory({
    limit: 500,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Filter and map only the mintNft instructions matching our pool
  const nfts: PoolNft[] = useMemo(() => {
    if (!poolAddress || !history) return [];

    return history
      .filter((tx: HistoryItem) => {
        return (
          tx.instructionName === "mintNft" && tx.poolAddress === poolAddress
        );
      })
      .map((tx: HistoryItem) => {
        // Extract NFT data from transaction
        const { name, symbol, uri } = tx.args || {};
        const mintAddress = tx.accounts[1]?.toBase58() || "";

        // Get the minter address (first account - payer)
        const minterAddress = tx.accounts[0]?.toBase58() || "";

        return {
          mintAddress,
          name,
          symbol,
          uri,
          timestamp: tx.blockTime || undefined,
          signature: tx.signature,
          price: tx.price,
          minterAddress,
        };
      })
      .sort((a, b) => {
        // Sort by timestamp descending (newest first)
        return (b.timestamp || 0) - (a.timestamp || 0);
      });
  }, [history, poolAddress]);

  // Calculate NFT stats for the pool
  const nftStats = useMemo(() => {
    if (!nfts.length) return null;

    const totalValue = nfts.reduce((sum, nft) => sum + (nft.price || 0), 0);
    const averagePrice = totalValue / nfts.length;
    const latestNft = nfts[0];

    // Get unique minters
    const uniqueMinters = new Set(
      nfts.map((nft) => nft.minterAddress).filter(Boolean)
    );

    return {
      totalNfts: nfts.length,
      totalValue,
      averagePrice,
      uniqueMinters: uniqueMinters.size,
      latestNft,
      oldestNft: nfts[nfts.length - 1],
    };
  }, [nfts]);

  return {
    nfts,
    isLoading,
    error,
    stats: nftStats,
  };
}
