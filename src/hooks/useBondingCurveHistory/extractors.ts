/* eslint-disable @typescript-eslint/no-explicit-any */
import { PublicKey } from "@solana/web3.js";
import {
  HeliusTransaction,
  HistoryItem,
} from "../../hook/useBondingCurveHistory/types";
import { LAMPORTS_PER_SOL } from "./constants";
import { findAccountIndex } from "./helpers";
import { BorshInstructionCoder } from "@coral-xyz/anchor";
import { cachePriceInfo, getPriceFromCache } from "./cache";

// Fixed price extraction for mint operations (synchronous)
export const extractMintPrice = (
  tx: HeliusTransaction,
  escrowAddress?: string
): number | undefined => {
  // Check global price cache first via utility
  const cachedPrice = getPriceFromCache(tx.signature, escrowAddress);
  if (cachedPrice !== undefined) {
    return cachedPrice;
  }

  // Method 1: Calculate total balance change of the payer (most accurate)
  if (tx.accountData && Array.isArray(tx.accountData) && tx.feePayer) {
    const payerAccount = tx.accountData.find(
      (account) => account.account === tx.feePayer
    );

    if (payerAccount && payerAccount.nativeBalanceChange) {
      // nativeBalanceChange is negative for outgoing payments
      const totalPaid =
        Math.abs(payerAccount.nativeBalanceChange) / LAMPORTS_PER_SOL;

      // Only consider significant amounts (> 0.001 SOL to filter out pure fee transactions)
      if (totalPaid > 0.001) {
        // Cache the price via utility
        cachePriceInfo(tx.signature, totalPaid, escrowAddress);
        return totalPaid;
      }
    }
  }

  // Method 2: Sum all outgoing native transfers from payer (fallback)
  if (tx.nativeTransfers && Array.isArray(tx.nativeTransfers) && tx.feePayer) {
    const payer = tx.feePayer;

    // Find ALL transfers FROM the payer (not just to escrow)
    const allOutgoingTransfers = tx.nativeTransfers
      .filter((transfer) => transfer.fromUserAccount === payer)
      .reduce((total, transfer) => total + transfer.amount, 0);

    if (allOutgoingTransfers > 0) {
      const totalPaid = allOutgoingTransfers / LAMPORTS_PER_SOL;

      // Only consider significant amounts
      if (totalPaid > 0.001) {
        // Cache the price via utility
        cachePriceInfo(tx.signature, totalPaid, escrowAddress);
        return totalPaid;
      }
    }
  }

  // Method 3: Original method (only escrow transfer) - keep as final fallback
  if (
    tx.nativeTransfers &&
    Array.isArray(tx.nativeTransfers) &&
    escrowAddress
  ) {
    const payer = tx.feePayer;

    // Find transfers to escrow (for mint operations)
    const transfersToEscrow = tx.nativeTransfers
      .filter(
        (transfer) =>
          transfer.fromUserAccount === payer &&
          transfer.toUserAccount === escrowAddress
      )
      .sort((a, b) => b.amount - a.amount); // Sort by amount descending

    if (transfersToEscrow.length > 0) {
      const escrowPrice = transfersToEscrow[0].amount / LAMPORTS_PER_SOL;

      // Cache the price via utility
      cachePriceInfo(tx.signature, escrowPrice, escrowAddress);
      return escrowPrice;
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
    isPriceLoading: isSellOperation,
    priceLoadAttempted: !isSellOperation,
  };
};
