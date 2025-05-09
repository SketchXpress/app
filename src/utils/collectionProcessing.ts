import { HistoryItem } from "@/types/bondingCurve";
import { Collection } from "@/types/collections";

/**
 * Process transaction history items into collection objects
 *
 * @param history Array of transaction history items
 * @param limit Maximum number of collections to return
 * @param sortBy How to sort the collections ('trending' or 'volume')
 * @returns Array of processed collections
 */
export function processCollectionsFromHistory(
  history: HistoryItem[],
  limit: number = 8,
  sortBy: "trending" | "volume" = "trending"
): Collection[] {
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
      collectionFound: boolean;
    }
  >();

  // Process transactions to find collection creation and pool creation
  const collectionCreations = new Map<
    string,
    { name: string; symbol: string }
  >();

  history.forEach((tx) => {
    if (
      tx.instructionName === "createCollectionNft" &&
      tx.args &&
      typeof tx.args === "object" &&
      tx.args &&
      "name" in tx.args &&
      "symbol" in tx.args
    ) {
      const name = tx.args.name as string;
      const symbol = tx.args.symbol as string;

      // Get the collection mint address from the accounts
      if (tx.accounts && tx.accounts.length > 1) {
        const collectionMintAddress = tx.accounts[1].toString();
        collectionCreations.set(collectionMintAddress, { name, symbol });
      }
    }
  });

  // Map pool addresses to collection names
  const poolToCollectionMap = new Map<string, string>();

  history.forEach((tx) => {
    if (
      tx.instructionName === "createPool" &&
      tx.accounts &&
      tx.accounts.length > 1 &&
      tx.poolAddress
    ) {
      const collectionMintAddress = tx.accounts[1].toString();

      if (tx.poolAddress && collectionCreations.has(collectionMintAddress)) {
        const collection = collectionCreations.get(collectionMintAddress);
        if (collection) {
          poolToCollectionMap.set(tx.poolAddress, collection.name);
        }
      }
    }
  });

  // Process transactions to find pool addresses and update stats
  history.forEach((tx) => {
    if (!tx.poolAddress) return;

    // Get or create pool entry
    if (!poolMap.has(tx.poolAddress)) {
      const collectionName = poolToCollectionMap.get(tx.poolAddress);

      poolMap.set(tx.poolAddress, {
        poolAddress: tx.poolAddress,
        transactions: 0,
        timestamp: tx.blockTime || 0,
        totalVolume: 0,
        name:
          collectionName || `Collection ${tx.poolAddress.substring(0, 6)}...`,
        nftCount: 0,
        collectionFound: !!collectionName,
      });
    }

    const pool = poolMap.get(tx.poolAddress)!;

    // Update transaction count
    pool.transactions += 1;

    // Update timestamp if more recent
    if (tx.blockTime && tx.blockTime > pool.timestamp) {
      pool.timestamp = tx.blockTime;
    }

    // Add volume if available
    if (tx.price) {
      pool.totalVolume += tx.price;
    }

    // Count NFTs minted for this collection
    if (tx.instructionName === "mintNft") {
      pool.nftCount += 1;
    }
  });

  let sortedPools = Array.from(poolMap.values());

  if (sortBy === "trending") {
    // Sort by most recent activity
    sortedPools.sort((a, b) => b.timestamp - a.timestamp);
  } else {
    // Sort by volume
    sortedPools.sort((a, b) => b.totalVolume - a.totalVolume);
  }

  sortedPools = sortedPools.slice(0, limit);

  return sortedPools.map((pool, index) => {
    // Generate a deterministic NFT image based on index
    const imageIndex = (index % 6) + 1;
    const imageExt = [".jpeg", ".avif", ".jpg", ".jpg", ".png", ".webp"][
      index % 6
    ];
    const imagePath = `/nft${imageIndex}${imageExt}`;

    return {
      id: pool.poolAddress,
      rank: index + 1,
      poolAddress: pool.poolAddress,
      name: pool.name,
      title: pool.name,
      image: imagePath,
      verified: pool.collectionFound,
      nftCount: pool.nftCount,
      supply: pool.nftCount > 0,
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

/**
 * Extract NFT image from collection index for consistent NFT display
 */
export function getCollectionImage(index: number): string {
  const imageIndex = (index % 6) + 1;
  const imageExt = [".jpeg", ".avif", ".jpg", ".jpg", ".png", ".webp"][
    index % 6
  ];
  return `/nft${imageIndex}${imageExt}`;
}
