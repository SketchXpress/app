/* eslint-disable @typescript-eslint/no-explicit-any */
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
