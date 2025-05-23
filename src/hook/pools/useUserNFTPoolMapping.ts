/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { BorshInstructionCoder } from "@coral-xyz/anchor";
import { useAnchorContext } from "@/contexts/AnchorContextProvider";
import { processTransactionFast } from "@/hooks/useBondingCurveHistory/extractors";
import { PROGRAM_PUBLIC_KEY } from "@/hooks/useBondingCurveHistory/constants";
import { IDL as BondingCurveIDL } from "@/utils/idl";
import { NFT } from "@/types/nft";

// Types
export interface PoolMapping {
  poolAddress: string;
  poolName?: string;
  timestamp: number;
  collectionMint?: string;
}

export interface NFTPoolMappings {
  [mintAddress: string]: PoolMapping;
}

interface CachedMappingData {
  mappings: NFTPoolMappings;
  timestamp: number;
  nftListHash: string;
  walletAddress: string;
  version: number;
}

interface UseUserNFTPoolMappingResult {
  poolMappings: NFTPoolMappings;
  isEnhancing: boolean;
  isLoading: boolean;
  error: string | null;
  stats: {
    totalNFTs: number;
    mappedNFTs: number;
    cacheMisses: number;
    apiCalls: number;
    processingTime: number;
  };
  refresh: () => Promise<void>;
}

// Constants
const CACHE_KEY_PREFIX = "user_nft_pool_mappings_v2";
const CACHE_VERSION = 2;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const BATCH_SIZE = 10; // Process NFTs in batches
const MAX_CONCURRENT_REQUESTS = 3;
const REQUEST_DELAY = 100; // ms between requests

// Utility Functions
const createCacheKey = (walletAddress: string): string => {
  return `${CACHE_KEY_PREFIX}_${walletAddress}`;
};

const generateNFTListHash = (nfts: NFT[]): string => {
  const mintList = nfts
    .map((nft) => nft.mintAddress)
    .sort()
    .join(",");
  return btoa(mintList).slice(0, 16); // Short hash for storage efficiency
};

const isValidCache = (
  cached: CachedMappingData,
  currentHash: string,
  walletAddress: string
): boolean => {
  if (!cached || cached.version !== CACHE_VERSION) return false;
  if (cached.walletAddress !== walletAddress) return false;
  if (Date.now() - cached.timestamp > CACHE_TTL) return false;
  if (cached.nftListHash !== currentHash) return false;
  return true;
};

// Request Queue for Rate Limiting
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private running = 0;
  private maxConcurrent: number;

  constructor(maxConcurrent = MAX_CONCURRENT_REQUESTS) {
    this.maxConcurrent = maxConcurrent;
  }

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const request = this.queue.shift()!;

    try {
      await request();
    } finally {
      this.running--;
      // Add delay between requests
      setTimeout(() => this.process(), REQUEST_DELAY);
    }
  }
}

export function useUserNFTPoolMapping(
  nfts: NFT[] = []
): UseUserNFTPoolMappingResult {
  const { publicKey } = useWallet();
  const { program } = useAnchorContext();

  // State
  const [poolMappings, setPoolMappings] = useState<NFTPoolMappings>({});
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalNFTs: 0,
    mappedNFTs: 0,
    cacheMisses: 0,
    apiCalls: 0,
    processingTime: 0,
  });

  // Refs
  const requestQueueRef = useRef(new RequestQueue());
  const abortControllerRef = useRef<AbortController | null>(null);
  const processingRef = useRef(false);

  // Memoized values
  const walletAddress = useMemo(() => publicKey?.toString() || "", [publicKey]);
  const nftListHash = useMemo(() => generateNFTListHash(nfts), [nfts]);
  const cacheKey = useMemo(
    () => createCacheKey(walletAddress),
    [walletAddress]
  );

  // Load cached data
  const loadCachedMappings = useCallback((): NFTPoolMappings => {
    if (!walletAddress) return {};

    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return {};

      const parsedCache: CachedMappingData = JSON.parse(cached);
      if (isValidCache(parsedCache, nftListHash, walletAddress)) {
        console.log("✅ Cache hit for user NFT pool mappings");
        return parsedCache.mappings;
      } else {
        console.log("🗑️ Cache invalid, clearing");
        localStorage.removeItem(cacheKey);
        return {};
      }
    } catch (error) {
      console.error("❌ Error loading cache:", error);
      localStorage.removeItem(cacheKey);
      return {};
    }
  }, [cacheKey, nftListHash, walletAddress]);

  // Save to cache
  const saveMappingsToCache = useCallback(
    (mappings: NFTPoolMappings) => {
      if (!walletAddress) return;

      try {
        const cacheData: CachedMappingData = {
          mappings,
          timestamp: Date.now(),
          nftListHash,
          walletAddress,
          version: CACHE_VERSION,
        };

        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        console.log("💾 Saved user NFT pool mappings to cache");
      } catch (error) {
        console.warn("⚠️ Failed to save to cache:", error);
      }
    },
    [cacheKey, nftListHash, walletAddress]
  );

  // Fetch transactions for specific mint address
  const fetchMintTransactions = useCallback(
    async (mintAddress: string): Promise<any[]> => {
      const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
      if (!HELIUS_API_KEY) {
        throw new Error("Helius API key not configured");
      }

      const API_BASE = `https://api-devnet.helius.xyz/v0`;
      const url = `${API_BASE}/addresses/${mintAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=50`;

      const response = await fetch(url, {
        signal: abortControllerRef.current?.signal,
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        throw new Error(`Rate limited. Retry after ${waitTime}ms`);
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    },
    []
  );

  // Process transactions to find pool mappings
  const processTransactionsForMapping = useCallback(
    (transactions: any[]): PoolMapping | null => {
      if (!program?.coder?.instruction) return null;

      const instructionCoder = program.coder
        .instruction as BorshInstructionCoder;

      for (const tx of transactions) {
        try {
          const processed = processTransactionFast(
            tx,
            { timestamp: tx.timestamp || Math.floor(Date.now() / 1000) },
            instructionCoder,
            PROGRAM_PUBLIC_KEY,
            BondingCurveIDL
          );

          if (
            processed.instructionName === "mintNft" &&
            processed.poolAddress
          ) {
            return {
              poolAddress: processed.poolAddress,
              poolName: processed.poolName || "Pool Collection",
              timestamp: processed.blockTime || Math.floor(Date.now() / 1000),
              collectionMint: processed.accounts?.[0]?.toString(),
            };
          }
        } catch {
          // Skip invalid transactions
          continue;
        }
      }

      return null;
    },
    [program]
  );

  // Get mappings for unknown NFTs
  const fetchMappingsForUnknownNFTs = useCallback(
    async (unknownNFTs: NFT[]): Promise<NFTPoolMappings> => {
      if (unknownNFTs.length === 0) return {};

      const startTime = performance.now();
      const newMappings: NFTPoolMappings = {};
      let apiCalls = 0;

      setIsEnhancing(true);
      setError(null);

      try {
        console.log(`🔍 Fetching pool mappings for ${unknownNFTs.length} NFTs`);

        // Process NFTs in batches to avoid overwhelming the API
        for (let i = 0; i < unknownNFTs.length; i += BATCH_SIZE) {
          const batch = unknownNFTs.slice(i, i + BATCH_SIZE);

          const batchPromises = batch.map((nft) =>
            requestQueueRef.current.add(async () => {
              try {
                apiCalls++;
                const transactions = await fetchMintTransactions(
                  nft.mintAddress
                );
                const mapping = processTransactionsForMapping(transactions);

                if (mapping) {
                  newMappings[nft.mintAddress] = mapping;
                  console.log(
                    `✅ Found pool mapping for ${nft.name}: ${mapping.poolAddress}`
                  );
                }

                return { mintAddress: nft.mintAddress, mapping };
              } catch (error) {
                console.warn(
                  `⚠️ Failed to fetch mapping for ${nft.mintAddress}:`,
                  error
                );
                return { mintAddress: nft.mintAddress, mapping: null };
              }
            })
          );

          // Wait for batch to complete before starting next batch
          await Promise.allSettled(batchPromises);

          // Update stats progressively
          setStats((prev) => ({
            ...prev,
            mappedNFTs: Object.keys(newMappings).length,
            apiCalls,
          }));
        }

        const processingTime = performance.now() - startTime;
        console.log(
          `✅ Completed mapping fetch in ${processingTime.toFixed(2)}ms`
        );

        return newMappings;
      } catch (error) {
        console.error("❌ Error fetching NFT pool mappings:", error);
        setError(error instanceof Error ? error.message : "Unknown error");
        return newMappings;
      } finally {
        setIsEnhancing(false);
      }
    },
    [fetchMintTransactions, processTransactionsForMapping]
  );

  // Main function to update mappings
  const updateMappings = useCallback(async () => {
    if (!walletAddress || !nfts.length || processingRef.current) return;

    processingRef.current = true;
    setIsLoading(true);
    setError(null);

    // Abort any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      // Load cached mappings
      const cachedMappings = loadCachedMappings();

      // Identify NFTs that need mapping
      const unknownNFTs = nfts.filter(
        (nft) => !cachedMappings[nft.mintAddress]
      );
      const cacheMisses = unknownNFTs.length;

      // Set initial state with cached data
      setPoolMappings(cachedMappings);
      setStats((prev) => ({
        ...prev,
        totalNFTs: nfts.length,
        mappedNFTs: Object.keys(cachedMappings).length,
        cacheMisses,
        apiCalls: 0,
        processingTime: 0,
      }));

      // Fetch mappings for unknown NFTs
      if (unknownNFTs.length > 0) {
        const newMappings = await fetchMappingsForUnknownNFTs(unknownNFTs);

        // Merge with cached mappings
        const updatedMappings = { ...cachedMappings, ...newMappings };

        // Update state and cache
        setPoolMappings(updatedMappings);
        saveMappingsToCache(updatedMappings);

        // Final stats update
        setStats((prev) => ({
          ...prev,
          mappedNFTs: Object.keys(updatedMappings).length,
          processingTime: performance.now(),
        }));
      }
    } catch (error) {
      console.error("❌ Error updating mappings:", error);
      setError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoading(false);
      processingRef.current = false;
    }
  }, [
    walletAddress,
    nfts,
    loadCachedMappings,
    fetchMappingsForUnknownNFTs,
    saveMappingsToCache,
  ]);

  // Refresh function for manual updates
  const refresh = useCallback(async () => {
    if (!walletAddress) return;

    // Clear cache and refresh
    localStorage.removeItem(cacheKey);
    setPoolMappings({});
    await updateMappings();
  }, [walletAddress, cacheKey, updateMappings]);

  // Effect to trigger mapping updates when NFTs change
  useEffect(() => {
    if (nfts.length > 0 && walletAddress && program) {
      updateMappings();
    }
  }, [nfts.length, walletAddress, program, updateMappings]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    poolMappings,
    isEnhancing,
    isLoading,
    error,
    stats,
    refresh,
  };
}
