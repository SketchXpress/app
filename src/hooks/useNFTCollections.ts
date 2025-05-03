// hooks/useNFTCollections.ts
import { useState, useEffect } from "react";
import {
  useBondingCurveHistory,
  HistoryItem,
} from "@/hooks/useBondingCurveHistory";

export interface NFTCollection {
  id: number;
  poolAddress: string;
  title: string;
  floor: string;
  image: string;
  trending: boolean;
  supply?: number;
  collectionMint?: string;
}

// Process transaction history to find trending collections
const processTrendingCollections = (transactions: HistoryItem[]) => {
  // Group transactions by pool address
  const poolMap = new Map<
    string,
    {
      poolAddress: string;
      transactions: number;
      timestamp: number;
      totalVolume: number;
      name: string;
      nftCount: number;
      collectionMint: string | undefined;
      collectionFound: boolean;
    }
  >();

  // First, build a dynamic collection map
  // Track collection creation transactions to get collection names and addresses
  const collectionCreations = new Map<
    string,
    { name: string; symbol: string }
  >();

  transactions.forEach((tx) => {
    if (tx.instructionName === "createCollectionNft" && tx.args) {
      const name = tx.args.name as string;
      const symbol = tx.args.symbol as string;

      // Get the collection mint address from the accounts
      if (tx.accounts && tx.accounts.length > 1) {
        const collectionMintAddress = tx.accounts[1].toString();
        collectionCreations.set(collectionMintAddress, { name, symbol });
      }
    }
  });

  // Find pool creation transactions and link them to collections
  const poolToCollectionMap = new Map<
    string,
    { name: string; collectionMint: string }
  >();

  transactions.forEach((tx) => {
    if (
      tx.instructionName === "createPool" &&
      tx.accounts &&
      tx.accounts.length > 1
    ) {
      const poolAddress = tx.poolAddress;
      const collectionMintAddress = tx.accounts[1].toString();

      if (poolAddress && collectionCreations.has(collectionMintAddress)) {
        const collection = collectionCreations.get(collectionMintAddress);
        if (collection) {
          poolToCollectionMap.set(poolAddress, {
            name: collection.name,
            collectionMint: collectionMintAddress,
          });
        }
      }
    }
  });

  // Process all transactions to build the pool data
  transactions.forEach((tx) => {
    if (!tx.poolAddress) return; // Skip if no pool address

    // Get or create pool entry
    if (!poolMap.has(tx.poolAddress)) {
      // Try to find collection info from our dynamic map
      const collectionInfo = poolToCollectionMap.get(tx.poolAddress);

      poolMap.set(tx.poolAddress, {
        poolAddress: tx.poolAddress,
        transactions: 0,
        timestamp: 0,
        totalVolume: 0,
        name:
          collectionInfo?.name ||
          `Collection ${tx.poolAddress.substring(0, 6)}`,
        collectionMint: collectionInfo?.collectionMint,
        nftCount: 0,
        collectionFound: !!collectionInfo,
      });
    }

    const pool = poolMap.get(tx.poolAddress)!;

    // Update pool stats
    pool.transactions += 1;

    // Update timestamp if more recent
    if (tx.blockTime && tx.blockTime > pool.timestamp) {
      pool.timestamp = tx.blockTime;
    }

    // Update volume if available
    if (tx.price) {
      pool.totalVolume += tx.price;
    }

    // Count NFTs minted for this collection
    if (tx.instructionName === "mintNft") {
      pool.nftCount += 1;
    }
  });

  return Array.from(poolMap.values());
};

// Calculate trending status based on transaction frequency
const calculateIsTrending = (
  poolData: ReturnType<typeof processTrendingCollections>[0],
  allPools: ReturnType<typeof processTrendingCollections>
) => {
  // Pool is trending if it's in the top 3 by transaction count
  const sortedByActivity = [...allPools].sort(
    (a, b) => b.transactions - a.transactions
  );
  return sortedByActivity.indexOf(poolData) < 3;
};

export const useNFTCollections = (limit: number = 6) => {
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get transaction history
  const {
    history,
    isLoading: historyLoading,
    error: historyError,
  } = useBondingCurveHistory(50);

  useEffect(() => {
    if (historyLoading) return;

    if (historyError) {
      setError(historyError);
      setLoading(false);
      return;
    }

    const fetchCollectionsData = async () => {
      try {
        // Process transaction history to find collections
        const poolsData = processTrendingCollections(history);

        // Sort by most recent activity
        const sortedPools = [...poolsData].sort(
          (a, b) => b.timestamp - a.timestamp
        );

        // Take top collections for carousel
        const topPools = sortedPools.slice(0, limit);

        // Format collections for display
        const formattedCollections: NFTCollection[] = topPools.map(
          (pool, index) => ({
            id: index + 1,
            poolAddress: pool.poolAddress,
            title: pool.name,
            floor: `${(pool.totalVolume / Math.max(pool.nftCount, 1)).toFixed(
              2
            )} SOL`,
            // Always use defaultNFT.png as the image
            image: "/defaultNFT.png",
            trending: calculateIsTrending(pool, topPools),
            supply: pool.nftCount,
            collectionMint: pool.collectionMint,
          })
        );

        setCollections(formattedCollections);
      } catch (err) {
        console.error("Error fetching NFT collections:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchCollectionsData();
  }, [history, historyLoading, historyError, limit]);

  return { collections, loading, error };
};
