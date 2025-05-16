/* eslint-disable @typescript-eslint/no-explicit-any */
export const globalPriceCache = new Map<string, number>();
export const globalEscrowPriceCache = new Map<string, number>();

// Initialize signature and transaction cache if needed
export const initializeCache = () => {
  return {
    transactionCache: new Map<string, any>(),
    signatureCache: new Set<string>(),
  };
};

// Save a price to both global caches
export const cachePriceInfo = (
  signature: string,
  price: number,
  escrowAddress?: string
): void => {
  globalPriceCache.set(signature, price);
  if (escrowAddress) {
    globalEscrowPriceCache.set(escrowAddress, price);
  }
};

// Get price from cache (checks both signature and escrow caches)
export const getPriceFromCache = (
  signature: string,
  escrowAddress?: string
): number | undefined => {
  // Check signature cache first
  if (globalPriceCache.has(signature)) {
    return globalPriceCache.get(signature);
  }

  // Then check escrow cache if available
  if (escrowAddress && globalEscrowPriceCache.has(escrowAddress)) {
    const price = globalEscrowPriceCache.get(escrowAddress);
    // Cross-populate signature cache for future lookups
    if (price !== undefined) {
      globalPriceCache.set(signature, price);
    }
    return price;
  }

  return undefined;
};

// Clear all caches
export const clearAllCaches = (): void => {
  globalPriceCache.clear();
  globalEscrowPriceCache.clear();
};

// Serialize cache for localStorage
export const serializeCache = (
  transactionCache: Map<string, any>
): Record<string, any> => {
  const serializedCache: Record<string, any> = {};

  transactionCache.forEach((value, key) => {
    serializedCache[key] = {
      ...value,
      accounts: value.accounts.map((pk: any) => pk.toBase58()),
      isPriceLoading: false,
      priceLoadAttempted: true,
    };
  });

  return serializedCache;
};

// Prune old items from cache
export const pruneCache = (
  cache: Map<string, any>,
  maxSize: number,
  compareFn: (a: any, b: any) => number
): Map<string, any> => {
  if (cache.size <= maxSize) return cache;

  const sortedEntries = [...cache.entries()].sort(compareFn);
  const itemsToRemove = sortedEntries.slice(0, sortedEntries.length - maxSize);

  const newCache = new Map(cache);
  itemsToRemove.forEach(([key]) => {
    newCache.delete(key);
  });

  return newCache;
};
