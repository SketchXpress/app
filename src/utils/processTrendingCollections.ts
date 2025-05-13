// utils/processTrendingCollections.ts
import { HistoryItem } from "@/hook/api/helius/"; // Adjust import path as needed

export interface PoolData {
  poolAddress: string;
  transactions: number;
  timestamp: number;
  totalVolume: number;
  lastMintPrice: number;
  lastMintTime: number;
  name: string;
  image?: string;
  uri?: string;
  nftCount: number;
  collectionMint?: string;
  collectionFound: boolean;
}

export const processTrendingCollections = async (
  history: HistoryItem[]
): Promise<PoolData[]> => {
  const poolsData = new Map<string, PoolData>();
  const collectionCreations = new Map<
    string,
    { name: string; symbol: string; uri?: string }
  >();
  const poolToCollectionMap = new Map<
    string,
    { name: string; uri?: string; image?: string }
  >();

  // First pass: Collect all collection creations
  console.log("Processing collection creations...");
  history.forEach((tx) => {
    if (tx.instructionName === "createCollectionNft" && tx.args) {
      const name = tx.args.name as string;
      const symbol = tx.args.symbol as string;
      const uri = tx.args.uri as string | undefined;

      if (tx.accounts && tx.accounts.length > 1) {
        const collectionMintAddress = tx.accounts[1].toString();
        console.log(
          `Found collection creation: ${name} (${collectionMintAddress}) with URI: ${uri}`
        );

        collectionCreations.set(collectionMintAddress, {
          name,
          symbol,
          uri,
        });
      }
    }
  });

  // You mentioned you have metadataResults - this seems to be from another process
  // If you have this data, include it here, otherwise we'll rely on URIs for fetching
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metadataResults: any[] = []; // Replace with your actual metadataResults if available

  // Second pass: Map pools to their collections
  console.log("Mapping pools to collections...");
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
          // Check if you have pre-fetched metadata
          const correspondingMetadata = metadataResults.find(
            (result) =>
              result.status === "fulfilled" &&
              result.value.mintAddress === collectionMintAddress
          );

          poolToCollectionMap.set(tx.poolAddress, {
            name: collection.name,
            uri: collection.uri, // ← IMPORTANT: Include URI
            image:
              correspondingMetadata?.status === "fulfilled"
                ? correspondingMetadata.value.metadata?.image
                : undefined,
          });

          console.log(
            `Mapped pool ${tx.poolAddress} to collection ${collection.name} with URI: ${collection.uri}`
          );
        }
      }
    }
  });

  // Third pass: Process all transactions to build pool statistics
  console.log("Processing pool transactions...");
  history.forEach((tx) => {
    if (!tx.poolAddress) return;

    // Initialize pool data if not exists
    if (!poolsData.has(tx.poolAddress)) {
      const collectionInfo = poolToCollectionMap.get(tx.poolAddress);

      poolsData.set(tx.poolAddress, {
        poolAddress: tx.poolAddress,
        transactions: 0,
        timestamp: tx.blockTime || 0,
        totalVolume: 0,
        lastMintPrice: 0,
        lastMintTime: 0,
        name:
          collectionInfo?.name ||
          `Collection ${tx.poolAddress.substring(0, 6)}...`,
        image: collectionInfo?.image,
        uri: collectionInfo?.uri, // ← IMPORTANT: Include URI
        nftCount: 0,
        collectionMint: collectionCreations.has(
          tx.accounts?.[1]?.toString() || ""
        )
          ? tx.accounts![1].toString()
          : undefined,
        collectionFound: !!collectionInfo,
      });
    }

    const pool = poolsData.get(tx.poolAddress)!;

    // Update pool statistics
    pool.transactions += 1;

    // Update timestamp to latest
    if (tx.blockTime && tx.blockTime > pool.timestamp) {
      pool.timestamp = tx.blockTime;
    }

    // Add to total volume
    if (tx.price) {
      pool.totalVolume += tx.price;
    }

    // Track NFT mints
    if (tx.instructionName === "mintNft") {
      pool.nftCount += 1;

      // Update last mint price
      if (tx.price && tx.blockTime && tx.blockTime >= pool.lastMintTime) {
        pool.lastMintPrice = tx.price;
        pool.lastMintTime = tx.blockTime;
      }
    }
  });

  const result = Array.from(poolsData.values());
  console.log(`Processed ${result.length} pools:`, result);

  return result;
};
