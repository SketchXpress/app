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
import { Program } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import IDL from "@/utils/idl";
import { PhantomWalletInterface, SendOptions } from "@/contexts/WalletContextProvider";

// Metaplex Token Metadata Program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// Your program ID
const PROGRAM_ID = new PublicKey(IDL.metadata.address);

// Helper function to safely stringify any error object
const safeStringifyError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    try {
      const errorObj = error as Record<string, unknown>;
      if (errorObj.message) return String(errorObj.message);
      if (errorObj.error && typeof errorObj.error === "object" && "message" in errorObj.error) {
        return String(errorObj.error.message);
      }
      if (errorObj.logs && Array.isArray(errorObj.logs)) return errorObj.logs.join("\n");
      return JSON.stringify(error, null, 2);
    } catch {
      return `[Complex Error Object: ${typeof error}]`;
    }
  }
  return `[Unknown Error: ${typeof error}]`;
};

// Helper functions for public key validation
const isValidPublicKeyFormat = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

const safePublicKey = (address: string): PublicKey | null => {
  try {
    return new PublicKey(address);
  } catch {
    return null;
  }
};

export const useMintNFT = () => {
  const wallet = useWallet();
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
    setLoading(true);
    setError(null);
    try {
      // Check if wallet is connected
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error("Wallet not connected or wallet doesn't support transaction signing");
      }

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
      // Create Anchor provider for fetching account data
      const anchorProvider = new anchor.AnchorProvider(
        connection,
        {
          publicKey: wallet.publicKey,
          signTransaction: wallet.signTransaction,
          signAllTransactions: wallet.signAllTransactions || 
            (async (txs) => {
              const signedTxs = [];
              for (const tx of txs) {
                signedTxs.push(await wallet.signTransaction!(tx));
              }
              return signedTxs;
            }),
        },
        { commitment: "confirmed" }
      );

      // Create program instance
      const program = new Program(IDL as anchor.Idl, PROGRAM_ID, anchorProvider);

      // Generate a new keypair for the NFT mint
      const nftMintKeypair = Keypair.generate();
      const nftMint = nftMintKeypair.publicKey;
      console.log("Generated NFT mint keypair:", nftMint.toString());

      // Get pool data to retrieve collection mint
      const poolData = await program.account.bondingCurvePool.fetch(pool);
      type PoolData = { collection: PublicKey; creator: PublicKey };
      const { collection: collectionMint, creator } = poolData as PoolData;

      // Find PDAs
      const [collectionMetadata] = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), collectionMint.toBuffer()],
        TOKEN_METADATA_PROGRAM_ID
      );

      const [escrow] = PublicKey.findProgramAddressSync(
        [Buffer.from("nft-escrow"), nftMint.toBuffer()],
        PROGRAM_ID
      );

      const [metadataAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), nftMint.toBuffer()],
        TOKEN_METADATA_PROGRAM_ID
      );

      const [masterEdition] = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), nftMint.toBuffer(), Buffer.from("edition")],
        TOKEN_METADATA_PROGRAM_ID
      );

      // Get the associated token address for the NFT
      const tokenAccount = await getAssociatedTokenAddress(nftMint, wallet.publicKey);

      // Create transaction
      const transaction = new Transaction();
      // Add compute unit limit instruction for complex transactions
      transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }));
      // Add mint NFT instruction
      const mintNftIx = await program.methods
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
      transaction.add(mintNftIx);
      // Set fee payer and recent blockhash
      transaction.feePayer = wallet.publicKey;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      // Partially sign with the mint keypair
      transaction.partialSign(nftMintKeypair);

      // Handle different wallet providers
      let signature: string;
      
      // Check if wallet is Phantom and supports signAndSendTransaction
      if ('phantom' in window && wallet.wallet?.adapter?.name === 'Phantom') {
        // Cast wallet to PhantomWalletInterface
        const phantomWallet = wallet as unknown as PhantomWalletInterface;
        
        if (phantomWallet.signAndSendTransaction) {
          // Prepare send options
          const sendOptions: SendOptions = {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          };
          
          // Use properly typed signAndSendTransaction
          const { signature: phantomSig } = await phantomWallet.signAndSendTransaction(
            transaction,
            sendOptions
          );
          signature = phantomSig;
        } else {
          throw new Error("Phantom wallet doesn't support signAndSendTransaction");
        }
      } else {
        // Standard flow for other wallets
        const signedTransaction = await wallet.signTransaction(transaction);
        signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });
      }
      
      console.log("NFT minted successfully with signature:", signature);
      
      // Wait for confirmation
      await connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature
      }, 'confirmed');

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
