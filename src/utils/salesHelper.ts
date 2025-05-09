/* eslint-disable @typescript-eslint/no-explicit-any */
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export interface SaleEvent {
  signature: string;
  blockTime: number;
  soldSol?: number;
}

/**
 * Given the raw array from Helius's Parse Transaction(s) endpoint,
 * extract the "selling price" by finding the native-transfer that
 * corresponds to the rent‑refund / sale payment.
 */
export function extractSalesFromParsedTxs(parsedTxs: any[]): SaleEvent[] {
  return parsedTxs.map((tx) => {
    const signature: string = tx.signature;

    // Helius sometimes returns `blockTime`, other times just `timestamp`
    const blockTime: number =
      typeof tx.blockTime === "number"
        ? tx.blockTime
        : (tx.timestamp as number);

    let soldSol: number | undefined;
    if (Array.isArray(tx.nativeTransfers) && tx.nativeTransfers.length > 0) {
      const maxLamports = Math.max(
        ...tx.nativeTransfers.map((t: any) => t.amount)
      );
      soldSol = maxLamports / LAMPORTS_PER_SOL;
    }

    return { signature, blockTime, soldSol };
  });
}
