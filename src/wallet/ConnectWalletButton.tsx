"use client";

import dynamic from "next/dynamic";
import styles from "./ConnectWalletButton.module.scss";

const WalletMultiButtonDynamic = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const ConnectWalletButton = () => {
  return (
    <WalletMultiButtonDynamic className={styles.connectWalletButton} />
  );
};

export default ConnectWalletButton;
