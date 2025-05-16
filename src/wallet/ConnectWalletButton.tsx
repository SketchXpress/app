"use client";

import dynamic from "next/dynamic";

const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const ConnectWalletButton = () => {
  return <WalletMultiButtonDynamic />;
};

export default ConnectWalletButton;
