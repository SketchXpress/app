/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

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
  getAccount,
} from "@solana/spl-token";
import { useState } from "react";
import { safePublicKey, isValidPublicKeyFormat } from "@/utils/bn-polyfill";

// Metaplex Token Metadata Program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// Helper function to safely stringify any error object
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
        // Check for math overflow error code
        if (code === 6000) {
          return "Cannot sell this NFT due to a math overflow error. This may happen if the pool doesn't have enough SOL to buy back the NFT.";
        }
      }

      if (errorObj.message) {
        return String(errorObj.message);
      }
      if (errorObj.error && errorObj.error.message) {
        return String(errorObj.error.message);
      }
      if (errorObj.logs && Array.isArray(errorObj.logs)) {
        // Check for specific error in logs
        for (const log of errorObj.logs) {
          if (typeof log === "string" && log.includes("MathOverflow")) {
            return "Cannot sell this NFT due to a math overflow error. This may happen if the pool doesn't have enough SOL to buy back the NFT.";
          }
        }
        return errorObj.logs.join("\n");
      }

      return JSON.stringify(error, null, 2);
    } catch {
      return `[Complex Error Object: ${typeof error}]`;
    }
  }

  return `[Unknown Error: ${typeof error}]`;
};

export const useSellNft = () => {
  const { program } = useAnchorContext();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [soldNfts, setSoldNfts] = useState<Set<string>>(new Set());

  const sellNft = async (nftMintAddress: string, poolAddress: string) => {
    if (!program || !wallet.publicKey) {
      setError("Program not initialized or wallet not connected");
      return {
        success: false,
        error: "Program not initialized or wallet not connected",
      };
    }

    if (!wallet.signTransaction) {
      setError("Wallet does not support transaction signing");
      return {
        success: false,
        error: "Wallet does not support transaction signing",
      };
    }

    setLoading(true);
    setError(null);
    setTxSignature(null);
    setSuccess(false);

    try {
      // Increase compute unit limit to handle more complex transactions
      const computeUnitLimitInstruction =
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 600000, // Increased from 400,000 to 600,000 CUs
        });

      // Validate NFT mint address
      if (!isValidPublicKeyFormat(nftMintAddress)) {
        throw new Error("Invalid NFT mint address format");
      }
      const nftMint = safePublicKey(nftMintAddress);
      if (!nftMint) {
        throw new Error("Invalid NFT mint address");
      }

      // Validate pool address
      if (!isValidPublicKeyFormat(poolAddress)) {
        throw new Error("Invalid pool address format");
      }
      const pool = safePublicKey(poolAddress);
      if (!pool) {
        throw new Error("Invalid pool address");
      }

      // Get pool data to retrieve collection mint and creator
      const poolData = await program.account.bondingCurvePool.fetch(pool);
      const collectionMint = poolData.collection as PublicKey;
      const creator = poolData.creator as PublicKey;

      // Check if pool has enough SOL to buy the NFT
      const poolBalance = await program.provider.connection.getBalance(pool);

      // If pool balance is very low, we might want to warn the user
      if (poolBalance < 10000) {
        // Less than 0.00001 SOL
        console.warn("Pool balance is very low, transaction might fail");
      }

      // Derive collection metadata PDA
      const [collectionMetadata] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          collectionMint.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      // Find NFT escrow PDA
      const [escrow] = PublicKey.findProgramAddressSync(
        [Buffer.from("nft-escrow"), nftMint.toBuffer()],
        program.programId
      );

      // Get the associated token address for the NFT
      const sellerNftTokenAccount = await getAssociatedTokenAddress(
        nftMint,
        wallet.publicKey
      );

      // Verify the seller owns the NFT
      try {
        const tokenAccountInfo = await getAccount(
          program.provider.connection,
          sellerNftTokenAccount
        );
        if (tokenAccountInfo.amount !== BigInt(1)) {
          throw new Error(
            "You do not own this NFT or the token account is incorrect."
          );
        }
      } catch (err) {
        console.error("Verification Error:", err);
        throw new Error(
          "Failed to verify NFT ownership. Ensure the token account exists."
        );
      }

      // Find Metaplex metadata account PDA
      const [metadataAccount] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          nftMint.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      // Find Metaplex master edition account PDA
      const [masterEditionAccount] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          nftMint.toBuffer(),
          Buffer.from("edition"),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      // Execute the transaction with higher priority fee to improve chances of success
      const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 50000, // Higher priority fee
      });

      // Execute the transaction to sell (burn) the NFT and retrieve SOL from escrow
      const tx = await program.methods
        .sellNft()
        .accounts({
          seller: wallet.publicKey,
          pool: pool,
          escrow: escrow,
          creator: creator,
          nftMint: nftMint,
          sellerNftTokenAccount: sellerNftTokenAccount,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          metadataAccount: metadataAccount,
          masterEditionAccount: masterEditionAccount,
          collectionMint: collectionMint,
          collectionMetadata: collectionMetadata,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([computeUnitLimitInstruction, priorityFeeInstruction])
        .rpc({
          skipPreflight: true, // Skip preflight to allow more complex transactions through
          commitment: "confirmed",
        });

      setTxSignature(tx);
      setSuccess(true);

      // Add the NFT mint address to the set of sold NFTs
      setSoldNfts((prev) => new Set([...prev, nftMintAddress]));

      return { success: true, signature: tx };
    } catch (err) {
      const errorMessage = safeStringifyError(err);
      console.error("Error selling NFT:", errorMessage);

      // Check if the error is a math overflow error
      const isOverflowError =
        (typeof err === "object" &&
          err !== null &&
          "message" in err &&
          typeof err.message === "string" &&
          err.message.includes("MathOverflow")) ||
        (typeof err === "object" &&
          err !== null &&
          "logs" in err &&
          Array.isArray(err.logs) &&
          err.logs.some(
            (log: any) =>
              typeof log === "string" && log.includes("MathOverflow")
          ));

      if (isOverflowError) {
        const friendlyError =
          "This NFT cannot be sold back to the pool at this time. The pool may not have enough SOL to complete this transaction.";
        setError(friendlyError);
        return { success: false, error: friendlyError };
      }

      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Helper method to check if an NFT has been sold
  const isSold = (nftMintAddress: string) => {
    return soldNfts.has(nftMintAddress);
  };

  return { sellNft, loading, error, txSignature, success, isSold };
};
