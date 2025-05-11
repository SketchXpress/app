import { HistoryItem } from "@/types/bondingCurve";
import { FormattedCollection } from "@/types/collections";

/**
 * Fetch metadata from URI (IPFS or Arweave)
 * @param uri The URI to fetch metadata from
 * @returns Metadata object with name and image, or null if fetch fails
 */
async function fetchMetadataFromUri(
  uri: string
): Promise<{ name?: string; image?: string } | null> {
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
}

/**
 * Process transaction history items into collection objects
 *
 * @param history Array of transaction history items
 * @returns Array of processed collections with statistics
 */
export async function processTrendingCollections(
  history: HistoryItem[]
): Promise<
  Array<
    FormattedCollection & {
      poolAddress: string;
      timestamp: number;
      transactions: number;
    }
  >
> {
  if (!Array.isArray(history) || history.length === 0) {
    return [];
  }

  // Group transactions by pool address
  const poolMap = new Map<
    string,
    {
      poolAddress: string;
      transactions: number;
      timestamp: number;
      totalVolume: number;
      name: string;
      image?: string;
      nftCount: number;
      collectionFound: boolean;
    }
  >();

  // Step 1: Find all collection creation transactions and fetch metadata
  const collectionCreations = new Map<
    string,
    { name: string; symbol: string; image?: string }
  >();

  // Process collection creations and fetch metadata
  for (const tx of history) {
    if (
      tx.instructionName === "createCollectionNft" &&
      tx.args &&
      typeof tx.args === "object" &&
      "name" in tx.args &&
      "symbol" in tx.args
    ) {
      const name = tx.args.name as string;
      const symbol = tx.args.symbol as string;
      const uri = "uri" in tx.args ? (tx.args.uri as string) : undefined;

      // Fetch metadata if URI is available
      let metadata = null;
      if (uri) {
        metadata = await fetchMetadataFromUri(uri);
      }

      // Get the collection mint address from the accounts
      if (tx.accounts && tx.accounts.length > 1) {
        const collectionMintAddress = tx.accounts[1].toString();
        collectionCreations.set(collectionMintAddress, {
          name: metadata?.name || name, // Use metadata name if available
          symbol,
          image: metadata?.image,
        });
      }
    }
  }

  const poolToCollectionMap = new Map<
    string,
    { name: string; image?: string }
  >();

  history.forEach((tx) => {
    if (
      tx.instructionName === "createPool" &&
      tx.accounts &&
      tx.accounts.length > 1 &&
      tx.poolAddress
    ) {
      const collectionMintAddress = tx.accounts[1].toString();

      if (collectionCreations.has(collectionMintAddress)) {
        const collection = collectionCreations.get(collectionMintAddress);
        if (collection) {
          poolToCollectionMap.set(tx.poolAddress, {
            name: collection.name,
            image: collection.image,
          });
        }
      }
    }
  });

  // Now process all transactions to build the pool data
  history.forEach((tx) => {
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
        name:
          collectionInfo?.name ||
          `Collection ${tx.poolAddress.substring(0, 6)}`,
        image: collectionInfo?.image,
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

  // Return array of pool data
  return Array.from(poolMap.values()).map((pool, index) => {
    // Use dynamic image if available, otherwise fallback to deterministic image path
    let imagePath = pool.image;
    if (!imagePath) {
      // Generate deterministic image path as fallback
      const imageIndex = (index % 6) + 1;
      const imageExt = [".jpeg", ".avif", ".jpg", ".jpg", ".png", ".webp"][
        index % 6
      ];
      imagePath = `/assets/images/nft${imageIndex}${imageExt}`;
    }

    return {
      id: pool.poolAddress,
      poolAddress: pool.poolAddress,
      rank: index + 1,
      name: pool.name,
      image: imagePath,
      verified: pool.collectionFound,
      nftCount: pool.nftCount,
      totalVolume: pool.totalVolume,
      floor: `${(pool.totalVolume / Math.max(pool.nftCount, 1)).toFixed(
        2
      )} SOL`,
      trending: index < 3,
      timestamp: pool.timestamp,
      transactions: pool.transactions,
    };
  });
}

export default processTrendingCollections;
