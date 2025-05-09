import { useQueries } from "@tanstack/react-query";

/**
 *
 * @param nfts - Array of NFTs with mintAddress and optional uri
 * @param nfts[].mintAddress - The mint address of the NFT
 * @param nfts[].uri - The URI of the NFT metadata
 */
export const useNFTMetadataBatch = (
  nfts: { mintAddress: string; uri?: string }[]
) => {
  const nftsWithUris = nfts.filter((nft) => nft.uri);

  // Grouping NFTs by domain to avoid CORS issues and rate limiting
  const nftsByDomain = nftsWithUris.reduce<
    Record<string, Array<(typeof nftsWithUris)[0] & { cleanUri: string }>>
  >((acc, nft) => {
    try {
      if (!nft.uri) return acc;

      // Clean URI
      let uri = nft.uri;
      if (!uri.startsWith("http")) {
        uri = `https://${uri.replace("://", "")}`;
      }

      const url = new URL(uri);
      const domain = url.hostname;

      if (!acc[domain]) acc[domain] = [];
      acc[domain].push({ ...nft, cleanUri: uri });

      return acc;
    } catch {
      console.error(`Invalid URI for NFT ${nft.mintAddress}:`, nft.uri);
      return acc;
    }
  }, {});

  // Create a query for each domain batch
  return useQueries({
    queries: Object.entries(nftsByDomain).map(([domain, domainNfts]) => {
      return {
        queryKey: [
          "nftMetadata",
          domain,
          domainNfts.map((nft) => nft.mintAddress).join(","),
        ],
        queryFn: async () => {
          // Fetch metadata for this domain's NFTs in batches of 5
          const batchSize = 5;
          const metadataMap: Record<string, unknown> = {};

          for (let i = 0; i < domainNfts.length; i += batchSize) {
            const batch = domainNfts.slice(i, i + batchSize);

            // Fetch in parallel within a batch
            const results = await Promise.all(
              batch.map(async (nft) => {
                try {
                  const response = await fetch(nft.cleanUri);
                  if (!response.ok)
                    throw new Error(`HTTP error ${response.status}`);

                  const metadata = await response.json();
                  return { mintAddress: nft.mintAddress, metadata };
                } catch (error) {
                  console.error(
                    `Error fetching metadata for ${nft.mintAddress}:`,
                    error
                  );
                  return { mintAddress: nft.mintAddress, metadata: null };
                }
              })
            );

            // Add to metadata map
            results.forEach((result) => {
              if (result && result.metadata) {
                metadataMap[result.mintAddress] = result.metadata;
              }
            });

            // Add a small delay between batches
            if (i + batchSize < domainNfts.length) {
              await new Promise((resolve) => setTimeout(resolve, 300));
            }
          }

          return metadataMap;
        },
        staleTime: 5 * 60 * 1000,
        cacheTime: 30 * 60 * 1000,
      };
    }),
  });
};
