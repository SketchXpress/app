import { HistoryItem } from "@/types/bondingCurve";
import { FormattedCollection } from "@/types/collections";

/**
 * Process transaction history items into collection objects
 *
 * @param history Array of transaction history items
 * @param limit Maximum number of collections to return
 * @param sortBy How to sort the collections ('trending' or 'volume')
 * @returns Array of processed collections with statistics
 */
export function processTrendingCollections(history: HistoryItem[]): Array<
  FormattedCollection & {
    poolAddress: string;
    timestamp: number;
    transactions: number;
  }
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
      nftCount: number;
      collectionFound: boolean;
    }
  >();

  // Step 1: Find all collection creation transactions
  const collectionCreations = new Map<
    string,
    { name: string; symbol: string }
  >();

  history.forEach((tx) => {
    if (
      tx.instructionName === "createCollectionNft" &&
      tx.args &&
      typeof tx.args === "object" &&
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

  const poolToCollectionMap = new Map<string, string>();

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
          poolToCollectionMap.set(tx.poolAddress, collection.name);
        }
      }
    }
  });

  // Now process all transactions to build the pool data
  history.forEach((tx) => {
    if (!tx.poolAddress) return;

    // Get or create pool entry
    if (!poolMap.has(tx.poolAddress)) {
      // Try to find collection name from our dynamic map
      const collectionName = poolToCollectionMap.get(tx.poolAddress);

      poolMap.set(tx.poolAddress, {
        poolAddress: tx.poolAddress,
        transactions: 0,
        timestamp: tx.blockTime || 0,
        totalVolume: 0,
        name: collectionName || `Collection ${tx.poolAddress.substring(0, 6)}`,
        nftCount: 0,
        collectionFound: !!collectionName,
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
    // Generate deterministic image path
    const imageIndex = (index % 6) + 1;
    const imageExt = [".jpeg", ".avif", ".jpg", ".jpg", ".png", ".webp"][
      index % 6
    ];
    const imagePath = `/nft${imageIndex}${imageExt}`;

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
