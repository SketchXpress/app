/* eslint-disable @typescript-eslint/no-explicit-any */
import { LAMPORTS_PER_SOL } from "./constants";

// Helper function to find account index by name in IDL
export const findAccountIndex = (
  idlInstruction: any,
  accountName: string
): number => {
  if (!idlInstruction || !idlInstruction.accounts) return -1;
  return idlInstruction.accounts.findIndex(
    (acc: any) => acc.name === accountName
  );
};

// Helper function for delay
export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Timer utility function for performance monitoring
export const createTimer = (label: string) => {
  const startTime = performance.now();
  return {
    stop: () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      if (process.env.NODE_ENV !== "production") {
        console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
      }
      return duration;
    },
  };
};

// Format lamports to SOL
export const formatLamports = (lamports: number): number =>
  lamports / LAMPORTS_PER_SOL;

// Format SOL with specified precision
export const formatSol = (sol: number, precision: number = 4): string =>
  sol.toFixed(precision);

// Create a exponential backoff with jitter
export const calculateBackoff = (
  attempt: number,
  baseDelay: number = 1000
): number => {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 300; // Random jitter to avoid thundering herd
  return exponentialDelay + jitter;
};
