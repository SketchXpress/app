import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
import { Metaplex, walletAdapterIdentity } from "@metaplex-foundation/js";
import { WalletContextState } from "@solana/wallet-adapter-react";

export async function mintNFT(
  metadataUrl: string,
  walletContext: WalletContextState
): Promise<string> {
  if (!walletContext?.publicKey || !walletContext?.signTransaction) {
    throw new Error("Wallet not connected or invalid.");
  }

  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  const metaplex = Metaplex.make(connection).use(
    walletAdapterIdentity(walletContext)
  );

  const mintKeypair = Keypair.generate();

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const builder = await metaplex
    .nfts()
    .builders()
    .create({
      uri: metadataUrl,
      name: "SketchXpress Artwork",
      sellerFeeBasisPoints: 500,
      symbol: "SXP",
      creators: [
        {
          address: walletContext.publicKey,
          share: 100,
        },
      ],
      isMutable: true,
      useNewMint: mintKeypair,
    });

  const transaction = builder.toTransaction({
    blockhash,
    lastValidBlockHeight,
  });

  transaction.feePayer = walletContext.publicKey;

  transaction.partialSign(mintKeypair);

  const signedTx = await walletContext.signTransaction(transaction);

  const txSignature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(
    {
      blockhash,
      lastValidBlockHeight,
      signature: txSignature,
    },
    "confirmed"
  );

  return mintKeypair.publicKey.toString();
}
