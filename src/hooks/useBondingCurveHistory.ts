/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from "react";
import { PublicKey, LAMPORTS_PER_SOL, Connection } from "@solana/web3.js";
import {
  AnchorProvider,
  Idl,
  BorshInstructionCoder,
  Program,
} from "@coral-xyz/anchor";
import { IDL as BondingCurveIDL, PROGRAM_ID } from "../utils/idl";

// Define interfaces for Helius API responses
interface NativeTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number;
}

interface HeliusTransaction {
  signature: string;
  description?: string;
  type?: string;
  source?: string;
  fee?: number;
  feePayer: string;
  slot?: number;
  timestamp?: number;
  nativeTransfers?: NativeTransfer[];
  tokenTransfers?: any[];
  accountData?: any[];
  transactionError?: any;
  instructions: any[];
  events?: any;
}

// Export the HistoryItem interface
export interface HistoryItem {
  signature: string;
  blockTime: number | null | undefined;
  instructionName: string;
  accounts: PublicKey[];
  args: any;
  description: string;
  type: string;
  source: string;
  error: any;
  poolAddress?: string; // Added: Pool address involved
  price?: number; // Added: Price in SOL
}

// Helius API endpoint (hardcoded as requested)
const HELIUS_API_KEY = "69b4db73-1ed1-4558-8e85-192e0994e556";
const HELIUS_API_BASE = "https://api-devnet.helius.xyz/v0"; // Use devnet endpoint
const programId = new PublicKey(PROGRAM_ID);
const DEFAULT_LIMIT = 5;

// Cache settings
const DEFAULT_MAX_CACHE_SIZE = 500; // Maximum number of transactions to cache
const DEFAULT_CACHE_TTL = 60 * 60 * 1000; // Cache time-to-live in ms (1 hour)
const DEFAULT_BATCH_SIZE = 5; // Number of transactions to request in a batch
const DEFAULT_BATCH_DELAY = 1000; // Delay between batches in ms
const DEFAULT_MAX_RETRIES = 3; // Maximum number of retries for a request

// Helper function to find account index by name in IDL
const findAccountIndex = (idlInstruction: any, accountName: string): number => {
  if (!idlInstruction || !idlInstruction.accounts) return -1;
  return idlInstruction.accounts.findIndex(
    (acc: any) => acc.name === accountName
  );
};

// Helper function for delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useBondingCurveHistory(
  limit: number = 50,
  maxCacheSize: number = DEFAULT_MAX_CACHE_SIZE,
  cacheTTL: number = DEFAULT_CACHE_TTL,
  batchSize: number = DEFAULT_BATCH_SIZE,
  batchDelay: number = DEFAULT_BATCH_DELAY,
  maxRetries: number = DEFAULT_MAX_RETRIES
) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [canLoadMore, setCanLoadMore] = useState<boolean>(true);
  const [lastSignature, setLastSignature] = useState<string | undefined>(
    undefined
  );
  const [transactionCache, setTransactionCache] = useState<
    Map<string, HistoryItem>
  >(new Map());
  const [signatureCache, setSignatureCache] = useState<Set<string>>(new Set());
  const [lastRequestTime, setLastRequestTime] = useState<number>(0);

  // Keep connection/provider for Anchor Coder
  const connection = new Connection(
    `${HELIUS_API_BASE}/?api-key=${HELIUS_API_KEY}`,
    "confirmed"
  );
  const provider = new AnchorProvider(connection, {} as any, {
    commitment: "confirmed",
  });
  const program = new Program(BondingCurveIDL as Idl, programId, provider);
  const instructionCoder = program.coder.instruction as BorshInstructionCoder;

  // Helper function for fetch with retry logic
  const fetchWithRetry = useCallback(
    async (url: string, options: any) => {
      let retries = 0;

      while (retries < maxRetries) {
        try {
          // Add delay to prevent hitting rate limits
          const now = Date.now();
          const timeSinceLastRequest = now - lastRequestTime;

          if (timeSinceLastRequest < 1000) {
            // 1 second minimum between requests
            await delay(1000 - timeSinceLastRequest);
          }

          setLastRequestTime(Date.now());

          const response = await fetch(url, options);
          if (!response.ok) {
            if (response.status === 429) {
              // Calculate backoff time: 1s, 2s, 4s, etc.
              const backoffTime = Math.pow(2, retries) * 1000;
              console.log(
                `Rate limited. Retrying in ${backoffTime / 1000}s...`
              );
              await delay(backoffTime);
              retries++;
              continue;
            }

            // Handle other error codes
            const errorData = await response
              .json()
              .catch(() => ({ message: response.statusText }));
            throw new Error(
              `API Error: ${response.status} - ${
                errorData.message || "Request failed"
              }`
            );
          }
          return response;
        } catch (err) {
          if (retries === maxRetries - 1) throw err;
          retries++;
        }
      }

      throw new Error(`Failed after ${maxRetries} retries`);
    },
    [maxRetries, lastRequestTime]
  );

  // Process transaction data
  const processTransaction = useCallback(
    (tx: HeliusTransaction, basicInfo: any): HistoryItem | null => {
      let decodedName = "Unknown";
      let decodedArgs: any = {};
      let decodedAccounts: PublicKey[] = [];
      let poolAddress: string | undefined = undefined;
      let escrowAddress: string | undefined = undefined;
      let price: number | undefined = undefined;
      let relevantInstruction: any = undefined;
      let mainProgramInstructionIndex = -1;

      if (tx.instructions && Array.isArray(tx.instructions)) {
        mainProgramInstructionIndex = tx.instructions.findIndex(
          (ix: any) => ix.programId === programId.toBase58() && ix.data
        );
        relevantInstruction = tx.instructions[mainProgramInstructionIndex];

        if (relevantInstruction) {
          try {
            const decoded = instructionCoder.decode(
              relevantInstruction.data,
              "base58"
            );
            if (decoded) {
              decodedName = decoded.name;
              decodedArgs = decoded.data;
              if (
                relevantInstruction.accounts &&
                Array.isArray(relevantInstruction.accounts)
              ) {
                decodedAccounts = relevantInstruction.accounts.map(
                  (acc: string) => new PublicKey(acc)
                );

                const idlInstruction = BondingCurveIDL.instructions.find(
                  (ix) => ix.name === decodedName
                );

                const poolAccountIndex = findAccountIndex(
                  idlInstruction,
                  "pool"
                );
                if (
                  poolAccountIndex !== -1 &&
                  relevantInstruction.accounts.length > poolAccountIndex
                ) {
                  poolAddress = relevantInstruction.accounts[poolAccountIndex];
                }

                if (decodedName === "mintNft" || decodedName === "sellNft") {
                  const escrowAccountIndex = findAccountIndex(
                    idlInstruction,
                    "escrow"
                  );
                  if (
                    escrowAccountIndex !== -1 &&
                    relevantInstruction.accounts.length > escrowAccountIndex
                  ) {
                    escrowAddress =
                      relevantInstruction.accounts[escrowAccountIndex];
                  }
                }
              }
            }
          } catch (e) {
            console.error(`[${tx.signature}] Error decoding instruction:`, e);
          }
        }

        // --- Price Extraction using nativeTransfers ---
        if (
          tx.nativeTransfers &&
          Array.isArray(tx.nativeTransfers) &&
          escrowAddress
        ) {
          if (decodedName === "mintNft") {
            const payer = tx.feePayer;

            // Finding the LARGEST transfer for mintNft
            const transfersToEscrow = tx.nativeTransfers
              .filter(
                (transfer: NativeTransfer) =>
                  transfer.fromUserAccount === payer &&
                  transfer.toUserAccount === escrowAddress
              )
              .sort((a, b) => b.amount - a.amount); // Sort by amount descending

            if (transfersToEscrow.length > 0) {
              // Use the largest transfer as the price
              price = transfersToEscrow[0].amount / LAMPORTS_PER_SOL;
            } else {
              console.log(
                `[${tx.signature}] ❌ No matching transfer found for mintNft`
              );
            }
          } else if (decodedName === "sellNft") {
            const seller = tx.feePayer;

            // Finding the LARGEST transfer for sellNft
            const transfersFromEscrow = tx.nativeTransfers
              .filter(
                (transfer: NativeTransfer) =>
                  transfer.fromUserAccount === escrowAddress &&
                  transfer.toUserAccount === seller
              )
              .sort((a, b) => b.amount - a.amount); // Sort by amount descending

            if (transfersFromEscrow.length > 0) {
              // Use the largest transfer as the price
              price = transfersFromEscrow[0].amount / LAMPORTS_PER_SOL;
            } else {
              console.log(
                `[${tx.signature}] ❌ No matching transfer found for sellNft`
              );
            }
          }
        }
      }

      return {
        signature: tx.signature,
        blockTime: basicInfo.timestamp, // Use timestamp from first API call
        instructionName: decodedName,
        accounts: decodedAccounts,
        args: decodedArgs,
        description: tx.description || "",
        type: tx.type || "",
        source: tx.source || "",
        error: tx.transactionError,
        poolAddress: poolAddress,
        price: price,
      };
    },
    [instructionCoder]
  );

  // const fetchHeliusHistory = useCallback(
  //   async (fetchBeforeSignature?: string) => {
  //     if (isLoading) return;
  //     setIsLoading(true);
  //     setError(null);

  //     try {
  //       // ensure we never send NaN, zero, or negative limits
  //       const safeLimit =
  //         Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT;

  //       // Step 1: Get signatures and basic info using /addresses endpoint
  //       let signaturesUrl =
  //         `${HELIUS_API_BASE}/addresses/${programId.toBase58()}/transactions` +
  //         `?api-key=${HELIUS_API_KEY}&limit=${safeLimit}`;
  //       if (fetchBeforeSignature) {
  //         signaturesUrl += `&before=${fetchBeforeSignature}`;
  //       }

  //       const signaturesResponse = await fetchWithRetry(signaturesUrl, {});
  //       if (!signaturesResponse) {
  //         throw new Error("Failed to fetch signatures");
  //       }
  //       const signaturesResponseData = await signaturesResponse.json();

  //       if (!Array.isArray(signaturesResponseData)) {
  //         throw new Error(
  //           "Unexpected response format from Helius Signatures API"
  //         );
  //       }
  //       if (signaturesResponseData.length === 0) {
  //         setCanLoadMore(false);
  //         setIsLoading(false);
  //         return;
  //       }
  //       if (signaturesResponseData.length < safeLimit) {
  //         setCanLoadMore(false);
  //       }

  //       // Filter out signatures we've already processed
  //       const newSignatures = signaturesResponseData
  //         .map((tx) => tx.signature)
  //         .filter((sig) => !signatureCache.has(sig));

  //       // Map basic info (timestamp) for later decoding
  //       const basicInfoMap = new Map(
  //         signaturesResponseData.map((tx) => [
  //           tx.signature,
  //           { timestamp: tx.timestamp },
  //         ])
  //       );

  //       // Update lastSignature cursor
  //       const lastSig =
  //         signaturesResponseData[signaturesResponseData.length - 1].signature;
  //       setLastSignature(lastSig);

  //       // If nothing new, bail
  //       if (newSignatures.length === 0) {
  //         setIsLoading(false);
  //         return;
  //       }

  //       // Add to signatureCache
  //       setSignatureCache((prev) => {
  //         const cache = new Set(prev);
  //         newSignatures.forEach((s) => cache.add(s));
  //         return cache;
  //       });

  //       // Step 2: Fetch detailed txs in batches
  //       const transactionsUrl = `${HELIUS_API_BASE}/transactions?api-key=${HELIUS_API_KEY}`;
  //       const parsedHistory: HistoryItem[] = [];

  //       for (let i = 0; i < newSignatures.length; i += batchSize) {
  //         const batch = newSignatures.slice(i, i + batchSize);
  //         if (i > 0) {
  //           await delay(batchDelay);
  //         }
  //         const detailRes = await fetchWithRetry(transactionsUrl, {
  //           method: "POST",
  //           headers: { "Content-Type": "application/json" },
  //           body: JSON.stringify({ transactions: batch }),
  //         });
  //         if (!detailRes) {
  //           throw new Error("Failed to fetch transaction details");
  //         }
  //         const batchTxs = await detailRes.json();
  //         if (!Array.isArray(batchTxs)) {
  //           throw new Error(
  //             "Unexpected response format from Helius Transactions API"
  //           );
  //         }

  //         batchTxs.forEach((tx: HeliusTransaction) => {
  //           const info = basicInfoMap.get(tx.signature);
  //           if (!info) return;
  //           const item = processTransaction(tx, info);
  //           if (item) {
  //             parsedHistory.push(item);
  //             setTransactionCache((prev) => {
  //               const map = new Map(prev);
  //               map.set(tx.signature, item);
  //               return map;
  //             });
  //           }
  //         });
  //       }

  //       // Merge and sort
  //       setHistory((prev) => {
  //         const seen = new Set(prev.map((x) => x.signature));
  //         const newItems = parsedHistory.filter((x) => !seen.has(x.signature));
  //         const merged = [...newItems, ...prev];
  //         merged.sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0));
  //         return merged;
  //       });
  //     } catch (err: any) {
  //       console.error("Error in fetchHeliusHistory:", err);
  //       setError(err.message || "Failed to fetch transaction history");
  //       setCanLoadMore(false);
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   },
  //   [
  //     isLoading,
  //     limit,
  //     fetchWithRetry,
  //     signatureCache,
  //     batchSize,
  //     batchDelay,
  //     processTransaction,
  //   ]
  // );

  const fetchHeliusHistory = useCallback(
    async (beforeSig?: string) => {
      if (isLoading) return;
      setIsLoading(true);
      setError(null);

      try {
        // 1. Compute a sane limit
        const safeLimit =
          Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT;

        // 2. Fire just one GET
        let url = `${HELIUS_API_BASE}/addresses/${programId.toBase58()}/transactions`;
        url += `?api-key=${HELIUS_API_KEY}&limit=${safeLimit}`;
        if (beforeSig) url += `&before=${beforeSig}`;

        const resp = await fetchWithRetry(url, {});
        const txs: HeliusTransaction[] = await resp.json();

        // 3. Check for end‐of‐data
        if (!Array.isArray(txs) || txs.length === 0) {
          setCanLoadMore(false);
          return;
        }
        if (txs.length < safeLimit) {
          setCanLoadMore(false);
        }

        // 4. Update cursor
        const last = txs[txs.length - 1].signature;
        setLastSignature(last);

        // 5. Filter out ones we’ve already seen
        const newTxs = txs.filter((tx) => !signatureCache.has(tx.signature));
        setSignatureCache((prev) => {
          const s = new Set(prev);
          newTxs.forEach((tx) => s.add(tx.signature));
          return s;
        });

        // 6. Decode & price‐extract in one go
        const parsed: HistoryItem[] = newTxs
          .map((tx) => {
            const info = { timestamp: tx.timestamp };
            return processTransaction(tx, info);
          })
          .filter((item): item is HistoryItem => item !== null);

        // 7. Merge into state & cache
        setTransactionCache((prev) => {
          const m = new Map(prev);
          parsed.forEach((h) => m.set(h.signature, h));
          return m;
        });

        setHistory((prev) => {
          const seen = new Set(prev.map((h) => h.signature));
          const fresh = parsed.filter((h) => !seen.has(h.signature));
          const all = [...fresh, ...prev];
          return all.sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0));
        });
      } catch (err: any) {
        console.error("Error in fetchHeliusHistory:", err);
        setError(err.message || "Failed to fetch transaction history");
        setCanLoadMore(false);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, limit, fetchWithRetry, signatureCache, processTransaction]
  );

  // Clear cache function
  const clearCache = useCallback(() => {
    setTransactionCache(new Map());
    setSignatureCache(new Set());
    setHistory([]);
    setLastSignature(undefined);
    setCanLoadMore(true);
  }, []);

  // Initialize from localStorage if available
  useEffect(() => {
    try {
      const storedCache = localStorage.getItem("bondingCurveTransactionCache");
      if (storedCache) {
        const parsed = JSON.parse(storedCache);
        // Convert objects back to HistoryItems with PublicKey objects
        const cacheEntries: [string, HistoryItem][] = Object.entries(
          parsed
        ).map(([signature, item]: [string, any]) => {
          return [
            signature,
            {
              ...item,
              accounts: item.accounts
                ? item.accounts.map((acc: string) => new PublicKey(acc))
                : [],
            },
          ] as [string, HistoryItem];
        });

        setTransactionCache(new Map(cacheEntries));

        const signatures = Object.keys(parsed);
        setSignatureCache(new Set(signatures));

        // Populate history from cache
        const historyItems = Object.values(parsed).map((item: any) => ({
          ...item,
          accounts: item.accounts
            ? item.accounts.map((acc: string) => new PublicKey(acc))
            : [],
        }));

        historyItems.sort(
          (a: any, b: any) => (b.blockTime ?? 0) - (a.blockTime ?? 0)
        );
        setHistory(historyItems);
      }
    } catch (err) {
      console.error("Error loading cache from localStorage:", err);
    }
  }, []);

  // Save cache to localStorage
  useEffect(() => {
    try {
      if (transactionCache.size > 0) {
        // Convert Map to Object for localStorage
        // Convert PublicKey objects to strings
        const serializedCache: Record<string, any> = {};

        transactionCache.forEach((value, key) => {
          serializedCache[key] = {
            ...value,
            accounts: value.accounts.map((pk) => pk.toBase58()),
          };
        });

        localStorage.setItem(
          "bondingCurveTransactionCache",
          JSON.stringify(serializedCache)
        );
      }
    } catch (err) {
      console.error("Error saving cache to localStorage:", err);
    }
  }, [transactionCache]);

  // Cache maintenance - remove old items if cache exceeds size limit
  useEffect(() => {
    if (transactionCache.size > maxCacheSize) {
      // Remove oldest items based on blockTime
      const sortedEntries = [...transactionCache.entries()].sort(
        (a, b) => (a[1].blockTime ?? 0) - (b[1].blockTime ?? 0)
      );

      const itemsToRemove = sortedEntries.slice(
        0,
        sortedEntries.length - maxCacheSize
      );

      setTransactionCache((prev) => {
        const newCache = new Map(prev);
        itemsToRemove.forEach(([key]) => {
          newCache.delete(key);
        });
        return newCache;
      });

      setSignatureCache((prev) => {
        const newCache = new Set(prev);
        itemsToRemove.forEach(([key]) => {
          newCache.delete(key);
        });
        return newCache;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionCache.size, maxCacheSize]);

  // Cache expiration based on TTL
  useEffect(() => {
    const now = Date.now();
    const expirationTime = now - cacheTTL;

    // Find expired cache entries
    const expiredEntries = [...transactionCache.entries()].filter(
      ([, item]) => (item.blockTime ?? 0) < expirationTime
    );

    if (expiredEntries.length > 0) {
      setTransactionCache((prev) => {
        const newCache = new Map(prev);
        expiredEntries.forEach(([key]) => {
          newCache.delete(key);
        });
        return newCache;
      });

      setSignatureCache((prev) => {
        const newCache = new Set(prev);
        expiredEntries.forEach(([key]) => {
          newCache.delete(key);
        });
        return newCache;
      });
    }
  }, [transactionCache, cacheTTL]);

  // Initial data load
  useEffect(() => {
    if (history.length === 0 && !isLoading) {
      fetchHeliusHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(() => {
    if (canLoadMore && lastSignature && !isLoading) {
      fetchHeliusHistory(lastSignature);
    }
  }, [canLoadMore, lastSignature, isLoading, fetchHeliusHistory]);

  return {
    history,
    isLoading,
    error,
    loadMore,
    canLoadMore,
    clearCache, // Added function to clear the cache if needed
  };
}
