// src/hook/pools/usePoolNFTs.ts
import { useMemo } from "react";
import { useTransactionHistory } from "@/hook/api/helius/useTransactionHistory";
import type { HistoryItem } from "@/hook/api/helius/useTransactionHistory";

/**
 * Represents a single NFT minted into a pool.
 */
export interface PoolNft {
  /** The mint address of the NFT token */
  mintAddress: string;
  /** Name of the NFT from args.name */
  name?: string;
  /** Symbol of the NFT from args.symbol */
  symbol?: string;
  /** Metadata URI of the NFT from args.uri */
  uri?: string;
  /** The block timestamp when it was minted */
  timestamp?: number;
  /** The transaction signature for tracing */
  signature: string;
  /** Price paid (in SOL) if available */
  price?: number;
  /** Address of the user who minted the NFT */
  minterAddress?: string;
}

/**
 * Hook to fetch all NFTs minted into a specific bonding-curve pool.
 * Uses real-time transaction data from webhooks
 * @param poolAddress The pool address to list NFTs for
 */
export function usePoolNfts(poolAddress: string) {
  // Use the transaction history hook that handles real-time data
  const { history, isLoading, error } = useTransactionHistory({
    limit: 500, // Get more NFTs for the pool
    staleTime: 60 * 1000, // 1 minute cache
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Filter and map only the mintNft instructions matching our pool
  const nfts: PoolNft[] = useMemo(() => {
    if (!poolAddress || !history) return [];

    return history
      .filter((tx: HistoryItem) => {
        // Only include mintNft transactions for this specific pool
        return (
          tx.instructionName === "mintNft" && tx.poolAddress === poolAddress
        );
      })
      .map((tx: HistoryItem) => {
        // Extract NFT data from transaction
        const { name, symbol, uri } = tx.args || {};

        // The mint address is typically the second account in the instruction
        // Based on the IDL: accounts[1] should be the NFT mint
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
    const latestNft = nfts[0]; // Most recent (due to sorting)

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
