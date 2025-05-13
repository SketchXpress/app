// utils/metadataUtils.ts - Updated to handle your URI format

// Global cache for metadata to prevent re-fetching
const metadataCache = new Map<string, { name?: string; image?: string }>();

// Batch metadata fetching with caching
export const fetchMetadataBatch = async (
  uris: string[]
): Promise<Map<string, { name?: string; image?: string }>> => {
  const results = new Map<string, { name?: string; image?: string }>();
  const uncachedUris = uris.filter((uri) => !metadataCache.has(uri));

  if (uncachedUris.length === 0) {
    uris.forEach((uri) => results.set(uri, metadataCache.get(uri)!));
    return results;
  }

  const batchSize = 5;
  for (let i = 0; i < uncachedUris.length; i += batchSize) {
    const batch = uncachedUris.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (uri) => {
        try {
          let metadataUrl = uri;

          // Handle different URI formats
          if (uri.startsWith("ipfs://")) {
            metadataUrl = `https://ipfs.io/ipfs/${uri.substring(7)}`;
          } else if (uri.startsWith("ar://")) {
            metadataUrl = `https://arweave.net/${uri.substring(5)}`;
          }
          // Your URIs seem to already be HTTP URLs, so we'll use them directly

          console.log("Fetching metadata from:", metadataUrl); // Add logging

          const response = await fetch(
            `/api/metadata?uri=${encodeURIComponent(metadataUrl)}`
          );

          if (!response.ok) {
            console.error(
              `Failed to fetch metadata: ${response.status} ${response.statusText}`
            );
            return;
          }

          const metadata = await response.json();
          console.log("Fetched metadata:", metadata); // Add logging

          const result = { name: metadata.name, image: metadata.image };

          metadataCache.set(uri, result);
          results.set(uri, result);
        } catch (error) {
          console.error(`Error fetching metadata for ${uri}:`, error);
          metadataCache.set(uri, {});
        }
      })
    );

    if (i + batchSize < uncachedUris.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  // fill in any cached-only URIs
  uris.forEach((uri) => {
    if (!results.has(uri)) results.set(uri, metadataCache.get(uri)!);
  });

  return results;
};
