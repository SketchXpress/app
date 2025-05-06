/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useRef } from "react";
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
  poolAddress?: string;
  price?: number;
  isPriceLoading?: boolean; // New field to track price loading state
  priceLoadAttempted?: boolean; // New field to track if price load was attempted
}

// Helius API endpoint configuration
const HELIUS_API_KEY = "69b4db73-1ed1-4558-8e85-192e0994e556";
const HELIUS_API_BASE = "https://api-devnet.helius.xyz/v0";
const HELIUS_RPC_ENDPOINT = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const programId = new PublicKey(PROGRAM_ID);
const DEFAULT_LIMIT = 5;

// Cache settings
const DEFAULT_MAX_CACHE_SIZE = 500;
const DEFAULT_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Performance tuning settings
const CONCURRENT_RPC_LIMIT = 3; // Process 3 RPC calls in parallel
const MIN_RPC_DELAY = 3000; // 3 seconds between RPC calls
const BACKGROUND_PROCESS_BATCH = 5; // Process 5 sell operations in background
const MAX_RETRIES = 3; // Maximum number of retries for errors
const RETRY_DELAY_BASE = 2000; // Base delay for retries (2 seconds)

// Global price cache - makes price lookups incredibly fast even across hook instances
const globalPriceCache = new Map<string, number>();
const globalEscrowPriceCache = new Map<string, number>(); // Map escrow addresses to prices

// Helper function to find account index by name in IDL
const findAccountIndex = (idlInstruction: any, accountName: string): number => {
  if (!idlInstruction || !idlInstruction.accounts) return -1;
  return idlInstruction.accounts.findIndex(
    (acc: any) => acc.name === accountName
  );
};

// Helper function for delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Timer utility function for performance monitoring
const createTimer = (label: string) => {
  const startTime = performance.now();
  return {
    stop: () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      if (process.env.NODE_ENV !== "production") {
        console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
      }
      return duration;
    },
  };
};

export function useBondingCurveHistory(
  limit: number = 50,
  maxCacheSize: number = DEFAULT_MAX_CACHE_SIZE,
  cacheTTL: number = DEFAULT_CACHE_TTL
) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingPrices, setIsLoadingPrices] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [canLoadMore, setCanLoadMore] = useState<boolean>(true);
  const [lastSignature, setLastSignature] = useState<string | undefined>(
    undefined
  );
  const [transactionCache, setTransactionCache] = useState<
    Map<string, HistoryItem>
  >(new Map());
  const [signatureCache, setSignatureCache] = useState<Set<string>>(new Set());

  // Track RPC queue and active jobs
  const rpcQueue = useRef<Array<() => Promise<any>>>([]);
  const activeRpcJobs = useRef<number>(0);
  const lastRpcTimes = useRef<number[]>([]);

  // Performance stats
  const [performance, setPerformance] = useState({
    totalApiCalls: 0,
    totalRpcCalls: 0,
    avgResponseTime: 0,
    successfulPriceExtractions: 0,
    failedPriceExtractions: 0,
    lastFetchTime: 0,
  });

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

  // Helper for controlled RPC request scheduling
  const scheduleRpcRequest = useCallback((requestFn: () => Promise<any>) => {
    return new Promise<any>((resolve, reject) => {
      const wrappedRequest = async () => {
        try {
          // Check the last RPC call times to enforce spacing
          const now = Date.now();
          const recentCalls = lastRpcTimes.current.filter(
            (time) => now - time < MIN_RPC_DELAY
          );

          if (recentCalls.length > 0) {
            // Calculate how long to wait to ensure MIN_RPC_DELAY since last call
            const waitTime = MIN_RPC_DELAY - (now - Math.max(...recentCalls));
            if (waitTime > 0) {
              await delay(waitTime);
            }
          }

          // Record the time of this RPC call
          lastRpcTimes.current.push(Date.now());
          // Keep only the last 10 timestamps
          if (lastRpcTimes.current.length > 10) {
            lastRpcTimes.current = lastRpcTimes.current.slice(-10);
          }

          activeRpcJobs.current++;
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          activeRpcJobs.current--;
          // Process next job if queue not empty
          processRpcQueue();
        }
      };

      // Add to queue
      rpcQueue.current.push(wrappedRequest);

      // Try to process immediately if we're under concurrency limit
      processRpcQueue();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Process RPC queue up to concurrency limit
  const processRpcQueue = useCallback(() => {
    if (rpcQueue.current.length === 0) return;

    // Process up to CONCURRENT_RPC_LIMIT jobs
    while (
      activeRpcJobs.current < CONCURRENT_RPC_LIMIT &&
      rpcQueue.current.length > 0
    ) {
      const nextRequest = rpcQueue.current.shift();
      if (nextRequest) {
        nextRequest().catch(() => {}); // Catch at this level to prevent unhandled rejections
      }
    }
  }, []);

  // Optimized fetch with retry and backoff
  const fetchWithRetry = useCallback(async (url: string, options: any) => {
    let retries = 0;
    const timer = createTimer(`API call to ${url.split("?")[0]}`);

    while (retries < MAX_RETRIES) {
      try {
        const response = await fetch(url, options);

        if (!response.ok) {
          if (response.status === 429) {
            // Rate limited - exponential backoff
            const backoffTime = RETRY_DELAY_BASE * Math.pow(2, retries);
            console.log(`Rate limited. Retrying in ${backoffTime / 1000}s...`);
            await delay(backoffTime);
            retries++;
            continue;
          }

          const errorData = await response
            .json()
            .catch(() => ({ message: response.statusText }));
          throw new Error(
            `API Error: ${response.status} - ${
              errorData.message || "Request failed"
            }`
          );
        }

        timer.stop();
        setPerformance((prev) => ({
          ...prev,
          totalApiCalls: prev.totalApiCalls + 1,
        }));

        return response;
      } catch (err) {
        const duration = timer.stop();
        if (retries === MAX_RETRIES - 1) throw err;
        retries++;

        // Exponential backoff for all errors
        const backoffTime = RETRY_DELAY_BASE * Math.pow(2, retries);
        await delay(backoffTime);
      }
    }

    throw new Error(`Failed after ${MAX_RETRIES} retries`);
  }, []);

  // Optimized RPC request with advanced retry and concurrency management
  const rpcRequestWithRetry = useCallback(
    async (method: string, params: any[]) => {
      // First check if this is a getTransaction request and we already have it cached
      if (method === "getTransaction" && params[0]) {
        const signature = params[0];
        if (globalPriceCache.has(signature)) {
          return { cachedPrice: globalPriceCache.get(signature) };
        }
      }

      let retries = 0;
      const requestFn = async () => {
        const timer = createTimer(`RPC ${method}`);

        try {
          // Minimal request payload
          const requestPayload = {
            jsonrpc: "2.0",
            id: Date.now(),
            method,
            params,
          };

          // For getTransaction, optimize the request by only asking for what we need
          if (
            method === "getTransaction" &&
            params.length > 1 &&
            typeof params[1] === "object"
          ) {
            params[1] = {
              ...params[1],
              encoding: "jsonParsed",
              maxSupportedTransactionVersion: 0,
            };
          }

          const response = await fetch(HELIUS_RPC_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestPayload),
          });

          if (!response.ok) {
            if (response.status === 429) {
              const backoffTime = RETRY_DELAY_BASE * Math.pow(3, retries); // More aggressive backoff
              console.log(
                `Rate limited (RPC). Backing off for ${backoffTime / 1000}s...`
              );
              await delay(backoffTime);
              retries++;

              if (retries < MAX_RETRIES) {
                // Retry with the same request function
                timer.stop();
                return requestFn();
              }
              throw new Error(
                `RPC rate limit exceeded after ${retries} retries`
              );
            }

            const errorData = await response
              .json()
              .catch(() => ({ message: response.statusText }));
            throw new Error(
              `RPC Error: ${response.status} - ${
                errorData.message || "Request failed"
              }`
            );
          }

          const result = await response.json();
          if (result.error) {
            throw new Error(
              `RPC Error: ${
                result.error.message || JSON.stringify(result.error)
              }`
            );
          }

          const duration = timer.stop();
          setPerformance((prev) => ({
            ...prev,
            totalRpcCalls: prev.totalRpcCalls + 1,
            avgResponseTime:
              (prev.avgResponseTime * prev.totalRpcCalls + duration) /
              (prev.totalRpcCalls + 1),
          }));

          return result.result;
        } catch (err) {
          timer.stop();
          throw err;
        }
      };

      // Use the scheduler to respect concurrency limits
      return scheduleRpcRequest(requestFn);
    },
    [scheduleRpcRequest]
  );

  // Fast price extraction for mint operations (synchronous)
  const extractMintPrice = useCallback(
    (tx: HeliusTransaction, escrowAddress?: string): number | undefined => {
      // Check global price cache first
      if (globalPriceCache.has(tx.signature)) {
        return globalPriceCache.get(tx.signature);
      }

      // Quick check for mint operations and native transfers
      if (
        tx.nativeTransfers &&
        Array.isArray(tx.nativeTransfers) &&
        escrowAddress
      ) {
        const payer = tx.feePayer;

        // Find transfers to escrow (for mint operations)
        const transfersToEscrow = tx.nativeTransfers
          .filter(
            (transfer: NativeTransfer) =>
              transfer.fromUserAccount === payer &&
              transfer.toUserAccount === escrowAddress
          )
          .sort((a, b) => b.amount - a.amount); // Sort by amount descending

        if (transfersToEscrow.length > 0) {
          const price = transfersToEscrow[0].amount / LAMPORTS_PER_SOL;

          // Cache the price globally
          globalPriceCache.set(tx.signature, price);
          globalEscrowPriceCache.set(escrowAddress, price);

          return price;
        }
      }

      return undefined;
    },
    []
  );

  // Advanced price extraction for sell operations (async)
  const extractSellPrice = useCallback(
    async (
      signature: string,
      escrowAddress?: string
    ): Promise<number | undefined> => {
      // Check global caches first
      if (globalPriceCache.has(signature)) {
        return globalPriceCache.get(signature);
      }

      if (escrowAddress && globalEscrowPriceCache.has(escrowAddress)) {
        const price = globalEscrowPriceCache.get(escrowAddress);
        globalPriceCache.set(signature, price!);
        return price;
      }

      try {
        // Simplified and optimized RPC request
        const txDetails = await rpcRequestWithRetry("getTransaction", [
          signature,
          { commitment: "confirmed" }, // Let the RPC function add the optimization parameters
        ]);

        // Handle cached response (from our own cache)
        if (txDetails && "cachedPrice" in txDetails) {
          return txDetails.cachedPrice;
        }

        if (
          txDetails?.meta?.preBalances &&
          txDetails?.meta?.postBalances &&
          escrowAddress
        ) {
          // Extract account information
          let accountKeys: string[] = [];

          if (txDetails.transaction?.message) {
            const message = txDetails.transaction.message;
            if ("accountKeys" in message) {
              accountKeys = message.accountKeys.map((key: any) =>
                typeof key === "string"
                  ? key
                  : key.toBase58?.() || key.toString()
              );
            } else if ("staticAccountKeys" in message) {
              accountKeys = message.staticAccountKeys.map((key: any) =>
                typeof key === "string"
                  ? key
                  : key.toBase58?.() || key.toString()
              );
            }
          }

          const preBalances = txDetails.meta.preBalances;
          const postBalances = txDetails.meta.postBalances;
          const escrowAccountIndexInTx = accountKeys.findIndex(
            (key) => key === escrowAddress
          );

          if (
            escrowAccountIndexInTx !== -1 &&
            preBalances.length > escrowAccountIndexInTx &&
            postBalances.length > escrowAccountIndexInTx
          ) {
            const escrowPreBalance = preBalances[escrowAccountIndexInTx];
            const escrowPostBalance = postBalances[escrowAccountIndexInTx];
            const escrowBalanceChange = escrowPreBalance - escrowPostBalance;

            // Check for significant balance change (more than dust)
            if (escrowBalanceChange > 1000) {
              const price = escrowBalanceChange / LAMPORTS_PER_SOL;

              // Cache this result globally for future use
              globalPriceCache.set(signature, price);
              if (escrowAddress) {
                globalEscrowPriceCache.set(escrowAddress, price);
              }

              setPerformance((prev) => ({
                ...prev,
                successfulPriceExtractions: prev.successfulPriceExtractions + 1,
              }));

              return price;
            }
          }
        }

        setPerformance((prev) => ({
          ...prev,
          failedPriceExtractions: prev.failedPriceExtractions + 1,
        }));

        return undefined;
      } catch (err: any) {
        console.error(
          `Error extracting sell price for ${signature}:`,
          err.message
        );
        setPerformance((prev) => ({
          ...prev,
          failedPriceExtractions: prev.failedPriceExtractions + 1,
        }));
        return undefined;
      }
    },
    [rpcRequestWithRetry]
  );

  // Fast initial transaction processing (synchronous, no RPC calls)
  const processTransactionFast = useCallback(
    (tx: HeliusTransaction, basicInfo: any): HistoryItem => {
      let decodedName = "Unknown";
      let decodedArgs: any = {};
      let decodedAccounts: PublicKey[] = [];
      let poolAddress: string | undefined = undefined;
      let escrowAddress: string | undefined = undefined;
      let price: number | undefined = undefined;
      let isSellOperation = false;

      if (tx.instructions && Array.isArray(tx.instructions)) {
        const mainInstructionIndex = tx.instructions.findIndex(
          (ix: any) => ix.programId === programId.toBase58() && ix.data
        );

        if (mainInstructionIndex !== -1) {
          const mainInstruction = tx.instructions[mainInstructionIndex];

          try {
            const decoded = instructionCoder.decode(
              mainInstruction.data,
              "base58"
            );

            if (decoded) {
              decodedName = decoded.name;
              decodedArgs = decoded.data;

              if (
                mainInstruction.accounts &&
                Array.isArray(mainInstruction.accounts)
              ) {
                decodedAccounts = mainInstruction.accounts.map(
                  (acc: string) => new PublicKey(acc)
                );

                const idlInstruction = BondingCurveIDL.instructions.find(
                  (ix) => ix.name === decodedName
                );

                // Extract pool address
                const poolAccountIndex = findAccountIndex(
                  idlInstruction,
                  "pool"
                );
                if (
                  poolAccountIndex !== -1 &&
                  mainInstruction.accounts.length > poolAccountIndex
                ) {
                  poolAddress = mainInstruction.accounts[poolAccountIndex];
                }

                // Check if this is a mint or sell operation
                if (decodedName === "mintNft" || decodedName === "sellNft") {
                  isSellOperation = decodedName === "sellNft";

                  const escrowAccountIndex = findAccountIndex(
                    idlInstruction,
                    "escrow"
                  );
                  if (
                    escrowAccountIndex !== -1 &&
                    mainInstruction.accounts.length > escrowAccountIndex
                  ) {
                    escrowAddress =
                      mainInstruction.accounts[escrowAccountIndex];

                    // For mint operations, try to extract price synchronously
                    if (!isSellOperation) {
                      price = extractMintPrice(tx, escrowAddress);
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.error(`Error decoding instruction:`, e);
          }
        }
      }

      return {
        signature: tx.signature,
        blockTime: basicInfo.timestamp,
        instructionName: decodedName,
        accounts: decodedAccounts,
        args: decodedArgs,
        description: tx.description || "",
        type: tx.type || "",
        source: tx.source || "",
        error: tx.transactionError,
        poolAddress: poolAddress,
        price: price,
        isPriceLoading: isSellOperation, // Mark sell operations as loading prices
        priceLoadAttempted: !isSellOperation, // Mark non-sell operations as having attempted price load
      };
    },
    [instructionCoder, extractMintPrice]
  );

  // Load prices in background for all sell operations
  const loadSellPricesInBackground = useCallback(async () => {
    // Get all items that need price loading
    const itemsNeedingPrices = history.filter(
      (item) => item.isPriceLoading && !item.priceLoadAttempted
    );

    if (itemsNeedingPrices.length === 0) {
      setIsLoadingPrices(false);
      return;
    }

    setIsLoadingPrices(true);

    // Process in batches to avoid overwhelming the RPC
    const batchSize = BACKGROUND_PROCESS_BATCH;
    const batches = Math.ceil(itemsNeedingPrices.length / batchSize);

    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const startIdx = batchIndex * batchSize;
      const endIdx = Math.min(startIdx + batchSize, itemsNeedingPrices.length);
      const batch = itemsNeedingPrices.slice(startIdx, endIdx);

      // Process the batch in parallel
      const pricePromises = batch.map(async (item) => {
        const signature = item.signature;
        let escrowAddress: string | undefined;

        // Find escrow address from accounts
        if (item.instructionName === "sellNft") {
          const idlInstruction = BondingCurveIDL.instructions.find(
            (ix) => ix.name === "sellNft"
          );
          if (idlInstruction) {
            const escrowIndex = findAccountIndex(idlInstruction, "escrow");
            if (escrowIndex !== -1 && item.accounts.length > escrowIndex) {
              escrowAddress = item.accounts[escrowIndex].toBase58();
            }
          }
        }

        const price = await extractSellPrice(signature, escrowAddress);

        // Mark as processed and update price if found
        return {
          signature,
          price,
          priceLoadAttempted: true,
          isPriceLoading: false,
        };
      });

      try {
        const results = await Promise.all(pricePromises);

        // Update history with the new prices
        setHistory((prevHistory) => {
          const updatedHistory = [...prevHistory];

          results.forEach((result) => {
            const index = updatedHistory.findIndex(
              (item) => item.signature === result.signature
            );
            if (index !== -1) {
              updatedHistory[index] = {
                ...updatedHistory[index],
                price: result.price,
                priceLoadAttempted: true,
                isPriceLoading: false,
              };
            }
          });

          return updatedHistory;
        });

        // Also update the transaction cache
        setTransactionCache((prevCache) => {
          const newCache = new Map(prevCache);

          results.forEach((result) => {
            if (newCache.has(result.signature)) {
              const item = newCache.get(result.signature)!;
              newCache.set(result.signature, {
                ...item,
                price: result.price,
                priceLoadAttempted: true,
                isPriceLoading: false,
              });
            }
          });

          return newCache;
        });
      } catch (error) {
        console.error("Error loading prices in background:", error);
      }
    }

    setIsLoadingPrices(false);
  }, [history, extractSellPrice]);

  // Main fetch function - optimized for speed
  const fetchHeliusHistory = useCallback(
    async (beforeSig?: string) => {
      if (isLoading) return;
      setIsLoading(true);
      setError(null);

      const fetchTimer = createTimer(
        `Total fetch operation${beforeSig ? " (pagination)" : " (initial)"}`
      );

      try {
        // 1. Compute a sane limit
        const safeLimit =
          Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT;

        // 2. Fetch transaction data
        let url = `${HELIUS_API_BASE}/addresses/${programId.toBase58()}/transactions`;
        url += `?api-key=${HELIUS_API_KEY}&limit=${safeLimit}`;
        if (beforeSig) url += `&before=${beforeSig}`;

        const resp = await fetchWithRetry(url, {});
        const txs: HeliusTransaction[] = await resp.json();

        // 3. Check for end of data
        if (!Array.isArray(txs) || txs.length === 0) {
          setCanLoadMore(false);
          setIsLoading(false);
          fetchTimer.stop();
          return;
        }

        if (txs.length < safeLimit) {
          setCanLoadMore(false);
        }

        // 4. Update pagination cursor
        const lastSig = txs[txs.length - 1].signature;
        setLastSignature(lastSig);

        // 5. Filter out transactions we've already seen
        const newTxs = txs.filter((tx) => !signatureCache.has(tx.signature));

        // Track signatures we've seen
        setSignatureCache((prev) => {
          const s = new Set(prev);
          newTxs.forEach((tx) => s.add(tx.signature));
          return s;
        });

        if (newTxs.length === 0) {
          setIsLoading(false);
          fetchTimer.stop();
          return;
        }

        // 6. Fast initial processing (synchronous, no RPC calls)
        console.log(`Processing ${newTxs.length} new transactions`);

        const processTimer = createTimer("Fast transaction processing");
        const processedItems = newTxs.map((tx) => {
          const info = { timestamp: tx.timestamp };
          return processTransactionFast(tx, info);
        });
        processTimer.stop();

        // 7. Update the history state with new transactions
        setHistory((prev) => {
          const seen = new Set(prev.map((item) => item.signature));
          const newItems = processedItems.filter(
            (item) => !seen.has(item.signature)
          );

          // Sort by block time, most recent first
          return [...newItems, ...prev].sort(
            (a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0)
          );
        });

        // 8. Update the transaction cache
        setTransactionCache((prev) => {
          const newCache = new Map(prev);
          processedItems.forEach((item) => {
            newCache.set(item.signature, item);
          });
          return newCache;
        });

        const totalTime = fetchTimer.stop();

        // 9. Update performance stats
        setPerformance((prev) => ({
          ...prev,
          lastFetchTime: totalTime,
        }));

        // 10. Trigger background price loading for sell operations
        setTimeout(() => {
          loadSellPricesInBackground();
        }, 100);
      } catch (err: any) {
        console.error("Error in fetchHeliusHistory:", err);
        setError(err.message || "Failed to fetch transaction history");
        setCanLoadMore(false);
        fetchTimer.stop();
      } finally {
        setIsLoading(false);
      }
    },
    [
      isLoading,
      limit,
      fetchWithRetry,
      signatureCache,
      processTransactionFast,
      loadSellPricesInBackground,
    ]
  );

  // Load more function
  const loadMore = useCallback(() => {
    if (canLoadMore && lastSignature && !isLoading) {
      fetchHeliusHistory(lastSignature);
    }
  }, [canLoadMore, lastSignature, isLoading, fetchHeliusHistory]);

  // Clear cache function
  const clearCache = useCallback(() => {
    setTransactionCache(new Map());
    setSignatureCache(new Set());
    setHistory([]);
    setLastSignature(undefined);
    setCanLoadMore(true);
    setPerformance({
      totalApiCalls: 0,
      totalRpcCalls: 0,
      avgResponseTime: 0,
      successfulPriceExtractions: 0,
      failedPriceExtractions: 0,
      lastFetchTime: 0,
    });
  }, []);

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

  // Initial data load from localStorage if available
  useEffect(() => {
    try {
      const cachedDataString = localStorage.getItem(
        "bondingCurveTransactionCache"
      );
      if (cachedDataString) {
        const parsed = JSON.parse(cachedDataString);

        // Convert objects back to HistoryItems with PublicKey objects
        const historyItems = Object.values(parsed).map((item: any) => ({
          ...item,
          accounts: item.accounts
            ? item.accounts.map((acc: string) => new PublicKey(acc))
            : [],
        }));

        // Add to local caches
        historyItems.forEach((item) => {
          if (item.price) {
            globalPriceCache.set(item.signature, item.price);

            // Also try to cache by escrow address if we can find it
            if (
              item.instructionName === "mintNft" ||
              item.instructionName === "sellNft"
            ) {
              const idlInstruction = BondingCurveIDL.instructions.find(
                (ix) => ix.name === item.instructionName
              );
              const escrowIndex = findAccountIndex(idlInstruction, "escrow");
              if (escrowIndex !== -1 && item.accounts.length > escrowIndex) {
                const escrowAddress = item.accounts[escrowIndex].toBase58();
                globalEscrowPriceCache.set(escrowAddress, item.price);
              }
            }
          }
        });

        // Sort by block time
        historyItems.sort(
          (a: any, b: any) => (b.blockTime ?? 0) - (a.blockTime ?? 0)
        );

        setHistory(historyItems);

        // Populate caches
        const signatures = new Set(historyItems.map((item) => item.signature));
        setSignatureCache(signatures);

        const cacheMap = new Map();
        historyItems.forEach((item) => {
          cacheMap.set(item.signature, item);
        });
        setTransactionCache(cacheMap);

        console.log(`Loaded ${historyItems.length} items from cache`);
      }
    } catch (err) {
      console.error("Error loading cache from localStorage:", err);
    }
  }, []);

  // Save cache to localStorage
  useEffect(() => {
    try {
      if (transactionCache.size > 0) {
        // Only save if we have items and not too frequently
        const saveTimer = createTimer("Save to localStorage");

        // Convert Map to Object for localStorage
        // Convert PublicKey objects to strings
        const serializedCache: Record<string, any> = {};

        transactionCache.forEach((value, key) => {
          serializedCache[key] = {
            ...value,
            accounts: value.accounts.map((pk) => pk.toBase58()),
            isPriceLoading: false, // Don't persist loading states
            priceLoadAttempted: true, // Mark as attempted when saving
          };
        });

        localStorage.setItem(
          "bondingCurveTransactionCache",
          JSON.stringify(serializedCache)
        );

        saveTimer.stop();
      }
    } catch (err) {
      console.error("Error saving cache to localStorage:", err);
    }
  }, [transactionCache]);

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
      console.log("Initial data load");
      fetchHeliusHistory();
    }
  }, [history.length, isLoading, fetchHeliusHistory]);

  // Return the hook's values and functions
  return {
    history,
    isLoading,
    isLoadingPrices, // New field to indicate background price loading
    error,
    loadMore,
    canLoadMore,
    clearCache,
    stats: performance, // Expose performance stats
  };
}
