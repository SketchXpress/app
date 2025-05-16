/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from "react";

import { PublicKey } from "@solana/web3.js";
import { HistoryItem } from "@/hook/useBondingCurveHistory/types";

import { useSSEConnection } from "../api/realtime/useSSEConnection";

interface WebhookTransaction {
  signature: string;
  timestamp: number;
  instructionName: string;
  accounts: PublicKey[];
  args: any;
  description: string;
  type: string;
  source: string;
  error: any;
  poolAddress?: string;
  price?: number;
}

export function useWebhookTransactions() {
  const [transactions, setTransactions] = useState<HistoryItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalReceived: 0,
    totalProcessed: 0,
    lastUpdate: Date.now(),
  });

  const lastTransactionRef = useRef<string>("");

  const {
    connectionState,
    subscribe,
    lastEvent,
    error: sseError,
  } = useSSEConnection({
    endpoint: "/api/collections/sse",
    autoReconnect: true,
    reconnectDelay: 5000,
    maxReconnectAttempts: 3,
  });

  // Update connection status
  useEffect(() => {
    setIsConnected(connectionState === "connected");
    setError(sseError);
  }, [connectionState, sseError]);

  // Process new transactions from SSE
  useEffect(() => {
    const handleNewTransaction = (event: any) => {
      try {
        if (event.data && event.data.type === "transaction") {
          const tx = event.data.transaction as WebhookTransaction;

          // Check for duplicates
          if (tx.signature === lastTransactionRef.current) {
            return;
          }

          // Convert WebhookTransaction to HistoryItem
          const historyItem: HistoryItem = {
            signature: tx.signature,
            blockTime: tx.timestamp,
            instructionName: tx.instructionName,
            accounts: tx.accounts,
            args: tx.args,
            description: tx.description,
            type: tx.type,
            source: tx.source,
            error: tx.error,
            poolAddress: tx.poolAddress,
            price: tx.price,
          };

          setTransactions((prev) => [historyItem, ...prev].slice(0, 100));
          lastTransactionRef.current = tx.signature;

          setStats((prev) => ({
            ...prev,
            totalReceived: prev.totalReceived + 1,
            totalProcessed: prev.totalProcessed + 1,
            lastUpdate: Date.now(),
          }));
        }
      } catch (error) {
        console.error("Error processing webhook transaction:", error);
        setError(`Error processing transaction: ${error}`);
      }
    };

    // Subscribe to transaction events
    const unsubscribe = subscribe("transaction", handleNewTransaction);

    return () => {
      unsubscribe();
    };
  }, [subscribe]);

  // Filter methods
  const getTransactionsByPoolAddress = (poolAddress: string) => {
    return transactions.filter((tx) => tx.poolAddress === poolAddress);
  };

  const getTransactionsByType = (type: string) => {
    return transactions.filter((tx) => tx.instructionName === type);
  };

  const clearTransactions = () => {
    setTransactions([]);
    setStats((prev) => ({
      ...prev,
      totalReceived: 0,
      totalProcessed: 0,
      lastUpdate: Date.now(),
    }));
  };

  return {
    transactions,
    isConnected,
    connectionState,
    error,
    stats,
    lastEvent,
    getTransactionsByPoolAddress,
    getTransactionsByType,
    clearTransactions,
  };
}
