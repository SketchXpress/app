// hooks/useNFTCollections.ts
import { useState, useEffect } from "react";
import { NFTCollection } from "@/types/nft";
import {
  useBondingCurveHistory,
  HistoryItem,
} from "@/hooks/useBondingCurveHistory";

const VALID_NFT_IMAGES = [
  "/assets/images/defaultNFT.png",
  "/assets/images/nft1.jpeg",
  "/assets/images/nft2.avif",
  "/assets/images/nft3.jpg",
  "/assets/images/nft4.jpg",
  "/assets/images/nft5.png",
  "/assets/images/nft6.webp",
];

// Add this function to fetch metadata from URI
const fetchMetadataFromUri = async (
  uri: string
): Promise<{ name?: string; image?: string } | null> => {
  try {
    // Convert IPFS URI if necessary
    let metadataUrl = uri;
    if (uri.startsWith("ipfs://")) {
      metadataUrl = `https://ipfs.io/ipfs/${uri.substring(7)}`;
    } else if (uri.startsWith("ar://")) {
      metadataUrl = `https://arweave.net/${uri.substring(5)}`;
    }

    const response = await fetch(metadataUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status}`);
    }

    const metadata = await response.json();
    return {
      name: metadata.name,
      image: metadata.image,
    };
  } catch (error) {
    console.error("Error fetching metadata from URI:", error);
    return null;
  }
};

// Processing transaction history to find collections and their stats
const processPoolDataFromHistory = async (transactions: HistoryItem[]) => {
  const poolMap = new Map<
    string,
    {
      poolAddress: string;
      transactions: number;
      timestamp: number;
      totalVolume: number;
      lastMintPrice: number;
      lastMintTime: number;
      name: string;
      image?: string; // Add image field
      nftCount: number;
      collectionMint: string | undefined;
      collectionFound: boolean;
    }
  >();

  const collectionCreations = new Map<
    string,
    { name: string; symbol: string; uri?: string; image?: string }
  >();

  // First pass: Process collection creations and fetch metadata
  for (const tx of transactions) {
    if (tx.instructionName === "createCollectionNft" && tx.args) {
      const name = tx.args.name as string;
      const symbol = tx.args.symbol as string;
      const uri = tx.args.uri as string | undefined;

      console.log("--------------");
      console.log("Collection Name:", name);
      console.log("Symbol:", symbol);
      console.log("URI:", uri);

      // Fetch metadata from URI if available
      let metadata = null;
      if (uri) {
        metadata = await fetchMetadataFromUri(uri);
        if (metadata) {
          console.log("Fetched Name from metadata:", metadata.name);
          console.log("Fetched Image from metadata:", metadata.image);
        }
      }

      console.log("--------------");

      // Get the collection mint address from the accounts array in the transaction
      if (tx.accounts && tx.accounts.length > 1) {
        const collectionMintAddress = tx.accounts[1].toString();
        collectionCreations.set(collectionMintAddress, {
          name: metadata?.name || name, // Use metadata name if available
          symbol,
          uri,
          image: metadata?.image,
        });
      }
    }
  }

  // Map pool addresses to their collection mints using pool creation transactions
  const poolToCollectionMap = new Map<
    string,
    { name: string; collectionMint: string; image?: string }
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
            image: collection.image,
          });
        }
      }
    }
  });

  // Process all transactions to build the pool data
  transactions.forEach((tx) => {
    if (!tx.poolAddress) return;

    // Get or create pool entry
    if (!poolMap.has(tx.poolAddress)) {
      // Try to find collection info from our dynamic map
      const collectionInfo = poolToCollectionMap.get(tx.poolAddress);

      poolMap.set(tx.poolAddress, {
        poolAddress: tx.poolAddress,
        transactions: 0,
        timestamp: tx.blockTime || 0,
        totalVolume: 0,
        lastMintPrice: 0,
        lastMintTime: 0,
        name:
          collectionInfo?.name ||
          `Collection ${tx.poolAddress.substring(0, 6)}...`,
        image: collectionInfo?.image, // Include the image
        collectionMint: collectionInfo?.collectionMint,
        nftCount: 0,
        collectionFound: !!collectionInfo,
      });
    }

    const pool = poolMap.get(tx.poolAddress)!;

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
      pool.nftCount += 1;

      // If this mint transaction has a price and is more recent than our last recorded mint
      if (tx.price && tx.blockTime && tx.blockTime >= pool.lastMintTime) {
        pool.lastMintPrice = tx.price;
        pool.lastMintTime = tx.blockTime;
      }
    }
  });

  return Array.from(poolMap.values());
};

export const useNFTCollections = (limit: number = 6) => {
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [loading, setLoading] = useState(true); // Start loading
  const [error, setError] = useState<string | null>(null);

  // Get transaction history
  const {
    history,
    isLoading: historyLoading,
    error: historyError,
  } = useBondingCurveHistory(50);

  useEffect(() => {
    // Start loading when history loading starts or history changes
    if (historyLoading) {
      setLoading(true);
      setError(null);
      return;
    }

    // If history loading finished and there's an error
    if (historyError) {
      setError(historyError);
      setLoading(false);
      setCollections([]);
      return;
    }

    // If history loading finished successfully (historyLoading is false and no historyError)
    const processData = async () => {
      try {
        // Process transaction history to find all pool data (now async)
        const allPoolsData = await processPoolDataFromHistory(history);

        // Determine trending status based on ALL processed pools by transaction count
        const sortedByActivityForTrending = [...allPoolsData].sort(
          (a, b) => b.transactions - a.transactions
        );
        const trendingPoolAddresses = new Set(
          sortedByActivityForTrending
            .slice(0, 3)
            .map((pool) => pool.poolAddress)
        );

        // Sort all pools by most recent activity timestamp for display
        const sortedPoolsByRecency = [...allPoolsData].sort(
          (a, b) => b.timestamp - a.timestamp
        );

        // Take the top 'limit' most recent pools for display
        const topPoolsForDisplay = sortedPoolsByRecency.slice(0, limit);

        // Format collections for display
        const formattedCollections: NFTCollection[] = topPoolsForDisplay.map(
          (pool, index) => {
            // Use the dynamic image from metadata if available, otherwise fallback to placeholder
            let imagePath = pool.image;
            if (!imagePath) {
              // Fallback to placeholder images
              const imageIndex = index % VALID_NFT_IMAGES.length;
              imagePath = VALID_NFT_IMAGES[imageIndex];
            }

            return {
              id: index + 1, // Simple index as ID
              poolAddress: pool.poolAddress,
              title: pool.name,
              // Use last mint price as the floor price
              floor:
                pool.lastMintPrice > 0
                  ? `${pool.lastMintPrice.toFixed(2)} SOL`
                  : pool.nftCount > 0
                  ? // Fallback to average price if we have nfts but no last mint price
                    `${(pool.totalVolume / pool.nftCount).toFixed(2)} SOL`
                  : // Final fallback if no data is available
                    "N/A",
              // Use dynamic image from metadata or fallback
              image: imagePath,
              // Check if the pool's address is in the set of trending addresses
              trending: trendingPoolAddresses.has(pool.poolAddress),
              supply: pool.nftCount,
              collectionMint: pool.collectionMint,
            };
          }
        );

        setCollections(formattedCollections);
      } catch (err) {
        console.error("Error processing NFT collections:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unknown error occurred during processing"
        );
        setCollections([]);
      } finally {
        setLoading(false);
      }
    };

    // Only process data if history is loaded and no error
    if (!historyLoading && !historyError) {
      processData();
    }
  }, [history, historyLoading, historyError, limit]);

  return { collections, loading, error };
};
