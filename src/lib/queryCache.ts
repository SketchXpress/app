import { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

/**
 * Sets up query persistence for the given QueryClient instance.
 * This function is designed to work in a browser environment.
 * It uses localStorage to persist the query cache.
 *
 * @param {QueryClient} queryClient - The QueryClient instance to set up persistence for.
 */
export function setupQueryPersistence(queryClient: QueryClient) {
  // Running in a browser environment
  if (typeof window === "undefined") return;

  const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: "mintstreet-query-cache",
    throttleTime: 1000,
  });

  persistQueryClient({
    queryClient,
    persister,
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    buster: process.env.NEXT_PUBLIC_BUILD_ID || "1",
  });
}
