import { PublicKey } from "@solana/web3.js";

// Helius API endpoint configuration
export const HELIUS_API_KEY = "70eef812-8d6b-496f-bc30-1725d5acb800";
export const HELIUS_API_BASE = "https://api-devnet.helius.xyz/v0";
export const HELIUS_RPC_ENDPOINT = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
export const PROGRAM_ID = "FCpT1hnh9JKPmCR8s1rPA2ab5mETT9TFUcbDdnXhLPdu";
export const PROGRAM_PUBLIC_KEY = new PublicKey(PROGRAM_ID);

// Default fetch limits
export const DEFAULT_LIMIT = 5;

// Cache settings
export const DEFAULT_MAX_CACHE_SIZE = 500;
export const DEFAULT_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Performance tuning settings
export const CONCURRENT_RPC_LIMIT = 3; // Process 3 RPC calls in parallel
export const MIN_RPC_DELAY = 3000; // 3 seconds between RPC calls
export const BACKGROUND_PROCESS_BATCH = 5; // Process 5 sell operations in background
export const MAX_RETRIES = 3; // Maximum number of retries for errors
export const RETRY_DELAY_BASE = 2000; // Base delay for retries (2 seconds)

// Conversion constants
export const LAMPORTS_PER_SOL = 1_000_000_000;
