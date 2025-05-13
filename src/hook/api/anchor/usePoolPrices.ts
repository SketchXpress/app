/* eslint-disable @typescript-eslint/no-explicit-any */
import { PublicKey } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";
import { useAnchorContext } from "@/contexts/AnchorContextProvider";
import { useGlobalCache } from "@/hook/shared/state/useGlobalCache";
import { isValidPublicKeyFormat, safePublicKey } from "@/utils/bn-polyfill";
import { useDeduplicateRequests } from "@/hook/shared/utils/useDeduplicateRequests";
import { PoolPrices, UsePoolPricesConfig } from "@/types/pool";

const formatPoolPrice = (poolData: any): number => {
  if (!poolData || !poolData.totalEscrowed) {
    throw new Error("Invalid pool data");
  }

  const totalEscrowed = poolData.totalEscrowed as { toNumber: () => number };
  return totalEscrowed.toNumber() / 1_000_000_000; // Convert lamports to SOL
};

// Batch fetching function
const batchFetchPoolPrices = async (
  poolAddresses: string[],
  program: any
): Promise<Map<string, number | null>> => {
  if (!program || !program.account?.bondingCurvePool?.fetchMultiple) {
    throw new Error("Program not available or missing fetchMultiple method");
  }

  // Validate and convert addresses
  const validPools: { address: string; pubkey: PublicKey }[] = [];
  const invalidPools: string[] = [];

  poolAddresses.forEach((address) => {
    if (!isValidPublicKeyFormat(address)) {
      invalidPools.push(address);
      return;
    }

    const pubkey = safePublicKey(address);
    if (!pubkey) {
      invalidPools.push(address);
      return;
    }

    validPools.push({ address, pubkey });
  });

  const results = new Map<string, number | null>();

  // Mark invalid addresses
  invalidPools.forEach((address) => {
    results.set(address, null);
  });

  if (validPools.length === 0) {
    return results;
  }

  try {
    // Fetch multiple accounts in a batch
    const poolData = await program.account.bondingCurvePool.fetchMultiple(
      validPools.map((pool) => pool.pubkey)
    );

    // Process results
    poolData.forEach((data: any, index: number) => {
      const { address } = validPools[index];

      if (data && "totalEscrowed" in data) {
        try {
          const price = formatPoolPrice(data);
          results.set(address, price);
        } catch (error) {
          console.error(`Error formatting price for pool ${address}:`, error);
          results.set(address, null);
        }
      } else {
        results.set(address, null);
      }
    });

    return results;
  } catch (error) {
    console.error("Error in batch fetchPoolPrices:", error);

    // If batch fails, return null for all valid pools
    validPools.forEach(({ address }) => {
      results.set(address, null);
    });

    return results;
  }
};

// Single pool price fetching (fallback)
const fetchSinglePoolPrice = async (
  poolAddress: string,
  program: any
): Promise<number | null> => {
  if (!isValidPublicKeyFormat(poolAddress)) {
    return null;
  }

  const pool = safePublicKey(poolAddress);
  if (!pool) {
    return null;
  }

  try {
    const poolData = await program.account.bondingCurvePool.fetch(pool);
    return formatPoolPrice(poolData);
  } catch (error) {
    console.error(`Error fetching pool ${poolAddress}:`, error);
    return null;
  }
};

// Main Hook for Multiple Pools
export function usePoolPrices(
  poolAddresses: string[],
  config: UsePoolPricesConfig = {}
) {
  const {
    enabled = true,
    staleTime = 60 * 1000,
    gcTime = 5 * 60 * 1000,
    refetchOnWindowFocus = false,
  } = config;

  const { program } = useAnchorContext();
  const { deduplicatedFetch } =
    useDeduplicateRequests<Map<string, number | null>>();

  // Create a unique key for this batch of pool addresses
  const queryKey = poolAddresses.sort().join(",");

  return useQuery({
    queryKey: ["poolPrices", queryKey],
    queryFn: () => {
      if (!program) {
        throw new Error("Program not initialized");
      }

      return deduplicatedFetch(
        `pool-prices-${queryKey}`,
        () => batchFetchPoolPrices(poolAddresses, program),
        30000 // 30 second deduplication window
      );
    },
    enabled: enabled && !!program && poolAddresses.length > 0,
    staleTime,
    gcTime,
    refetchOnWindowFocus,
    select: (data) => {
      // Transform Map to Record for easier consumption
      const prices: PoolPrices = {};

      poolAddresses.forEach((address) => {
        const price = data.get(address);

        if (price === null) {
          if (!isValidPublicKeyFormat(address)) {
            prices[address] = "Invalid address";
          } else {
            prices[address] = "Price N/A";
          }
        } else {
          prices[address] = price !== undefined ? price : "Price N/A";
        }
      });

      return prices;
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

// Hook for Single Pool Price
export function usePoolPrice(
  poolAddress: string,
  config: UsePoolPricesConfig = {}
) {
  const {
    enabled = true,
    staleTime = 60 * 1000,
    gcTime = 5 * 60 * 1000,
    refetchOnWindowFocus = false,
  } = config;

  const { program } = useAnchorContext();
  const cache = useGlobalCache();

  return useQuery({
    queryKey: ["poolPrice", poolAddress],
    queryFn: () => {
      // Check cache first
      const cached = cache.get(`pool-price-${poolAddress}`);
      if (cached !== null) return cached;

      return fetchSinglePoolPrice(poolAddress, program).then((price) => {
        if (price !== null) {
          cache.set(`pool-price-${poolAddress}`, price, staleTime);
        }
        return price;
      });
    },
    enabled: enabled && !!program && !!poolAddress,
    staleTime,
    gcTime,
    refetchOnWindowFocus,
    select: (data) => {
      if (data === null) {
        if (!isValidPublicKeyFormat(poolAddress)) {
          return "Invalid address" as const;
        }
        return "Price N/A" as const;
      }
      return data;
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

// Real-time price subscription hook (for future use)
export function usePoolPricesSubscription(
  poolAddresses: string[],
  config: UsePoolPricesConfig & { updateInterval?: number } = {}
) {
  const {
    enabled = true,
    updateInterval = 10000, // 10 seconds
    staleTime = 60 * 1000,
    gcTime = 5 * 60 * 1000,
  } = config;

  const { program } = useAnchorContext();

  return useQuery({
    queryKey: ["poolPricesSubscription", poolAddresses.sort().join(",")],
    queryFn: () => batchFetchPoolPrices(poolAddresses, program),
    enabled: enabled && !!program && poolAddresses.length > 0,
    staleTime,
    gcTime,
    refetchInterval: updateInterval,
    refetchOnWindowFocus: false,
    select: (data) => {
      const prices: PoolPrices = {};

      poolAddresses.forEach((address) => {
        const price = data.get(address);

        if (price === null) {
          if (!isValidPublicKeyFormat(address)) {
            prices[address] = "Invalid address";
          } else {
            prices[address] = "Price N/A";
          }
        } else {
          prices[address] = price !== undefined ? price : "Price N/A";
        }
      });

      return prices;
    },
  });
}

export { batchFetchPoolPrices, fetchSinglePoolPrice, formatPoolPrice };
