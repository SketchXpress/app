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

// Global cache for metadata to prevent re-fetching
const metadataCache = new Map<string, { name?: string; image?: string }>();

// Batch metadata fetching with caching
const fetchMetadataBatch = async (
  uris: string[]
): Promise<Map<string, { name?: string; image?: string }>> => {
  const results = new Map<string, { name?: string; image?: string }>();
  const uncachedUris = uris.filter((uri) => !metadataCache.has(uri));

  if (uncachedUris.length === 0) {
    uris.forEach((uri) => results.set(uri, metadataCache.get(uri)!));
    return results;
  }

  const batchSize = 5;
  for (let i = 0; i < uncachedUris.length; i += batchSize) {
    const batch = uncachedUris.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (uri) => {
        try {
          let metadataUrl = uri;

          if (uri.startsWith("ipfs://")) {
            metadataUrl = `https://ipfs.io/ipfs/${uri.substring(7)}`;
          } else if (uri.startsWith("ar://")) {
            metadataUrl = `https://arweave.net/${uri.substring(5)}`;
          } else if (
            !uri.startsWith("http://") &&
            !uri.startsWith("https://")
          ) {
            // missing protocol → force HTTPS
            metadataUrl = `https://${uri}`;
          }

          const response = await fetch(
            `/api/metadata?uri=${encodeURIComponent(metadataUrl)}`
          );
          if (!response.ok) return;

          const metadata = await response.json();
          const result = { name: metadata.name, image: metadata.image };

          metadataCache.set(uri, result);
          results.set(uri, result);
        } catch (error) {
          console.error(`Error fetching metadata for ${uri}:`, error);
          metadataCache.set(uri, {});
        }
      })
    );

    if (i + batchSize < uncachedUris.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  // fill in any cached-only URIs
  uris.forEach((uri) => {
    if (!results.has(uri)) results.set(uri, metadataCache.get(uri)!);
  });

  return results;
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
      image?: string;
      nftCount: number;
      collectionMint: string | undefined;
      collectionFound: boolean;
      uri?: string; // Store URI for batch fetching
    }
  >();

  const collectionCreations = new Map<
    string,
    { name: string; symbol: string; uri?: string; image?: string }
  >();

  // First pass: Collect all collection creations (no fetching yet)
  for (const tx of transactions) {
    if (tx.instructionName === "createCollectionNft" && tx.args) {
      const name = tx.args.name as string;
      const symbol = tx.args.symbol as string;
      const uri = tx.args.uri as string | undefined;

      if (tx.accounts && tx.accounts.length > 1) {
        const collectionMintAddress = tx.accounts[1].toString();
        collectionCreations.set(collectionMintAddress, {
          name,
          symbol,
          uri,
        });
      }
    }
  }

  // Map pool addresses to their collection info
  const poolToCollectionMap = new Map<
    string,
    { name: string; collectionMint: string; uri?: string }
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
            uri: collection.uri,
          });
        }
      }
    }
  });

  // Process all transactions to build the pool data
  transactions.forEach((tx) => {
    if (!tx.poolAddress) return;

    if (!poolMap.has(tx.poolAddress)) {
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
        collectionMint: collectionInfo?.collectionMint,
        nftCount: 0,
        collectionFound: !!collectionInfo,
        uri: collectionInfo?.uri, // Store URI for later batch fetching
      });
    }

    const pool = poolMap.get(tx.poolAddress)!;
    pool.transactions += 1;

    if (tx.blockTime && tx.blockTime > pool.timestamp) {
      pool.timestamp = tx.blockTime;
    }

    if (tx.price) {
      pool.totalVolume += tx.price;
    }

    if (tx.instructionName === "mintNft") {
      pool.nftCount += 1;

      if (tx.price && tx.blockTime && tx.blockTime >= pool.lastMintTime) {
        pool.lastMintPrice = tx.price;
        pool.lastMintTime = tx.blockTime;
      }
    }
  });

  const poolsArray = Array.from(poolMap.values());

  // Collect all URIs that need fetching
  const urisToFetch = poolsArray
    .filter((pool) => pool.uri && !pool.image)
    .map((pool) => pool.uri!)
    .filter((uri, index, self) => self.indexOf(uri) === index); // Remove duplicates

  // Batch fetch metadata
  if (urisToFetch.length > 0) {
    const metadataResults = await fetchMetadataBatch(urisToFetch);

    // Update pools with fetched metadata
    poolsArray.forEach((pool) => {
      if (pool.uri && metadataResults.has(pool.uri)) {
        const metadata = metadataResults.get(pool.uri);
        if (metadata) {
          pool.name = metadata.name || pool.name;
          pool.image = metadata.image;
        }
      }
    });
  }

  return poolsArray;
};

export const useNFTCollections = (limit: number = 6) => {
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    history,
    isLoading: historyLoading,
    error: historyError,
  } = useBondingCurveHistory(50);

  useEffect(() => {
    if (historyLoading) {
      setLoading(true);
      setError(null);
      return;
    }

    if (historyError) {
      setError(historyError);
      setLoading(false);
      setCollections([]);
      return;
    }

    const processData = async () => {
      try {
        setLoading(true);

        // Process transaction history with batch metadata fetching
        const allPoolsData = await processPoolDataFromHistory(history);

        // Determine trending status
        const sortedByActivityForTrending = [...allPoolsData].sort(
          (a, b) => b.transactions - a.transactions
        );
        const trendingPoolAddresses = new Set(
          sortedByActivityForTrending
            .slice(0, 3)
            .map((pool) => pool.poolAddress)
        );

        // Sort by recency for display
        const sortedPoolsByRecency = [...allPoolsData].sort(
          (a, b) => b.timestamp - a.timestamp
        );

        const topPoolsForDisplay = sortedPoolsByRecency.slice(0, limit);

        // Format collections with stable image selection
        const formattedCollections: NFTCollection[] = topPoolsForDisplay.map(
          (pool, index) => {
            let imagePath = pool.image;
            if (!imagePath) {
              // Use deterministic image selection based on pool address
              const hash = pool.poolAddress
                .split("")
                .reduce((acc, char) => acc + char.charCodeAt(0), 0);
              const imageIndex = hash % VALID_NFT_IMAGES.length;
              imagePath = VALID_NFT_IMAGES[imageIndex];
            }

            return {
              id: index + 1,
              poolAddress: pool.poolAddress,
              title: pool.name,
              floor:
                pool.lastMintPrice > 0
                  ? `${pool.lastMintPrice.toFixed(2)} SOL`
                  : pool.nftCount > 0
                  ? `${(pool.totalVolume / pool.nftCount).toFixed(2)} SOL`
                  : "N/A",
              image: imagePath,
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

    if (!historyLoading && !historyError) {
      processData();
    }
  }, [history, historyLoading, historyError, limit]);

  return { collections, loading, error };
};
