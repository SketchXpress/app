import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { HeliusNFT, HeliusRPCResponse, NFT } from "@/types/helius";

/**
 * useWalletNFTs hook is for fetching NFTs owned by the connected wallet
 * with optimized caching
 *
 * @returns Query result containing NFTs, loading state, and error state
 */
export const useWalletNFTs = () => {
  const { publicKey, connected } = useWallet();

  return useQuery<NFT[], Error>({
    queryKey: ["walletNFTs", publicKey?.toString()],
    queryFn: async (): Promise<NFT[]> => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
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
            ownerAddress: publicKey.toString(),
            page: 1,
            limit: 100,
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

      // Transforming the data to match our NFT interface
      return data.result.items.map((item: HeliusNFT, index: number): NFT => {
        // Extract image URL from content
        let imageUrl = "/nft1.jpeg";

        if (item.content?.links?.image) {
          imageUrl = item.content.links.image;
        } else if (item.content?.files && item.content.files.length > 0) {
          const imageFile = item.content.files.find(
            (file) =>
              file.mime?.includes("image") ||
              (file.uri &&
                (file.uri.endsWith(".png") ||
                  file.uri.endsWith(".jpg") ||
                  file.uri.endsWith(".jpeg") ||
                  file.uri.endsWith(".gif")))
          );
          if (imageFile && imageFile.uri) {
            imageUrl = imageFile.uri;
          }
        } else if (item.content?.metadata?.image) {
          imageUrl = item.content.metadata.image;
        }

        return {
          id: item.id,
          mintAddress: item.id,
          name: item.content?.metadata?.name || `NFT #${index + 1}`,
          image: imageUrl,
          price: "0 SOL",
          collectionId: item.grouping?.[0]?.group_value || "",
          collectionName: item.content?.metadata?.symbol || "SketchXpress",
          uri: item.content?.metadata?.image || "",
        };
      });
    },
    enabled: connected && !!publicKey,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Helper function to extract image URL from NFT data
 * This is implemented inline above, but could be extracted for reuse
 */
export function extractImageUrl(nft: HeliusNFT): string {
  // Extract image URL from content
  let imageUrl = "/nft1.jpeg"; // Default fallback image

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

  return imageUrl;
}

export default useWalletNFTs;
