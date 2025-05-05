import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  ComputeBudgetProgram,
  clusterApiUrl,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { Program } from "@coral-xyz/anchor";
import IDL from "@/utils/idl";

// Metaplex Token Metadata Program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// Your program ID
const PROGRAM_ID = new PublicKey(IDL.metadata.address);

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

      // Create Solana Connection
      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

      // Handle signAllTransactions being undefined - fix TypeScript error
      const signAllTransactions =
        walletContext.signAllTransactions ||
        (async <T extends Transaction | anchor.web3.VersionedTransaction>(
          txs: T[]
        ): Promise<T[]> => {
          const signedTxs: T[] = [];
          for (const tx of txs) {
            if (walletContext.signTransaction) {
              signedTxs.push((await walletContext.signTransaction(tx)) as T);
            }
          }
          return signedTxs;
        });

      // Create provider for Anchor
      const provider = new anchor.AnchorProvider(
        connection,
        {
          publicKey: walletContext.publicKey,
          signTransaction: walletContext.signTransaction,
          signAllTransactions: signAllTransactions,
        },
        { commitment: "confirmed" }
      );

      // Create program instance
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const program = new Program(IDL as any, PROGRAM_ID, provider);

      // Generate a new keypair for the NFT mint
      const nftMintKeypair = Keypair.generate();
      const nftMint = nftMintKeypair.publicKey;

      console.log(
        "Generated NFT mint keypair:",
        nftMintKeypair.publicKey.toString()
      );

      // Get pool data to retrieve collection mint
      const poolData = await program.account.bondingCurvePool.fetch(pool);

      // Type assertion for poolData
      type PoolData = { collection: PublicKey; creator: PublicKey };
      const { collection: collectionMint, creator } = poolData as PoolData;

      console.log("Pool data retrieved:");
      console.log("Collection Mint:", collectionMint.toString());
      console.log("Creator:", creator.toString());

      // Find collection metadata PDA
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

      // Add compute unit limit instruction
      const computeUnitLimitInstruction =
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 400000, // Request 400,000 CUs (adjust if needed)
        });

      // Log key information
      console.log("Accounts to be used:");
      console.log("Payer:", walletContext.publicKey.toString());
      console.log("NFT Mint:", nftMint.toString());
      console.log("Escrow:", escrow.toString());
      console.log("Pool:", pool.toString());
      console.log("Token Account:", tokenAccount.toString());
      console.log("Metadata Account:", metadataAccount.toString());
      console.log("Master Edition:", masterEdition.toString());
      console.log("Collection Mint:", collectionMint.toString());
      console.log("Collection Metadata:", collectionMetadata.toString());
      console.log("Creator:", creator.toString());

      // Execute the transaction to mint the NFT
      const tx = await program.methods
        .mintNft(name, symbol, uri, sellerFeeBasisPoints)
        .accounts({
          payer: walletContext.publicKey,
          nftMint: nftMint,
          escrow: escrow,
          pool: pool,
          tokenAccount: tokenAccount,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          metadataAccount: metadataAccount,
          masterEdition: masterEdition,
          collectionMint: collectionMint,
          collectionMetadata: collectionMetadata,
          tokenProgram: TOKEN_PROGRAM_ID,
          creator: creator,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([nftMintKeypair])
        .preInstructions([computeUnitLimitInstruction])
        .rpc({
          skipPreflight: false,
          commitment: "confirmed",
        });

      console.log("NFT minted successfully with signature:", tx);

      // Set the transaction signature, NFT mint address, and escrow address
      setTxSignature(tx);
      setNftMintAddress(nftMint.toString());
      setEscrowAddress(escrow.toString());

      return {
        tx,
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
