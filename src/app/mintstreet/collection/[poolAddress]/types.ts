/* eslint-disable @typescript-eslint/no-explicit-any */
// app/src/app/mintstreet/collection/[poolAddress]/types.ts - Extended types

export interface PoolInfo {
  collectionName: string;
  totalEscrowed: number;
  basePrice: number;
  growthFactor: number;
  currentSupply: number;
  protocolFeePercent: number;
  isActive: boolean;
  migrationStatus: string;
  creator: string;
  collection: string;
  // Optional real-time metrics that can be added from store
  volume24h?: number;
  transactions24h?: number;
  uniqueTraders24h?: number;
  priceChange24h?: number;
  lastPrice?: number;
}

export interface NFT {
  mintAddress: string;
  name: string;
  symbol: string;
  uri?: string;
  timestamp: number;
  signature: string;
  price: number;
  image?: string;
  minterAddress?: string;
}

export interface CollectionPageData {
  poolInfo: PoolInfo | null;
  nfts: NFT[];
  history: any[];
  isLoading: boolean;
  error: string | null;
  lastMintPrice: string;
  migrationProgress: number;
  // Extended fields for optimization
  dataSource?: {
    poolInfo: "store" | "api";
    nfts: "store" | "api";
    history: "store" | "empty";
    metrics: "realtime" | "none";
    connectionState: string;
    lastUpdate: number;
  };
  hasRealtimeData?: boolean;
}
