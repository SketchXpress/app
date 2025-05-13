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

export interface DynamicCollection {
  id: string;
  rank: number;
  name: string;
  image: string;
  verified: boolean;
  nftCount?: number;
  totalVolume: number;
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

export interface TrendingCollectionsResult {
  collections: DynamicCollection[];
  leftCollections: DynamicCollection[];
  rightCollections: DynamicCollection[];
  isLoading: boolean;
  isLoadingPrices: boolean;
  error: string | null;
  refetch: () => void;
  renderPoolPrice: (collection: DynamicCollection) => React.ReactNode;
}
