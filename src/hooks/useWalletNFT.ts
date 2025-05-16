// src/hooks/useWalletNFT.ts
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

// Define the NFT interface to match what we'll use in MyNFT component
export interface NFT {
  id: string;
  mintAddress: string;
  name: string;
  image: string;
  price: string;
  collectionId: string;
  collectionName: string;
}

// Define types for the Helius RPC response
interface HeliusNFTFile {
  uri: string;
  cdn_uri?: string;
  mime?: string;
}

interface HeliusNFTMetadata {
  name?: string;
  symbol?: string;
  description?: string;
  image?: string;
  attributes?: Array<{
    trait_type?: string;
    value?: string;
  }>;
  token_standard?: string;
}

interface HeliusNFTContent {
  $schema?: string;
  json_uri?: string;
  files?: HeliusNFTFile[];
  metadata?: HeliusNFTMetadata;
  links?: {
    image?: string;
  };
}

interface HeliusNFTGrouping {
  group_key?: string;
  group_value?: string;
}

interface HeliusNFT {
  id: string;
  interface: string;
  content: HeliusNFTContent;
  authorities?: unknown[];
  compression?: unknown;
  grouping?: HeliusNFTGrouping[];
  royalty?: unknown;
  creators?: unknown[];
  ownership?: {
    owner?: string;
  };
  supply?: unknown;
  mutable?: boolean;
  burnt?: boolean;
  token_info?: unknown;
}

interface HeliusRPCResponse {
  jsonrpc: string;
  id: string;
  result: {
    total: number;
    limit: number;
    page: number;
    items: HeliusNFT[];
  };
  error?: {
    code: number;
    message: string;
  };
}

export function useWalletNFTs() {
  const { publicKey, connected } = useWallet();
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWalletNFTs = async () => {
      if (!publicKey || !connected) {
        setNfts([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Use the Helius RPC endpoint directly with the getAssetsByOwner method
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
          throw new Error(
            `Helius API error: ${response.status} - ${errorText}`
          );
        }

        const data = (await response.json()) as HeliusRPCResponse;

        if (data.error) {
          throw new Error(`RPC Error: ${JSON.stringify(data.error)}`);
        }

        // Transform the data to match our NFT interface
        const formattedNfts: NFT[] = data.result.items.map(
          (nft: HeliusNFT, index: number) => {
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
                      file.uri.endsWith(".gif")))
              );
              if (imageFile && imageFile.uri) {
                imageUrl = imageFile.uri;
              }
            }

            return {
              id: nft.id,
              mintAddress: nft.id,
              name: nft.content?.metadata?.name || `NFT #${index + 1}`,
              image: imageUrl,
              price: "0 SOL", // Price information not easily available
              collectionId: nft.grouping?.[0]?.group_value || "",
              collectionName: nft.content?.metadata?.symbol || "SketchXpress",
            };
          }
        );
        setNfts(formattedNfts);
      } catch (err) {
        console.error("Error fetching wallet NFTs:", err);
        setError(err instanceof Error ? err.message : "Failed to load NFTs");
      } finally {
        setLoading(false);
      }
    };

    fetchWalletNFTs();

    // Set up an interval to refresh NFTs periodically (every 30 seconds)
    // const intervalId = setInterval(fetchWalletNFTs, 30000);

    // Clean up interval on component unmount
    // return () => clearInterval(intervalId);
  }, [publicKey, connected]);

  return { nfts, loading, error };
}

export default useWalletNFTs;
