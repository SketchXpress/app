import { useQueries } from "@tanstack/react-query";
import { useGlobalCache } from "@/hook/shared/state/useGlobalCache";
import { useBatchRequests } from "@/hook/shared/utils/useBatchRequests";
import { NFTMetadata, UseNFTMetadataConfig } from "@/types/nft";

const isValidHttpUrl = (string: string): boolean => {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
};

const normalizeUri = (uri: string): string => {
  if (!uri) return "";

  // Handle IPFS URLs
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.substring(7)}`;
  }

  // Handle Arweave URLs
  if (uri.startsWith("ar://")) {
    return `https://arweave.net/${uri.substring(5)}`;
  }

  // Add https if missing
  if (!uri.startsWith("http") && !uri.startsWith("//")) {
    return `https://${uri}`;
  }

  return uri;
};

const fetchSingleMetadata = async (
  uri: string
): Promise<NFTMetadata | null> => {
  if (!uri || !isValidHttpUrl(normalizeUri(uri))) {
    return null;
  }

  try {
    const response = await fetch(normalizeUri(uri), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch metadata from ${uri}: ${response.status}`);
      return null;
    }

    const metadata = await response.json();
    return metadata as NFTMetadata;
  } catch (error) {
    console.error(`Error fetching metadata from ${uri}:`, error);
    return null;
  }
};

// Batch fetching function
const batchFetchMetadata = async (
  uris: string[]
): Promise<Map<string, NFTMetadata | null>> => {
  const results = new Map<string, NFTMetadata | null>();

  // Process in batches to avoid overwhelming servers
  const batchSize = 10;
  for (let i = 0; i < uris.length; i += batchSize) {
    const batch = uris.slice(i, i + batchSize);

    // Fetch in parallel within batch
    const batchPromises = batch.map(async (uri) => {
      const metadata = await fetchSingleMetadata(uri);
      return { uri, metadata };
    });

    const batchResults = await Promise.allSettled(batchPromises);

    batchResults.forEach((result, index) => {
      const uri = batch[index];
      if (result.status === "fulfilled") {
        results.set(uri, result.value.metadata);
      } else {
        console.error(`Failed to fetch metadata for ${uri}:`, result.reason);
        results.set(uri, null);
      }
    });

    // Add delay between batches to be respectful to servers
    if (i + batchSize < uris.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
};

export function useNFTMetadata(uri: string, config: UseNFTMetadataConfig = {}) {
  const {
    enabled = true,
    staleTime = 5 * 60 * 1000, // 5 minutes
    gcTime = 30 * 60 * 1000, // 30 minutes
  } = config;

  const cache = useGlobalCache();

  return useQueries({
    queries: [
      {
        queryKey: ["nftMetadata", uri],
        queryFn: () => {
          // Check cache first
          const cached = cache.get(`metadata-${uri}`);
          if (cached) return cached;

          return fetchSingleMetadata(uri).then((metadata) => {
            if (metadata) {
              cache.set(`metadata-${uri}`, metadata, staleTime);
            }
            return metadata;
          });
        },
        enabled: enabled && !!uri,
        staleTime,
        gcTime,
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
      },
    ],
  })[0];
}

// Batch NFT Metadata Hook
export function useNFTMetadataBatch(
  nfts: { mintAddress: string; uri?: string }[],
  config: UseNFTMetadataConfig = {}
) {
  const {
    enabled = true,
    staleTime = 5 * 60 * 1000,
    gcTime = 30 * 60 * 1000,
    batchSize = 10,
    batchDelay = 100,
  } = config;

  const cache = useGlobalCache();
  useBatchRequests({
    maxBatchSize: batchSize,
    batchDelay,
    keyExtractor: (item: string) => item,
    fetcher: batchFetchMetadata,
  });

  // Filter NFTs that have URIs
  const nftsWithUris = nfts.filter((nft) => nft.uri);

  // Group by domain to avoid CORS issues
  const nftsByDomain = nftsWithUris.reduce<
    Record<string, Array<(typeof nftsWithUris)[0]>>
  >((acc, nft) => {
    try {
      if (!nft.uri) return acc;

      const normalized = normalizeUri(nft.uri);
      if (!isValidHttpUrl(normalized)) return acc;

      const url = new URL(normalized);
      const domain = url.hostname;

      if (!acc[domain]) acc[domain] = [];
      acc[domain].push(nft);

      return acc;
    } catch {
      console.error(`Invalid URI for NFT ${nft.mintAddress}:`, nft.uri);
      return acc;
    }
  }, {});

  // Create a query for each domain batch
  return useQueries({
    queries: Object.entries(nftsByDomain).map(([domain, domainNfts]) => ({
      queryKey: [
        "nftMetadataBatch",
        domain,
        domainNfts.map((nft) => nft.mintAddress).join(","),
      ],
      queryFn: async () => {
        // Check cache for each item first
        const cachedResults = new Map<string, NFTMetadata | null>();
        const uncachedUris: string[] = [];

        domainNfts.forEach((nft) => {
          if (nft.uri) {
            const cached = cache.get(`metadata-${nft.uri}`);
            if (
              cached !== null &&
              typeof cached === "object" &&
              Object.keys(cached).length > 0
            ) {
              cachedResults.set(nft.uri, cached as NFTMetadata);
            } else {
              cachedResults.set(nft.uri, null);
              uncachedUris.push(nft.uri);
            }
          }
        });

        // Fetch uncached items
        let fetchedResults = new Map<string, NFTMetadata | null>();
        if (uncachedUris.length > 0) {
          fetchedResults = await batchFetchMetadata(uncachedUris);

          // Cache the results
          fetchedResults.forEach((metadata, uri) => {
            if (metadata) {
              cache.set(`metadata-${uri}`, metadata, staleTime);
            }
          });
        }

        // Combine cached and fetched results
        const combinedResults = new Map([...cachedResults, ...fetchedResults]);

        // Transform results to include mint addresses
        return domainNfts.map((nft) => ({
          mintAddress: nft.mintAddress,
          uri: nft.uri,
          metadata: nft.uri ? combinedResults.get(nft.uri) || null : null,
        }));
      },
      enabled: enabled && domainNfts.length > 0,
      staleTime,
      gcTime,
      retry: 1,
    })),
  });
}

// Export the batch fetching function for external use
export { batchFetchMetadata, normalizeUri, isValidHttpUrl };
