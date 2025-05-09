// src/utils/fetchSellingPrice.ts

import {
  Connection,
  PublicKey,
  ParsedTransactionWithMeta,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  Commitment,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export interface SaleEvent {
  signature: string;
  blockTime: number | null;
  redeemedSol?: number;
  accounts: string[];
}

// scan innerInstructions for the SPL‑Token closeAccount and compute redeemed SOL
function extractRedeemedSol(tx: ParsedTransactionWithMeta): number | undefined {
  if (!tx.meta?.innerInstructions) return undefined;

  const { preBalances, postBalances, fee, innerInstructions } = tx.meta;
  const keys = tx.transaction.message.accountKeys.map((k) =>
    k.pubkey.toBase58()
  );

  for (const inner of innerInstructions) {
    for (const instr of inner.instructions) {
      if (
        "parsed" in instr &&
        instr.programId.equals(TOKEN_PROGRAM_ID) &&
        instr.parsed.type === "closeAccount"
      ) {
        const dest = instr.parsed.info.destination as string;
        const idx = keys.indexOf(dest);
        if (idx !== -1) {
          const lamportDelta = postBalances[idx] - preBalances[idx] + fee;
          return lamportDelta / LAMPORTS_PER_SOL;
        }
      }
    }
  }
  return undefined;
}

/**
 * Fetch exactly the last 40 sales for a given escrow (pool) account.
 */
export async function fetchSellingPrice(
  escrow: PublicKey,
  cluster: "devnet" | "mainnet-beta" = "devnet"
): Promise<SaleEvent[]> {
  const connection = new Connection(clusterApiUrl(cluster), "confirmed");
  const commitment: Commitment = "confirmed";

  // 1) Pull the last 40 signatures touching this escrow
  const sigInfos = await connection.getSignaturesForAddress(escrow, {
    limit: 100,
  });
  const signatures = sigInfos.map((s) => s.signature);

  // 2) One‑shot batch fetch of parsed transactions
  const txs = await connection.getParsedTransactions(signatures, {
    commitment,
  });

  // 3) Map into SaleEvent[]
  const events: SaleEvent[] = signatures.map((sig, i) => {
    const tx = txs[i];
    const blockTime = tx?.blockTime ?? null;
    const accounts = tx
      ? tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58())
      : [];
    const redeemedSol = tx ? extractRedeemedSol(tx) : undefined;
    return { signature: sig, blockTime, redeemedSol, accounts };
  });

  // 4) Log the first event for quick sanity check
  if (events.length) {
    console.log("First sale event:", events[0]);
  }

  return events;
}
