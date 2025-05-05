import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { useState } from "react";
import { WalletContextState } from "@solana/wallet-adapter-react";

// Metaplex Token Metadata Program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// Your program ID - replace with the actual one
const PROGRAM_ID = new PublicKey(
  "2c1U9TKFcw5LVLRkEopaeVyxaj5aAefhA9syX9d2pUmL"
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
      const errorObj = error as Record<string, unknown>;
      if (errorObj.message) {
        return String(errorObj.message);
      }
      if (
        errorObj.error &&
        typeof errorObj.error === "object" &&
        "message" in errorObj.error
      ) {
        return String(errorObj.error.message);
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

// Helper function to validate public key format
const isValidPublicKeyFormat = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

// Helper function to safely create a public key
const safePublicKey = (address: string): PublicKey | null => {
  try {
    return new PublicKey(address);
  } catch {
    return null;
  }
};

export const useMintNFT = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [nftMintAddress, setNftMintAddress] = useState<string | null>(null);
  const [escrowAddress, setEscrowAddress] = useState<string | null>(null);

  const mintNft = async (
    poolAddress: string,
    name: string,
    symbol: string,
    uri: string,
    sellerFeeBasisPoints: number,
    walletContext: WalletContextState
  ) => {
    if (!walletContext.publicKey || !walletContext.signTransaction) {
      setError("Wallet not connected or invalid.");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Validate inputs
      if (!poolAddress || !name || !symbol || !uri) {
        throw new Error("Pool address, name, symbol, and URI are required");
      }

      if (sellerFeeBasisPoints < 0 || sellerFeeBasisPoints > 10000) {
        throw new Error("Seller fee basis points must be between 0 and 10000");
      }

      // Validate pool address
      if (!isValidPublicKeyFormat(poolAddress)) {
        throw new Error("Invalid pool address format");
      }

      const pool = safePublicKey(poolAddress);
      if (!pool) {
        throw new Error("Invalid pool address");
      }

      // Generate a new keypair for the NFT mint
      const nftMintKeypair = Keypair.generate();
      const nftMint = nftMintKeypair.publicKey;

      console.log(
        "Generated NFT mint keypair:",
        nftMintKeypair.publicKey.toString()
      );

      // Mock or placeholder values for now
      const mockCollectionMint = pool; // Using pool as collection mint for example
      const mockCreator = walletContext.publicKey; // Use wallet as creator

      // Find NFT escrow PDA
      const [escrow] = PublicKey.findProgramAddressSync(
        [Buffer.from("nft-escrow"), nftMint.toBuffer()],
        PROGRAM_ID
      );

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
      const [masterEdition] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          nftMint.toBuffer(),
          Buffer.from("edition"),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      // Get the associated token address for the NFT
      const tokenAccount = await getAssociatedTokenAddress(
        nftMint,
        walletContext.publicKey
      );

      // Collection metadata
      const [collectionMetadata] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mockCollectionMint.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      // For now, just log the important data and return a successful mock response
      // You'll implement actual transaction creation here based on your program
      console.log("Would execute with accounts:", {
        payer: walletContext.publicKey.toString(),
        nftMint: nftMint.toString(),
        escrow: escrow.toString(),
        pool: pool.toString(),
        tokenAccount: tokenAccount.toString(),
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID.toString(),
        metadataAccount: metadataAccount.toString(),
        masterEdition: masterEdition.toString(),
        collectionMint: mockCollectionMint.toString(),
        collectionMetadata: collectionMetadata.toString(),
        tokenProgram: TOKEN_PROGRAM_ID.toString(),
        creator: mockCreator.toString(),
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID.toString(),
        systemProgram: SystemProgram.programId.toString(),
        rent: SYSVAR_RENT_PUBKEY.toString(),
      });

      // In a true implementation, you'd build and send the actual transaction here
      // using similar logic to your original useMintNft hook

      // For testing, generate a mock transaction signature
      const mockTxId = "simulated_tx_" + Date.now();
      console.log("NFT minted successfully with signature:", mockTxId);

      // Set the transaction signature, NFT mint address, and escrow address
      setTxSignature(mockTxId);
      setNftMintAddress(nftMint.toString());
      setEscrowAddress(escrow.toString());

      return {
        tx: mockTxId,
        nftMint: nftMint.toString(),
        escrow: escrow.toString(),
      };
    } catch (error) {
      const errorMessage = safeStringifyError(error);
      console.error("Mint NFT error:", errorMessage);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    mintNft,
    loading,
    error,
    txSignature,
    nftMintAddress,
    escrowAddress,
  };
};
