/* eslint-disable @typescript-eslint/no-explicit-any */
// src/utils/processHeliusData.ts

import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export interface SaleEvent {
  signature: string;
  timestamp: number;
  soldSol?: number;
}

/**
 * Given the raw array of Helius transaction objects (the 42 entries you fetched),
 * and your pool (escrow) address, return for each tx:
 *  - signature
 *  - timestamp
 *  - soldSol (undefined if this tx wasn’t a “sell”)
 */
export function extractSellingPricesFromHelius(
  rawTxs: any[],
  poolAddress: string
): SaleEvent[] {
  return rawTxs.map((tx) => {
    const { signature, timestamp, accountData } = tx;
    // find the escrow account’s nativeBalanceChange
    const escrowEntry = accountData.find((a: any) => a.account === poolAddress);

    let soldSol: number | undefined;
    if (escrowEntry && typeof escrowEntry.nativeBalanceChange === "number") {
      // only consider positive changes as “redeems”
      const lamports = escrowEntry.nativeBalanceChange;
      if (lamports > 0) {
        soldSol = lamports / LAMPORTS_PER_SOL;
      }
    }
    return { signature, timestamp, soldSol };
  });
}
