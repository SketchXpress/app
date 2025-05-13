import { NFT } from "@/types/nft";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { HeliusNFT, HeliusRPCResponse } from "@/types/helius";
import { useDeduplicateRequests } from "@/hook/shared/utils/useDeduplicateRequests";

const formatImageUrl = (nft: HeliusNFT): string => {
  // Fallback image
  let imageUrl = "/assets/images/defaultNFT.png";

  if (nft.content?.links?.image) {
    imageUrl = nft.content.links.image;
  } else if (nft.content?.files && nft.content.files.length > 0) {
    const imageFile = nft.content.files.find(
      (file) =>
        file.mime?.includes("image") ||
        (file.uri &&
          (file.uri.endsWith(".png") ||
            file.uri.endsWith(".jpg") ||
            file.uri.endsWith(".jpeg") ||
            file.uri.endsWith(".webp") ||
            file.uri.endsWith(".gif")))
    );
    if (imageFile && imageFile.uri) {
      imageUrl = imageFile.uri;
    }
  } else if (nft.content?.metadata?.image) {
    imageUrl = nft.content.metadata.image;
  }

  // Handle IPFS URLs
  if (imageUrl.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${imageUrl.substring(7)}`;
  }

  // Handle Arweave URLs
  if (imageUrl.startsWith("ar://")) {
    return `https://arweave.net/${imageUrl.substring(5)}`;
  }

  return imageUrl;
};

const transformHeliusNFT = (nft: HeliusNFT, index: number): NFT => {
  return {
    id: nft.id,
    mintAddress: nft.id,
    name: nft.content?.metadata?.name || `NFT #${index + 1}`,
    image: formatImageUrl(nft),
    price: "0 SOL", // Default Price
    collectionId: nft.grouping?.[0]?.group_value || "",
    collectionName: nft.content?.metadata?.symbol || "SketchXpress",
    uri: nft.content?.metadata?.image || "",
  };
};

const fetchWalletNFTs = async (
  publicKey: string,
  page: number = 1,
  limit: number = 100
): Promise<NFT[]> => {
  const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;

  if (!HELIUS_API_KEY) {
    throw new Error("Helius API key not found");
  }

  const RPC_URL = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "my-id",
      method: "getAssetsByOwner",
      params: {
        ownerAddress: publicKey,
        page,
        limit,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Helius API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as HeliusRPCResponse;

  if (data.error) {
    throw new Error(`RPC Error: ${JSON.stringify(data.error)}`);
  }

  // Transform the data to match our NFT interface
  return data.result.items.map(transformHeliusNFT);
};

// Configuration
export interface UseWalletNFTsConfig {
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  refetchOnWindowFocus?: boolean;
  limit?: number;
}

// Main Hook
export function useWalletNFTs(config: UseWalletNFTsConfig = {}) {
  const {
    enabled = true,
    staleTime = 60 * 1000,
    gcTime = 5 * 60 * 1000,
    refetchOnWindowFocus = false,
    limit = 100,
  } = config;

  const { publicKey, connected } = useWallet();
  const { deduplicatedFetch } = useDeduplicateRequests<NFT[]>();

  return useQuery<NFT[], Error>({
    queryKey: ["walletNFTs", publicKey?.toString(), limit],
    queryFn: () => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      return deduplicatedFetch(
        `wallet-nfts-${publicKey.toString()}-${limit}`,
        () => fetchWalletNFTs(publicKey.toString(), 1, limit),
        30000 // 30 second deduplication window
      );
    },
    enabled: enabled && connected && !!publicKey,
    staleTime,
    gcTime,
    refetchOnWindowFocus,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

// Export helper functions for external use
export { formatImageUrl, transformHeliusNFT };
