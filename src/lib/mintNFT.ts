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
import { useWallet } from "@solana/wallet-adapter-react";
import { Program } from "@coral-xyz/anchor";
import IDL from "@/utils/idl";
// Import the types and helpers from your WalletContextProvider
import {
  getPhantomProvider,
  PhantomSendOptions,
} from "@/contexts/WalletContextProvider";

// Metaplex Token Metadata Program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// Program ID
const PROGRAM_ID = new PublicKey(IDL.metadata.address);

// Helper functions remain the same
const safeStringifyError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    try {
      const errorObj = error as Record<string, unknown>;
      if (errorObj.message) return String(errorObj.message);
      if (
        errorObj.error &&
        typeof errorObj.error === "object" &&
        "message" in errorObj.error
      ) {
        return String(errorObj.error.message);
      }
      if (errorObj.logs && Array.isArray(errorObj.logs))
        return errorObj.logs.join("\n");
      return JSON.stringify(error, null, 2);
    } catch {
      return `[Complex Error Object: ${typeof error}]`;
    }
  }
  return `[Unknown Error: ${typeof error}]`;
};

const safePublicKey = (address: string): PublicKey | null => {
  try {
    return new PublicKey(address);
  } catch {
    return null;
  }
};

export const useMintNFT = () => {
  const wallet = useWallet(); // Use wallet hook directly
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
    sellerFeeBasisPoints: number
  ) => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError("Wallet not connected or invalid.");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Validation code remains the same
      if (!poolAddress || !name || !symbol || !uri) {
        throw new Error("Pool address, name, symbol, and URI are required");
      }

      if (sellerFeeBasisPoints < 0 || sellerFeeBasisPoints > 10000) {
        throw new Error("Seller fee basis points must be between 0 and 10000");
      }

      const pool = safePublicKey(poolAddress);
      if (!pool) {
        throw new Error("Invalid pool address");
      }

      // Create Solana Connection
      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

      // Create Anchor provider
      const provider = new anchor.AnchorProvider(
        connection,
        {
          publicKey: wallet.publicKey,
          signTransaction: wallet.signTransaction,
          signAllTransactions:
            wallet.signAllTransactions ?? (async (txs) => Promise.resolve(txs)),
        },
        { commitment: "confirmed" }
      );

      // Create program instance
      const program = new Program(IDL as anchor.Idl, PROGRAM_ID, provider);

      // Generate NFT mint keypair
      const nftMintKeypair = Keypair.generate();
      const nftMint = nftMintKeypair.publicKey;
      console.log("Generated NFT mint keypair:", nftMint.toString());

      // Get pool data
      const poolData = await program.account.bondingCurvePool.fetch(pool);
      type PoolData = { collection: PublicKey; creator: PublicKey };
      const { collection: collectionMint, creator } = poolData as PoolData;

      // Find PDAs
      const [collectionMetadata] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          collectionMint.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      const [escrow] = PublicKey.findProgramAddressSync(
        [Buffer.from("nft-escrow"), nftMint.toBuffer()],
        PROGRAM_ID
      );

      const [metadataAccount] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          nftMint.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      const [masterEdition] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          nftMint.toBuffer(),
          Buffer.from("edition"),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      // Get token account
      const tokenAccount = await getAssociatedTokenAddress(
        nftMint,
        wallet.publicKey
      );

      // STEP 1: Create transaction manually instead of using RPC
      const transaction = new Transaction();

      // Add compute unit limit instruction
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 })
      );

      // Build mint NFT instruction using Anchor's instruction() method
      const mintNftInstruction = await program.methods
        .mintNft(name, symbol, uri, sellerFeeBasisPoints)
        .accounts({
          payer: wallet.publicKey,
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
        .instruction();

      // Add the mint NFT instruction to the transaction
      transaction.add(mintNftInstruction);

      // Setup transaction parameters
      transaction.feePayer = wallet.publicKey;
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;

      // Partially sign with mint keypair
      transaction.partialSign(nftMintKeypair);

      // STEP 2: Handle wallet-specific transaction signing and sending
      let signature: string;

      // Use your existing getPhantomProvider helper function
      const phantomProvider = getPhantomProvider();
      if (phantomProvider && wallet.wallet?.adapter?.name === "Phantom") {
        console.log("Using Phantom's signAndSendTransaction method");

        // Define options using your PhantomSendOptions interface
        const sendOptions: PhantomSendOptions = {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        };

        // Use Phantom's native signAndSendTransaction with your type definitions
        const { signature: phantomSig } =
          await phantomProvider.signAndSendTransaction(
            transaction,
            sendOptions
          );
        signature = phantomSig;
      } else {
        console.log("Using standard wallet adapter method");
        // Standard flow for other wallets
        const signedTransaction = await wallet.signTransaction(transaction);
        signature = await connection.sendRawTransaction(
          signedTransaction.serialize(),
          {
            skipPreflight: false,
            preflightCommitment: "confirmed",
          }
        );
      }

      // STEP 3: Add proper transaction confirmation
      const confirmationResult = await connection.confirmTransaction(
        {
          blockhash,
          lastValidBlockHeight,
          signature,
        },
        "confirmed"
      );

      if (confirmationResult.value.err) {
        throw new Error(
          `Transaction confirmation failed: ${JSON.stringify(
            confirmationResult.value.err
          )}`
        );
      }

      console.log("NFT minted successfully with signature:", signature);

      setTxSignature(signature);
      setNftMintAddress(nftMint.toString());
      setEscrowAddress(escrow.toString());

      return {
        signature,
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
