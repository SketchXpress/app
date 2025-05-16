export interface NFT {
  id: string;
  mintAddress: string;
  name: string;
  image: string;
  price: string;
  collectionId: string;
  collectionName: string;
  uri?: string;
  timestamp?: number | undefined;
}

export interface NFTCollection {
  uri?: string;
  id: number;
  poolAddress: string;
  title: string;
  floor: string;
  image: string;
  trending: boolean;
  supply?: number;
  collectionMint?: string;
}

export interface NFTMetadata {
  name?: string;
  image?: string;
  description?: string;
  attributes?: Array<{
    trait_type?: string;
    value?: string;
  }>;
  external_url?: string;
  background_color?: string;
  animation_url?: string;
}

export interface NFTWithMetadata {
  mintAddress: string;
  uri?: string;
  metadata?: NFTMetadata;
  error?: string;
}

export interface UseNFTMetadataConfig {
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  batchSize?: number;
  batchDelay?: number;
}

export interface SellNFTResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export interface UseSellNFTConfig {
  enableToast?: boolean;
  computeUnits?: number;
  priorityFee?: number;
  checkPoolBalance?: boolean;
}
