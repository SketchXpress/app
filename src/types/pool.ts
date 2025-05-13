export interface PoolPrice {
  address: string;
  price: number | null;
  error?: string;
}

export type PoolPrices = Record<
  string,
  number | "Price N/A" | "Invalid address"
>;

export interface BondingCurvePool {
  totalEscrowed: {
    toNumber: () => number;
  };
}

export interface UsePoolPricesConfig {
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  refetchOnWindowFocus?: boolean;
  batchSize?: number;
  batchDelay?: number;
}

export interface PoolInfo {
  collection: string;
  creator: string;
  basePrice: number;
  growthFactor: number;
  currentSupply: number;
  protocolFeePercent: number;
  totalEscrowed: number;
  isActive: boolean;
  migrationStatus: string;
  migrationProgress: string;
  collectionName: string;
}

export interface UsePoolInfoConfig {
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  refetchOnWindowFocus?: boolean;
}
