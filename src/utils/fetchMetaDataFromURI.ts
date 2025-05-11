import { HistoryItem } from "@/types/bondingCurve";

// Add this function to fetch metadata from URI
export const fetchMetadataFromUri = async (
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

// Modify your existing function to include metadata fetching
export const processPoolDataFromHistory = async (
  transactions: HistoryItem[]
) => {
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
      const args = tx.args as { name?: string; symbol?: string; uri?: string };
      const name = args.name ?? "";
      const symbol = args.symbol ?? "";
      const uri = args.uri;

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

    // Rest of your existing processing logic...
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

  return Array.from(poolMap.values());
};
