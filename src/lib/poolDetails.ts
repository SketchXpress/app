/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PoolInfo, NFT, HistoryItem } from "@/stores/collectionsStore";
import { PublicKey } from "@solana/web3.js"; // Assuming PublicKey is available

export interface PoolDetails {
  info: PoolInfo;
  nfts: NFT[];
  history: HistoryItem[];
}

// Helper function to determine if pool data is stale
export function isPoolDataStale(lastUpdated: number, maxAge = 60000): boolean {
  return Date.now() - lastUpdated > maxAge;
}

// Fetch pool info from the anchor program (with collection name fetching)
async function fetchPoolInfo(
  poolAddress: string,
  program: any
): Promise<PoolInfo> {
  try {
    const poolKey = new PublicKey(poolAddress);
    const poolDataRaw = await program.account.bondingCurvePool.fetch(poolKey);

    const formatLamports = (lamports: any) =>
      lamports.toNumber() / 1_000_000_000;

    const totalEscrowedSol = formatLamports(poolDataRaw.totalEscrowed);
    const migrationThreshold = 690; // 690 SOL

    const migrationStatus = !poolDataRaw.isActive
      ? "Migrated (Pool Frozen)"
      : totalEscrowedSol >= migrationThreshold
      ? "Ready for migration (Threshold Met)"
      : "Not eligible for migration yet";

    const progressPercentage = Math.min(
      (totalEscrowedSol / migrationThreshold) * 100,
      100
    );

    const migrationProgress =
      totalEscrowedSol >= migrationThreshold
        ? "Threshold reached! (690 SOL)"
        : `Progress: ${totalEscrowedSol.toFixed(
            4
          )} / ${migrationThreshold} SOL (${progressPercentage.toFixed(1)}%)`;

    const collectionAddrStr = poolDataRaw.collection.toString();

    let collectionName = collectionAddrStr; // Fallback to address

    try {
      const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
      if (HELIUS_API_KEY) {
        const RPC_URL = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
        const response = await fetch(RPC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "collection-name",
            method: "getAsset",
            params: { id: collectionAddrStr },
          }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.result?.content?.metadata?.name) {
            collectionName = data.result.content.metadata.name;
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Could not fetch collection name: ${error}`);
    }

    const result: PoolInfo = {
      collection: collectionAddrStr,
      creator: poolDataRaw.creator.toString(),
      basePrice: formatLamports(poolDataRaw.basePrice),
      growthFactor: poolDataRaw.growthFactor.toNumber() / 1_000_000,
      currentSupply: poolDataRaw.currentSupply.toNumber(),
      protocolFeePercent: poolDataRaw.protocolFee.toNumber() / 100,
      totalEscrowed: totalEscrowedSol,
      isActive: poolDataRaw.isActive,
      migrationStatus,
      migrationProgress,
      collectionName,
    };

    return result;
  } catch (error) {
    console.error(`❌ Error fetching pool info for ${poolAddress}:`, error);
    throw new Error(`Failed to fetch pool info: ${error}`);
  }
}

// NEW: Function to fetch transaction history (simplified concept)
async function fetchTransactionHistoryFromHelius(
  poolAddress: string
): Promise<HistoryItem[]> {
  const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
  if (!HELIUS_API_KEY) {
    console.warn("Helius API key not found, cannot fetch transaction history.");
    return [];
  }

  // This is a conceptual endpoint and might need adjustment to the actual Helius API
  // e.g., using /v0/addresses/{poolAddress}/transactions or a specific parsed transaction endpoint
  const API_URL = `https://api.helius.xyz/v0/addresses/${poolAddress}/transactions?api-key=${HELIUS_API_KEY}&type=NFT_MINT,NFT_SALE`; // Example, actual API might differ

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      console.error(
        `Error fetching Helius transactions: ${response.statusText}`
      );
      return [];
    }
    const rawTxs = await response.json();

    // Map raw Helius transactions to HistoryItem[]
    // This mapping is highly dependent on the actual Helius API response structure
    // For demonstration, we assume a structure that can be mapped.
    const historyItems: HistoryItem[] = rawTxs
      .map((tx: any) => {
        // Simplified mapping - actual Helius data is more complex
        // We need to derive instructionName, args, price, accounts etc.
        // This part would require detailed knowledge of Helius's specific API for parsed transactions for this program.
        let instructionName = "unknown";
        let price = undefined;
        let args = {};
        const accounts = (tx.accountData || []).map(
          (acc: { account: string }) => new PublicKey(acc.account)
        );

        // Example: Try to determine instructionName and price from Helius data
        if (tx.type === "NFT_MINT" && tx.description?.includes(poolAddress)) {
          instructionName = "mintNft";
          price = tx.events?.nft?.amount
            ? tx.events.nft.amount / 1e9
            : undefined; // SOL
          args = {
            name:
              tx.description?.split("Minted ")[1]?.split(" into")[0] ||
              "Unknown NFT",
          }; // Highly speculative parsing
        } else if (
          tx.type === "NFT_SALE" &&
          tx.description?.includes(poolAddress)
        ) {
          instructionName = "sellNft";
          price = tx.events?.nft?.amount
            ? tx.events.nft.amount / 1e9
            : undefined;
        }

        return {
          signature: tx.signature,
          blockTime: tx.timestamp,
          instructionName: instructionName,
          poolAddress: poolAddress, // Add poolAddress here
          accounts: accounts, // Placeholder, needs proper mapping
          args: args, // Placeholder
          price: price, // Placeholder
          // Other fields as needed by HistoryItem type
        } as HistoryItem;
      })
      .filter((item: HistoryItem) => item.instructionName !== "unknown"); // Filter out unparsed

    return historyItems.sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0)); // Newest first
  } catch (error) {
    console.error(
      `❌ Error fetching or parsing Helius transaction history for ${poolAddress}:`,
      error
    );
    return [];
  }
}

// Main function to fetch all pool data
export async function fetchAllPoolData(
  poolAddress: string,
  program: any,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _unusedHistoryParam: HistoryItem[] = [] // Parameter kept for signature compatibility, but not used as primary source
): Promise<PoolDetails> {
  try {
    const info = await fetchPoolInfo(poolAddress, program);

    // Fetch transaction history to derive NFTs and history list
    const fullHistory: HistoryItem[] = await fetchTransactionHistoryFromHelius(
      poolAddress
    );

    const nfts: NFT[] = fullHistory
      .filter(
        (tx) =>
          tx.instructionName === "mintNft" &&
          tx.poolAddress === poolAddress && // Ensure it's for this pool
          tx.accounts &&
          tx.accounts.length > 1
      )
      .map((tx) => {
        const { name, symbol, uri } = (tx.args as any) || {};
        // accounts[0] is often payer/minter, accounts[1] is often the new mint
        const minterAddress = tx.accounts[0]?.toString();
        const mintAddress = tx.accounts[1]?.toString();

        return {
          mintAddress: mintAddress || tx.signature, // Fallback for mintAddress
          name: name || "Unnamed NFT",
          symbol: symbol || "",
          uri: uri || "",
          timestamp: tx.blockTime || Date.now() / 1000, // Ensure timestamp is a number
          signature: tx.signature,
          price: tx.price,
          minterAddress: minterAddress,
        };
      })
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); // Newest first

    return { info, nfts, history: fullHistory };
  } catch (error) {
    console.error(`❌ Error fetching all pool data for ${poolAddress}:`, error);
    // If info fetch failed, rethrow. Otherwise, try to return partial data or a clear error state.
    if (
      error instanceof Error &&
      error.message.includes("Failed to fetch pool info")
    ) {
      throw error;
    }
    // Fallback for other errors during history/nft processing
    const minimalInfo = {
      collection: poolAddress,
      creator: "Unknown",
      basePrice: 0,
      growthFactor: 0,
      currentSupply: 0,
      protocolFeePercent: 0,
      totalEscrowed: 0,
      isActive: false,
      migrationStatus: "Error",
      migrationProgress: "Error",
      collectionName: "Error",
    } as PoolInfo;
    return { info: minimalInfo, nfts: [], history: [] };
  }
}

// Helper function to merge pool data
export function mergePoolData(
  existing: PoolDetails,
  updates: Partial<PoolDetails>
): PoolDetails {
  return {
    ...existing,
    ...updates,
  };
}
