import { ReactNode } from "react";

export interface Collection {
  title: ReactNode;
  supply: boolean;
  id: string;
  rank: number;
  poolAddress: string;
  name: string;
  image: string;
  verified: boolean;
  nftCount: number;
  totalVolume: number;
  floor: string;
  trending: boolean;
  timestamp: number;
  transactions: number;
}

export interface FormattedCollection {
  id: string;
  rank: number;
  name: string;
  image: string;
  verified: boolean;
  nftCount: number;
  totalVolume: number;
  floor: string;
  trending: boolean;
}

export interface TrendingCollectionsConfig {
  maxCollections?: number;
  enablePricing?: boolean;
  sortBy?: "trending" | "top";
  refreshInterval?: number;
}

// src/types/collections.ts - Update to include enhanced types
export interface DynamicCollection {
  id: string;
  rank: number;
  name: string;
  image?: string;
  verified?: boolean;
  nftCount?: number;
  totalVolume: number;

  // Extended properties for trending
  poolAddress?: string;
  metrics?: PoolMetrics;
  trendingScore?: number;
}

export interface PoolMetrics {
  volume24h: number;
  transactions24h: number;
  uniqueTraders24h: number;
  priceChange24h: number;
  lastPrice: number;
}

export interface TrendingCollectionsConfig {
  maxCollections?: number;
  enablePricing?: boolean;
  sortBy?: "trending" | "top";
  refreshInterval?: number;
}

export interface TrendingCollectionsResult {
  collections: DynamicCollection[];
  leftCollections: DynamicCollection[];
  rightCollections: DynamicCollection[];
  isLoading: boolean;
  isLoadingPrices?: boolean;
  error: string | null;
  refetch: () => void;
  renderPoolPrice: (collection: DynamicCollection) => React.ReactNode;

  // Additional data for debugging/monitoring
  connectionState?: string;
  lastUpdate?: number;
  stats?: {
    totalCollections: number;
    connectionStatus: string;
    lastUpdate: number;
    hasMetrics: boolean;
    totalVolume?: number;
    totalTransactions?: number;
  };
}
