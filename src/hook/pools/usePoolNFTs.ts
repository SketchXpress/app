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

    console.log("🔍 DEBUG: usePoolNfts - Raw history data:", {
      poolAddress,
      totalHistoryItems: history.length,
      historyPreview: history.slice(0, 3),
    });

    const filteredTransactions = history.filter((tx: HistoryItem) => {
      const isMatch =
        tx.instructionName === "mintNft" && tx.poolAddress === poolAddress;
      if (isMatch) {
        console.log("✅ DEBUG: Found matching mintNft transaction:");
        console.log("  Signature:", tx.signature);
        console.log("  Instruction:", tx.instructionName);
        console.log("  Pool Address:", tx.poolAddress);
        console.log("  Block Time:", tx.blockTime);
        console.log("  Raw Price:", tx.price);
        console.log("  Price Type:", typeof tx.price);
        console.log("  Args:", JSON.stringify(tx.args, null, 2));
        console.log(
          "  Accounts:",
          tx.accounts?.map((acc) => acc.toBase58())
        );
        console.log("  Full Tx:", JSON.stringify(tx, null, 2));
      }
      return isMatch;
    });

    console.log("🎯 DEBUG: Filtered mintNft transactions:", {
      count: filteredTransactions.length,
      transactions: filteredTransactions,
    });

    const mappedNfts = filteredTransactions
      .map((tx: HistoryItem) => {
        // Extract NFT data from transaction
        const { name, symbol, uri } = tx.args || {};
        const mintAddress = tx.accounts[1]?.toBase58() || "";

        // Get the minter address (first account - payer)
        const minterAddress = tx.accounts[0]?.toBase58() || "";

        const nft = {
          mintAddress,
          name,
          symbol,
          uri,
          timestamp: tx.blockTime || undefined,
          signature: tx.signature,
          price: tx.price,
          minterAddress,
        };

        console.log("💰 DEBUG: Mapped NFT price details:");
        console.log("  Mint Address:", mintAddress.slice(0, 8) + "...");
        console.log("  Signature:", tx.signature.slice(0, 8) + "...");
        console.log("  Original Tx Price:", tx.price);
        console.log("  Mapped NFT Price:", nft.price);
        console.log("  Price in SOL:", nft.price ? `${nft.price} SOL` : "N/A");
        console.log("  Timestamp:", nft.timestamp);
        console.log("  Minter Address:", minterAddress.slice(0, 8) + "...");

        return nft;
      })
      .sort((a, b) => {
        // Sort by timestamp descending (newest first)
        return (b.timestamp || 0) - (a.timestamp || 0);
      });

    console.log("📊 DEBUG: Final NFTs array:");
    console.log("  Total NFTs:", mappedNfts.length);
    console.log(
      "  Prices:",
      JSON.stringify(
        mappedNfts.map((nft) => ({
          signature: nft.signature.slice(0, 8) + "...",
          price: nft.price,
          timestamp: nft.timestamp,
        })),
        null,
        2
      )
    );
    console.log("  Price Range:");
    console.log(
      "    Min:",
      Math.min(...mappedNfts.map((nft) => nft.price || 0))
    );
    console.log(
      "    Max:",
      Math.max(...mappedNfts.map((nft) => nft.price || 0))
    );
    console.log(
      "    Average:",
      mappedNfts.reduce((sum, nft) => sum + (nft.price || 0), 0) /
        mappedNfts.length
    );

    return mappedNfts;
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

    const stats = {
      totalNfts: nfts.length,
      totalValue,
      averagePrice,
      uniqueMinters: uniqueMinters.size,
      latestNft,
      oldestNft: nfts[nfts.length - 1],
    };

    console.log("📈 DEBUG: NFT Stats:", {
      totalNfts: stats.totalNfts,
      totalValue: stats.totalValue,
      averagePrice: stats.averagePrice,
      uniqueMinters: stats.uniqueMinters,
      latestNftPrice: stats.latestNft?.price,
      oldestNftPrice: stats.oldestNft?.price,
    });

    return stats;
  }, [nfts]);

  // Also log when the hook returns data
  console.log("🚀 DEBUG: usePoolNfts returning:", {
    nftsCount: nfts.length,
    isLoading,
    hasError: !!error,
    errorMessage: error,
    firstFewNfts: nfts.slice(0, 3).map((nft) => ({
      signature: nft.signature.slice(0, 8) + "...",
      price: nft.price,
      timestamp: nft.timestamp,
    })),
  });

  return {
    nfts,
    isLoading,
    error,
    stats: nftStats,
  };
}
