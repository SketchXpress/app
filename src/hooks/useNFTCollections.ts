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

// Process transaction history to find collections and their stats
const processPoolDataFromHistory = (transactions: HistoryItem[]) => {
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
      collectionFound: boolean; // Indicates if collection name/mint was found
    }
  >();

  // First, build a dynamic collection map from creation transactions
  const collectionCreations = new Map<
    string, // collectionMint address
    { name: string; symbol: string }
  >();

  transactions.forEach((tx) => {
    if (tx.instructionName === "createCollectionNft" && tx.args) {
      const name = tx.args.name as string;
      const symbol = tx.args.symbol as string; // Symbol isn't used but good to capture

      // Get the collection mint address from the accounts array in the transaction
      // Assuming accounts[1] is the collection mint
      if (tx.accounts && tx.accounts.length > 1) {
        const collectionMintAddress = tx.accounts[1].toString();
        collectionCreations.set(collectionMintAddress, { name, symbol });
      }
    }
  });

  // Map pool addresses to their collection mints using pool creation transactions
  const poolToCollectionMap = new Map<
    string, // pool address
    { name: string; collectionMint: string }
  >();

  transactions.forEach((tx) => {
    if (
      tx.instructionName === "createPool" &&
      tx.accounts &&
      tx.accounts.length > 1
    ) {
      const poolAddress = tx.poolAddress;
      // Assuming accounts[1] is the collection mint for a pool creation
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
        transactions: 0, // Initialize transaction count
        timestamp: tx.blockTime || 0, // Initialize timestamp with the first tx time
        totalVolume: 0, // Initialize volume
        name:
          collectionInfo?.name ||
          `Collection ${tx.poolAddress.substring(0, 6)}...`, // Default name if not found
        collectionMint: collectionInfo?.collectionMint,
        nftCount: 0, // Initialize NFT count
        collectionFound: !!collectionInfo, // Track if collection info was linked
      });
    }

    const pool = poolMap.get(tx.poolAddress)!;

    // Update pool stats for relevant transaction types
    // Count all transactions related to the pool
    pool.transactions += 1;

    // Update timestamp if more recent
    if (tx.blockTime && tx.blockTime > pool.timestamp) {
      pool.timestamp = tx.blockTime;
    }

    // Add volume for buy/sell transactions (assuming tx.price exists for these)
    if (tx.price) {
      pool.totalVolume += tx.price;
    }

    // Count NFTs minted *into* this collection/pool
    if (tx.instructionName === "mintNft") {
      // Assuming 'mintNft' is the relevant instruction
      pool.nftCount += 1;
    }
  });

  // Filter out pools that likely aren't complete collections (e.g., no name found)
  // Decide if you want to filter or just display with default name
  // For now, let's keep all processed pools but perhaps refine the default name
  return Array.from(poolMap.values());
};

export const useNFTCollections = (limit: number = 6) => {
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [loading, setLoading] = useState(true); // Start loading
  const [error, setError] = useState<string | null>(null);

  // Get transaction history
  // The history hook manages its own loading and error states internally
  const {
    history,
    isLoading: historyLoading,
    error: historyError,
  } = useBondingCurveHistory(50); // Fetch history, maybe increase limit if needed

  useEffect(() => {
    // Start loading when history loading starts or history changes
    if (historyLoading) {
      setLoading(true);
      setError(null); // Clear previous errors
      return;
    }

    // If history loading finished and there's an error
    if (historyError) {
      setError(historyError);
      setLoading(false); // Stop loading on error
      setCollections([]); // Clear collections on error
      return;
    }

    // If history loading finished successfully (historyLoading is false and no historyError)
    // Process the history data
    const processData = async () => {
      // Use an async function inside useEffect if needed later, or keep it sync
      try {
        // Process transaction history to find all pool data
        const allPoolsData = processPoolDataFromHistory(history);

        // Determine trending status based on ALL processed pools by transaction count
        const sortedByActivityForTrending = [...allPoolsData].sort(
          (a, b) => b.transactions - a.transactions
        );
        const trendingPoolAddresses = new Set(
          sortedByActivityForTrending
            .slice(0, 3)
            .map((pool) => pool.poolAddress) // Top 3 pool addresses
        );

        // Sort all pools by most recent activity timestamp for display
        const sortedPoolsByRecency = [...allPoolsData].sort(
          (a, b) => b.timestamp - a.timestamp
        );

        // Take the top 'limit' most recent pools for display
        const topPoolsForDisplay = sortedPoolsByRecency.slice(0, limit);

        // Format collections for display
        const formattedCollections: NFTCollection[] = topPoolsForDisplay.map(
          (pool, index) => ({
            // Use a stable ID like poolAddress combined with index if poolAddress might be duplicate (unlikely)
            // Or just use index for simplicity if order is consistent
            id: index + 1, // Simple index as ID
            poolAddress: pool.poolAddress,
            title: pool.name,
            // Calculate floor price - ensure nftCount is > 0 to avoid division by zero
            floor: `${(pool.totalVolume / Math.max(pool.nftCount, 1)).toFixed(
              2
            )} SOL`,
            // Always use defaultNFT.png as the image for now
            image: "/defaultNFT.png",
            // Check if the pool's address is in the set of trending addresses
            trending: trendingPoolAddresses.has(pool.poolAddress),
            supply: pool.nftCount,
            collectionMint: pool.collectionMint,
          })
        );

        setCollections(formattedCollections);
      } catch (err) {
        console.error("Error processing NFT collections:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unknown error occurred during processing"
        );
        setCollections([]); // Clear collections on processing error
      } finally {
        setLoading(false); // Stop loading after processing
      }
    };

    // Only process data if history is loaded and no error
    if (!historyLoading && !historyError) {
      processData();
    }
  }, [history, historyLoading, historyError, limit]); // Dependencies include history and its states

  return { collections, loading, error };
};
