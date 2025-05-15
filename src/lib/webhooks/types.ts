// src/lib/webhooks/types.ts - Enhanced with volume data
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface HeliusWebhookEvent {
  accountData: any[];
  blockchain: string;
  description: string;
  events: any;
  feePayer: string;
  instructions: Array<{
    accounts: string[];
    data: string;
    programId: string;
    innerInstructions?: any[];
  }>;
  nativeTransfers: any[]; // Important for extracting SOL amounts
  signature: string;
  slot: number;
  timestamp: number;
  tokenTransfers: any[];
  transactionError: any;
  type: string;
}

export interface HeliusWebhookPayload {
  events: HeliusWebhookEvent[];
  webhookType: string;
}

export interface CollectionEvent {
  type: "createPool" | "createCollectionNft" | "mintNft" | "sellNft" | "other";
  signature: string;
  timestamp: number;
  slot: number;
  poolAddress?: string;
  collectionMint?: string;
  collectionName?: string;
  accounts: string[];
  instructionData?: string;
  args?: Record<string, unknown>;
}

// Enhanced ProcessedWebhookData with volume tracking
export interface ProcessedWebhookData {
  signature: string;
  timestamp: number;
  slot: number;
  events: CollectionEvent[];
  hasCollectionEvents: boolean;
  newPools?: Pool[];
  newCollections?: Collection[];
  // NEW: Volume data for trending calculations
  volumeData?: Array<{
    type: "mint" | "sell";
    poolAddress: string;
    amount: number; // SOL amount
    trader: string;
    timestamp: number;
  }>;
}

export interface Collection {
  collectionMint: string;
  collectionName: string;
  symbol?: string;
  uri?: string;
  signature: string;
  timestamp: number;
}

export interface Pool {
  poolAddress: string;
  collectionMint: string;
  collectionName?: string;
  signature: string;
  timestamp: number;
  basePrice?: string;
  growthFactor?: string;
}

// NEW: Volume and trending related types
export interface VolumeMetrics {
  volume24h: number;
  transactions24h: number;
  uniqueTraders24h: number;
  priceChange24h: number;
  lastPrice: number;
}

export interface TrendingCollection {
  pool: Pool;
  collection?: Collection;
  metrics: VolumeMetrics;
  trendingScore: number;
  rank: number;
}

// Real-time update types
export interface RealTimeUpdate {
  type: "newCollection" | "newPool" | "transactionComplete" | "volumeUpdate";
  timestamp: number;
  data:
    | Collection
    | Pool
    | ProcessedWebhookData
    | {
        updatedPools: Array<{
          poolAddress: string;
          metrics: VolumeMetrics;
        }>;
      };
}

// SSE Event types
export interface SSEVolumeUpdateEvent {
  type: "volumeUpdate";
  timestamp: string;
  data: {
    updatedPools: Array<{
      poolAddress: string;
      metrics: VolumeMetrics;
    }>;
  };
}
