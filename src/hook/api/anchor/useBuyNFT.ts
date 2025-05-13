/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback } from "react";
import { useAnchorContext } from "@/contexts/AnchorContextProvider";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import { safePublicKey, isValidPublicKeyFormat } from "@/utils/bn-polyfill";
import { toast } from "@/utils/toast";

// Types
export interface BuyNFTResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export interface PoolData {
  currentPrice: number | bigint;
  collection: PublicKey;
  creator: PublicKey;
  escrow: PublicKey;
}

export interface UseBuyNFTConfig {
  enableToast?: boolean;
  computeUnits?: number;
  priorityFee?: number;
}

// Helper Functions
const safeStringifyError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    try {
      const errorObj = error as any;

      // Check for Anchor Error with custom error codes
      if (errorObj.error && errorObj.error.errorCode) {
        const code = errorObj.error.errorCode.number;
        // Map common error codes
        switch (code) {
          case 6000:
            return "Insufficient funds or pool capacity exceeded";
          case 6001:
            return "NFT already exists in this pool";
          case 6002:
            return "Pool is not active";
          default:
            return `Anchor error code: ${code}`;
        }
      }

      if (errorObj.message) {
        return String(errorObj.message);
      }

      if (errorObj.logs && Array.isArray(errorObj.logs)) {
        return errorObj.logs.join("\n");
      }

      return JSON.stringify(error, null, 2);
    } catch {
      return `[Complex Error Object: ${typeof error}]`;
    }
  }

  return `[Unknown Error: ${typeof error}]`;
};

const formatPrice = (price: number | bigint): string => {
  const priceNumber = typeof price === "bigint" ? Number(price) : price;
  return (priceNumber / 1e9).toFixed(4); // Convert lamports to SOL
};

// Main Hook
export function useBuyNFT(config: UseBuyNFTConfig = {}) {
  const {
    enableToast = true,
    computeUnits = 400000,
    priorityFee = 50000,
  } = config;

  const { program } = useAnchorContext();
  const wallet = useWallet();

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset state
  const resetState = useCallback(() => {
    setError(null);
    setTxSignature(null);
    setSuccess(false);
  }, []);

  // Buy from pool function
  const buyFromPool = useCallback(
    async (
      nftMintAddress: string,
      poolAddress: string
    ): Promise<BuyNFTResult> => {
      if (!program || !wallet.publicKey) {
        const errorMsg = "Program not initialized or wallet not connected";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      setLoading(true);
      resetState();

      try {
        // Validate inputs
        if (!isValidPublicKeyFormat(nftMintAddress)) {
          throw new Error("Invalid NFT mint address format");
        }

        if (!isValidPublicKeyFormat(poolAddress)) {
          throw new Error("Invalid pool address format");
        }

        const nftMint = safePublicKey(nftMintAddress);
        const pool = safePublicKey(poolAddress);

        if (!nftMint || !pool) {
          throw new Error("Invalid address format");
        }

        // Get pool data to get current price
        const poolData = (await program.account.bondingCurvePool.fetch(
          pool
        )) as unknown as PoolData;
        const currentPrice = poolData.currentPrice;

        console.log(
          `Buying NFT ${nftMintAddress} from pool for ${formatPrice(
            currentPrice
          )} SOL`
        );

        // Get buyer's associated token account
        const buyerNftTokenAccount = await getAssociatedTokenAddress(
          nftMint,
          wallet.publicKey
        );

        // Check if token account exists, create if not
        let needsTokenAccount = false;
        try {
          await getAccount(program.provider.connection, buyerNftTokenAccount);
        } catch {
          needsTokenAccount = true;
        }

        // Find NFT escrow PDA
        const [escrow] = PublicKey.findProgramAddressSync(
          [Buffer.from("nft-escrow"), nftMint.toBuffer()],
          program.programId
        );

        // Create instructions
        const instructions = [];

        // Add compute unit limit instruction
        instructions.push(
          ComputeBudgetProgram.setComputeUnitLimit({
            units: computeUnits,
          })
        );

        // Add priority fee instruction
        instructions.push(
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: priorityFee,
          })
        );

        // Add create token account instruction if needed
        if (needsTokenAccount) {
          instructions.push(
            createAssociatedTokenAccountInstruction(
              wallet.publicKey,
              buyerNftTokenAccount,
              wallet.publicKey,
              nftMint
            )
          );
        }

        // Execute the buy transaction
        const tx = await program.methods
          .buyNft()
          .accounts({
            buyer: wallet.publicKey,
            pool: pool,
            escrow: escrow,
            nftMint: nftMint,
            buyerNftTokenAccount: buyerNftTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            // Add other required accounts based on your program
          })
          .preInstructions(instructions)
          .rpc({
            skipPreflight: false,
            commitment: "confirmed",
          });

        console.log("NFT bought successfully with signature:", tx);
        setTxSignature(tx);
        setSuccess(true);

        if (enableToast) {
          toast.success(
            `Successfully purchased NFT! Transaction: ${tx.slice(0, 8)}...`
          );
        }

        return { success: true, signature: tx };
      } catch (err) {
        const errorMessage = safeStringifyError(err);
        console.error("Error buying NFT from pool:", errorMessage);
        setError(errorMessage);

        if (enableToast) {
          toast.error(`Failed to buy NFT: ${errorMessage}`);
        }

        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [
      program,
      wallet.publicKey,
      resetState,
      enableToast,
      computeUnits,
      priorityFee,
    ]
  );

  // Buy from user function (placeholder for future implementation)
  const buyFromUser = useCallback(
    async (
      nftMintAddress: string,
      sellerAddress: string,
      price: number
    ): Promise<BuyNFTResult> => {
      if (!program || !wallet.publicKey) {
        const errorMsg = "Program not initialized or wallet not connected";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      setLoading(true);
      resetState();

      try {
        // TODO: Implement peer-to-peer or marketplace purchase logic
        console.log(
          `Buying NFT ${nftMintAddress} from user ${sellerAddress} for ${price} SOL`
        );

        // This would typically involve:
        // 1. Escrow or marketplace contract interaction
        // 2. Transfer of SOL from buyer to seller
        // 3. Transfer of NFT from seller to buyer

        throw new Error("Secondary market purchases not yet implemented");
      } catch (err) {
        const errorMessage = safeStringifyError(err);
        console.error("Error buying NFT from user:", errorMessage);
        setError(errorMessage);

        if (enableToast) {
          toast.error(`Failed to buy NFT from user: ${errorMessage}`);
        }

        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [program, wallet.publicKey, resetState, enableToast]
  );

  return {
    buyFromPool,
    buyFromUser,
    loading,
    error,
    txSignature,
    success,
    resetState,
  };
}
export { formatPrice, safeStringifyError };
