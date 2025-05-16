"use client";

import dynamic from "next/dynamic";
import { FC, ReactNode, useMemo, useState, useEffect } from "react";

import { clusterApiUrl, Transaction } from "@solana/web3.js";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";

import "@solana/wallet-adapter-react-ui/styles.css";

// Phantom-specific type definitions
export interface PhantomSendOptions {
  skipPreflight?: boolean;
  preflightCommitment?: "processed" | "confirmed" | "finalized" | string;
  maxRetries?: number;
  minContextSlot?: number;
}

// Phantom provider interface
export interface PhantomProvider {
  connect: () => Promise<{ publicKey: string }>;
  disconnect: () => Promise<void>;
  signAndSendTransaction: (
    transaction: Transaction,
    options?: PhantomSendOptions
  ) => Promise<{ signature: string }>;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
  signMessage: (message: Uint8Array) => Promise<{ signature: string }>;
  isConnected: boolean;
  publicKey: { toString: () => string };
}

declare global {
  interface Window {
    phantom?: {
      solana?: PhantomProvider;
    };
  }
}

// Helper function to get Phantom provider
export const getPhantomProvider = (): PhantomProvider | null => {
  if (typeof window !== "undefined" && window.phantom?.solana) {
    return window.phantom.solana;
  }
  return null;
};

interface WalletContextProviderProps {
  children: ReactNode;
}

export const WalletContextProvider: FC<WalletContextProviderProps> = ({
  children,
}) => {
  // State to track if we're on the client side
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const network = WalletAdapterNetwork.Devnet;

  // You can also provide a custom RPC endpoint
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(() => [new SolflareWalletAdapter()], []);

  // Wrap wallet provider in error boundary
  const renderWalletProviders = () => {
    try {
      return (
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>{children}</WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      );
    } catch (error) {
      console.error("Error in wallet provider setup:", error);

      return (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <p>
            Wallet connection error. Please refresh the page or try disabling
            conflicting wallet extensions.
          </p>
          <p>
            Common issues include having both Phantom and Solflare extensions
            active simultaneously.
          </p>
        </div>
      );
    }
  };

  // Only render wallet components on the client side
  return isClient ? (
    renderWalletProviders()
  ) : (
    <div>Loading wallet providers...</div>
  );
};

// Use dynamic import with SSR disabled for the wallet context
export default dynamic(() => Promise.resolve(WalletContextProvider), {
  ssr: false,
});
