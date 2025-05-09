/* eslint-disable @typescript-eslint/no-explicit-any */
import { PublicKey } from "@solana/web3.js";

// Define interfaces for Helius API responses
export interface NativeTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number;
}

export interface HeliusTransaction {
  signature: string;
  description?: string;
  type?: string;
  source?: string;
  fee?: number;
  feePayer: string;
  slot?: number;
  timestamp?: number;
  nativeTransfers?: NativeTransfer[];
  tokenTransfers?: any[];
  accountData?: any[];
  transactionError?: any;
  instructions: any[];
  events?: any;
}

// Export the HistoryItem interface
export interface HistoryItem {
  signature: string;
  blockTime: number | null | undefined;
  instructionName: string;
  accounts: PublicKey[];
  args: any;
  description: string;
  type: string;
  source: string;
  error: any;
  poolAddress?: string;
  price?: number;
  isPriceLoading?: boolean; // Track price loading state
  priceLoadAttempted?: boolean; // Track if price load was attempted
}

// Type for pool prices record
export type PoolPrices = Record<
  string,
  number | "Price N/A" | "Invalid address"
>;

// Performance statistics interface
export interface PerformanceStats {
  totalApiCalls: number;
  totalRpcCalls: number;
  avgResponseTime: number;
  successfulPriceExtractions: number;
  failedPriceExtractions: number;
  lastFetchTime: number;
}

// Hook return type
export interface BondingCurveHistoryResult {
  history: HistoryItem[];
  isLoading: boolean;
  isLoadingPrices: boolean;
  error: string | null;
  loadMore: () => void;
  canLoadMore: boolean;
  clearCache: () => void;
  stats: PerformanceStats;
}
