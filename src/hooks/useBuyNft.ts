"use client";

import { useAnchorContext } from "@/contexts/AnchorContextProvider";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { useState } from "react";

export const useBuyNft = () => {
  const { program } = useAnchorContext();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const buyFromPool = async (nftMintAddress: string, poolAddress: string) => {
    if (!program || !wallet.publicKey) {
      setError("Program not initialized or wallet not connected");
      return {
        success: false,
        error: "Program not initialized or wallet not connected",
      };
    }

    setLoading(true);
    setError(null);
    setTxSignature(null);
    setSuccess(false);

    try {
      const nftMint = new PublicKey(nftMintAddress);
      const pool = new PublicKey(poolAddress);

      // Get pool data to get current price
      const poolData = await program.account.bondingCurvePool.fetch(pool);
      const currentPrice = poolData.currentPrice;

      // Ensure currentPrice is a number or BigInt
      const currentPriceNumber =
        typeof currentPrice === "number"
          ? currentPrice
          : typeof currentPrice === "bigint"
          ? Number(currentPrice)
          : Number(currentPrice?.toString?.() ?? 0);

      console.log(
        `Buying NFT ${nftMintAddress} from pool for ${
          currentPriceNumber / 1e9
        } SOL`
      );

      // Get buyer's associated token account
      const buyerNftTokenAccount = await getAssociatedTokenAddress(
        nftMint,
        wallet.publicKey
      );

      // Find NFT escrow PDA
      const [escrow] = PublicKey.findProgramAddressSync(
        [Buffer.from("nft-escrow"), nftMint.toBuffer()],
        program.programId
      );

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
        .rpc();

      console.log("NFT bought successfully with signature:", tx);
      setTxSignature(tx);
      setSuccess(true);

      return { success: true, signature: tx };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error buying NFT from pool:", errorMessage);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const buyFromUser = async (
    nftMintAddress: string,
    sellerAddress: string,
    price: number
  ) => {
    if (!program || !wallet.publicKey) {
      setError("Program not initialized or wallet not connected");
      return {
        success: false,
        error: "Program not initialized or wallet not connected",
      };
    }

    setLoading(true);
    setError(null);
    setTxSignature(null);
    setSuccess(false);

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
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error buying NFT from user:", errorMessage);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return {
    buyFromPool,
    buyFromUser,
    loading,
    error,
    txSignature,
    success,
  };
};
