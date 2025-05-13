import { useRef, useCallback } from "react";

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

export function useDeduplicateRequests<T>() {
  const pendingRequests = useRef(new Map<string, PendingRequest<T>>());

  const deduplicatedFetch = useCallback(
    async (
      key: string,
      fetcher: () => Promise<T>,
      ttl: number = 1000 // 1 second TTL
    ): Promise<T> => {
      const now = Date.now();
      const pending = pendingRequests.current.get(key);

      // Return pending request if it exists and hasn't expired
      if (pending && now - pending.timestamp < ttl) {
        return pending.promise;
      }

      // Create new request
      const promise = fetcher().finally(() => {
        // Clean up after completion
        pendingRequests.current.delete(key);
      });

      pendingRequests.current.set(key, { promise, timestamp: now });
      return promise;
    },
    []
  );

  return { deduplicatedFetch };
}
