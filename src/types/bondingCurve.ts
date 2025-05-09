import { PublicKey } from "@solana/web3.js";

export interface HistoryItem {
  signature: string;
  blockTime: number | null | undefined;
  instructionName: string;
  accounts: PublicKey[];
  args: unknown;
  description: string;
  type: string;
  source: string;
  error: unknown;
  poolAddress?: string;
  price?: number;
  isPriceLoading?: boolean;
  priceLoadAttempted?: boolean;
}
