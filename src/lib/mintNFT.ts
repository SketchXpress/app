import {
  Connection,
  Keypair,
  clusterApiUrl,
  PublicKey,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { Metaplex, walletAdapterIdentity } from "@metaplex-foundation/js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { useState } from "react";

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

      // Create connection and Metaplex instance
      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
      const metaplex = Metaplex.make(connection).use(
        walletAdapterIdentity(walletContext)
      );

      // Generate a new keypair for the NFT mint
      const nftMintKeypair = Keypair.generate();
      const nftMint = nftMintKeypair.publicKey;

      console.log(
        "Generated NFT mint keypair:",
        nftMintKeypair.publicKey.toString()
      );

      // Find escrow PDA (simulated - actual implementation would depend on your program)
      const escrow = PublicKey.findProgramAddressSync(
        [Buffer.from("nft-escrow"), nftMint.toBuffer()],
        new PublicKey("YourProgramId") // Replace with actual program ID
      )[0];

      // --- ADD COMPUTE UNIT LIMIT INSTRUCTION ---
      const computeUnitLimitInstruction =
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 400000, // Request 400,000 CUs (adjust if needed)
        });

      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");

      // Build the NFT
      const builder = await metaplex
        .nfts()
        .builders()
        .create({
          uri: uri,
          name: name,
          sellerFeeBasisPoints: sellerFeeBasisPoints,
          symbol: symbol,
          creators: [
            {
              address: walletContext.publicKey,
              share: 100,
            },
          ],
          isMutable: true,
          useNewMint: nftMintKeypair,
        });

      const transaction = builder.toTransaction({
        blockhash,
        lastValidBlockHeight,
      });

      // Add compute unit instruction
      transaction.instructions.unshift(computeUnitLimitInstruction);

      transaction.feePayer = walletContext.publicKey;
      transaction.partialSign(nftMintKeypair);

      const signedTx = await walletContext.signTransaction(transaction);
      const tx = await connection.sendRawTransaction(signedTx.serialize());

      await connection.confirmTransaction(
        {
          blockhash,
          lastValidBlockHeight,
          signature: tx,
        },
        "confirmed"
      );

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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
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
