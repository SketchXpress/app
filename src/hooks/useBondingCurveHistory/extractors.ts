/* eslint-disable @typescript-eslint/no-explicit-any */
import { PublicKey } from "@solana/web3.js";
import { HeliusTransaction, HistoryItem } from "./types";
import { LAMPORTS_PER_SOL } from "./constants";
import { findAccountIndex } from "./helpers";
import { BorshInstructionCoder } from "@coral-xyz/anchor";
import { cachePriceInfo, getPriceFromCache } from "./cache";

// Fast price extraction for mint operations (synchronous)
export const extractMintPrice = (
  tx: HeliusTransaction,
  escrowAddress?: string
): number | undefined => {
  // Check global price cache first via utility
  const cachedPrice = getPriceFromCache(tx.signature, escrowAddress);
  if (cachedPrice !== undefined) {
    return cachedPrice;
  }
  // Quick check for mint operations and native transfers
  if (
    tx.nativeTransfers &&
    Array.isArray(tx.nativeTransfers) &&
    escrowAddress
  ) {
    const payer = tx.feePayer;
    // Log transaction details before filtering native transfers
    console.table([
      {
        Signature: tx.signature,
        FeePayer: payer,
        EscrowAddress: escrowAddress,
        Note: "Attempting mint price extraction",
      },
    ]);

    // Find transfers to escrow (for mint operations)
    const transfersToEscrow = tx.nativeTransfers
      .filter(
        (transfer) =>
          transfer.fromUserAccount === payer &&
          transfer.toUserAccount === escrowAddress
      )
      .sort((a, b) => b.amount - a.amount); // Sort by amount descending

    if (transfersToEscrow.length > 0) {
      const price = transfersToEscrow[0].amount / LAMPORTS_PER_SOL;

      // Cache the price via utility
      cachePriceInfo(tx.signature, price, escrowAddress);

      return price;
    }
  }

  return undefined;
};

// Advanced price extraction for sell operations (async)
export const extractSellPrice = async (
  rpcRequestWithRetry: (method: string, params: any[]) => Promise<any>,
  signature: string,
  escrowAddress?: string,
  updatePerformance?: (success: boolean) => void
): Promise<number | undefined> => {
  // Check caches first
  const cachedPrice = getPriceFromCache(signature, escrowAddress);
  if (cachedPrice !== undefined) {
    return cachedPrice;
  }

  try {
    // Simplified and optimized RPC request
    const txDetails = await rpcRequestWithRetry("getTransaction", [
      signature,
      { commitment: "confirmed" }, // Let the RPC function add the optimization parameters
    ]);

    // Handle cached response (from our own cache)
    if (txDetails && "cachedPrice" in txDetails) {
      return txDetails.cachedPrice;
    }

    if (
      txDetails?.meta?.preBalances &&
      txDetails?.meta?.postBalances &&
      escrowAddress
    ) {
      // Extract account information
      let accountKeys: string[] = [];

      if (txDetails.transaction?.message) {
        const message = txDetails.transaction.message;
        if ("accountKeys" in message) {
          accountKeys = message.accountKeys.map((key: any) =>
            typeof key === "string" ? key : key.toBase58?.() || key.toString()
          );
        } else if ("staticAccountKeys" in message) {
          accountKeys = message.staticAccountKeys.map((key: any) =>
            typeof key === "string" ? key : key.toBase58?.() || key.toString()
          );
        }
      }

      const preBalances = txDetails.meta.preBalances;
      const postBalances = txDetails.meta.postBalances;
      const escrowAccountIndexInTx = accountKeys.findIndex(
        (key) => key === escrowAddress
      );

      if (
        escrowAccountIndexInTx !== -1 &&
        preBalances.length > escrowAccountIndexInTx &&
        postBalances.length > escrowAccountIndexInTx
      ) {
        const escrowPreBalance = preBalances[escrowAccountIndexInTx];
        const escrowPostBalance = postBalances[escrowAccountIndexInTx];
        const escrowBalanceChange = escrowPreBalance - escrowPostBalance;

        // Check for significant balance change (more than dust)
        if (escrowBalanceChange > 1000) {
          const price = escrowBalanceChange / LAMPORTS_PER_SOL;

          // Cache this result
          cachePriceInfo(signature, price, escrowAddress);

          // Update performance metrics if available
          if (updatePerformance) {
            updatePerformance(true);
          }

          return price;
        }
      }
    }

    // Update performance metrics for failures
    if (updatePerformance) {
      updatePerformance(false);
    }

    return undefined;
  } catch (err: any) {
    console.error(`Error extracting sell price for ${signature}:`, err.message);

    // Update performance metrics for failures
    if (updatePerformance) {
      updatePerformance(false);
    }

    return undefined;
  }
};

// Fast initial transaction processing (synchronous, no RPC calls)
export const processTransactionFast = (
  tx: HeliusTransaction,
  basicInfo: any,
  instructionCoder: BorshInstructionCoder,
  programId: PublicKey,
  bondingCurveIDL: any
): HistoryItem => {
  let decodedName = "Unknown";
  let decodedArgs: any = {};
  let decodedAccounts: PublicKey[] = [];
  let poolAddress: string | undefined = undefined;
  let escrowAddress: string | undefined = undefined;
  let price: number | undefined = undefined;
  let isSellOperation = false;

  if (tx.instructions && Array.isArray(tx.instructions)) {
    const mainInstructionIndex = tx.instructions.findIndex(
      (ix: any) => ix.programId === programId.toBase58() && ix.data
    );

    if (mainInstructionIndex !== -1) {
      const mainInstruction = tx.instructions[mainInstructionIndex];

      try {
        const decoded = instructionCoder.decode(mainInstruction.data, "base58");

        if (decoded) {
          decodedName = decoded.name;
          decodedArgs = decoded.data;

          if (
            mainInstruction.accounts &&
            Array.isArray(mainInstruction.accounts)
          ) {
            decodedAccounts = mainInstruction.accounts.map(
              (acc: string) => new PublicKey(acc)
            );

            const idlInstruction = bondingCurveIDL.instructions.find(
              (ix: any) => ix.name === decodedName
            );

            // Extract pool address
            const poolAccountIndex = findAccountIndex(idlInstruction, "pool");
            if (
              poolAccountIndex !== -1 &&
              mainInstruction.accounts.length > poolAccountIndex
            ) {
              poolAddress = mainInstruction.accounts[poolAccountIndex];
            }

            // Check if this is a mint or sell operation
            if (decodedName === "mintNft" || decodedName === "sellNft") {
              isSellOperation = decodedName === "sellNft";

              const escrowAccountIndex = findAccountIndex(
                idlInstruction,
                "escrow"
              );
              if (
                escrowAccountIndex !== -1 &&
                mainInstruction.accounts.length > escrowAccountIndex
              ) {
                escrowAddress = mainInstruction.accounts[escrowAccountIndex];

                // For mint operations, try to extract price synchronously
                if (!isSellOperation) {
                  price = extractMintPrice(tx, escrowAddress);
                }
              }
            }
          }
        }
      } catch (e) {
        console.error(`Error decoding instruction:`, e);
      }
    }
  }

  return {
    signature: tx.signature,
    blockTime: basicInfo.timestamp,
    instructionName: decodedName,
    accounts: decodedAccounts,
    args: decodedArgs,
    description: tx.description || "",
    type: tx.type || "",
    source: tx.source || "",
    error: tx.transactionError,
    poolAddress: poolAddress,
    price: price,
    isPriceLoading: isSellOperation, // Mark sell operations as loading prices
    priceLoadAttempted: !isSellOperation, // Mark non-sell operations as having attempted price load
  };
};
