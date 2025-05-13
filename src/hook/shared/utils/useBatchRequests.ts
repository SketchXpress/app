import { useRef, useCallback } from "react";

interface BatchConfig<T, K> {
  maxBatchSize: number;
  batchDelay: number;
  keyExtractor: (item: T) => K;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetcher: (items: T[]) => Promise<Map<K, any>>;
}

export function useBatchRequests<T, K>({
  maxBatchSize = 10,
  batchDelay = 50,
  keyExtractor,
  fetcher,
}: BatchConfig<T, K>) {
  const batchQueue = useRef<{
    items: T[];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    resolvers: Map<K, { resolve: Function; reject: Function }>;
  }>({ items: [], resolvers: new Map() });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const processBatch = useCallback(async () => {
    const { items, resolvers } = batchQueue.current;

    if (items.length === 0) return;

    try {
      const results = await fetcher(items);

      // Resolve all pending promises
      resolvers.forEach((resolver, key) => {
        if (results.has(key)) {
          resolver.resolve(results.get(key));
        } else {
          resolver.reject(new Error(`No result for key: ${key}`));
        }
      });
    } catch (error) {
      // Reject all pending promises
      resolvers.forEach((resolver) => {
        resolver.reject(error);
      });
    }

    // Clear the batch
    batchQueue.current = { items: [], resolvers: new Map() };
  }, [fetcher]);

  const addToBatch = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (item: T): Promise<any> => {
      const key = keyExtractor(item);

      return new Promise((resolve, reject) => {
        // Add to queue
        batchQueue.current.items.push(item);
        batchQueue.current.resolvers.set(key, { resolve, reject });

        // Clear existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Process batch if it's full or after delay
        if (batchQueue.current.items.length >= maxBatchSize) {
          processBatch();
        } else {
          timeoutRef.current = setTimeout(processBatch, batchDelay);
        }
      });
    },
    [keyExtractor, processBatch, maxBatchSize, batchDelay]
  );

  return { addToBatch };
}
