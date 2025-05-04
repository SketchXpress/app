import { useMemo } from "react";
import {
  useBondingCurveHistory,
  HistoryItem,
} from "@/hooks/useBondingCurveHistory";

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
}

/**
 * Hook to fetch all NFTs minted into a specific bonding-curve pool.
 * @param poolAddress The pool address to list NFTs for
 */
export function usePoolNfts(poolAddress: string) {
  const { history, isLoading, error } = useBondingCurveHistory();

  // Filter and map only the mintNft instructions matching our pool
  const nfts: PoolNft[] = useMemo(() => {
    return history
      .filter(
        (tx: HistoryItem) =>
          tx.instructionName === "mintNft" && tx.poolAddress === poolAddress
      )
      .map((tx: HistoryItem) => {
        // Typically args includes name, symbol, uri
        const { name, symbol, uri } = tx.args || {};
        // The mint address is usually the second account in the instruction
        const mintAddress = tx.accounts[1]?.toBase58() || "";
        return {
          mintAddress,
          name,
          symbol,
          uri,
          timestamp: tx.blockTime || undefined,
          signature: tx.signature,
          price: tx.price,
        };
      });
  }, [history, poolAddress]);

  return { nfts, isLoading, error };
}
