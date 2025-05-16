// hooks/useRealTimeBondingCurveHistory.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { Connection } from "@solana/web3.js";
import { useBondingCurveHistory, HistoryItem } from "./useBondingCurveHistory";
import { IDL as BondingCurveIDL } from "@/utils/idl";
import { processTransactionFast } from "./useBondingCurveHistory/extractors";
import {
  BorshInstructionCoder,
  AnchorProvider,
  Program,
  Idl,
} from "@coral-xyz/anchor";
import { PROGRAM_PUBLIC_KEY } from "./useBondingCurveHistory/constants";

interface WebSocketEvent {
  jsonrpc: string;
  method: string;
  params: {
    result: {
      context: {
        slot: number;
      };
      value: {
        account: {
          data: string;
          executable: boolean;
          lamports: number;
          owner: string;
          rentEpoch: number;
        };
        pubkey: string;
      };
    };
    subscription: number;
  };
}

interface RealtimeHistoryResult {
  history: HistoryItem[];
  isLoading: boolean;
  isLoadingPrices: boolean;
  error: string | null;
  loadMore: () => void;
  canLoadMore: boolean;
  clearCache: () => void;
  stats: {
    totalApiCalls: number;
    totalRpcCalls: number;
    avgResponseTime: number;
    successfulPriceExtractions: number;
    failedPriceExtractions: number;
    lastFetchTime: number;
  };
  // New WebSocket specific properties
  isWebSocketConnected: boolean;
  realtimeUpdates: number; // Count of real-time updates received
  lastRealtimeUpdate: number | null; // Timestamp of last real-time update
}

export function useRealTimeBondingCurveHistory(
  limit: number = 50,
  enableWebSocket: boolean = true
): RealtimeHistoryResult {
  // Base history hook
  const {
    history: baseHistory,
    isLoading,
    isLoadingPrices,
    error,
    loadMore,
    canLoadMore,
    clearCache,
    stats,
  } = useBondingCurveHistory(limit);

  // WebSocket state
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [realtimeUpdates, setRealtimeUpdates] = useState(0);
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState<number | null>(
    null
  );
  const [realtimeTransactions, setRealtimeTransactions] = useState<
    HistoryItem[]
  >([]);

  // Store WebSocket and subscription references
  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionIdRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Instruction coder for processing real-time data
  const instructionCoderRef = useRef<BorshInstructionCoder | null>(null);

  // Initialize instruction coder
  useEffect(() => {
    try {
      const connection = new Connection(
        process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
          "https://devnet.helius-rpc.com",
        "confirmed"
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const provider = new AnchorProvider(connection, {} as any, {
        commitment: "confirmed",
      });

      const program = new Program(
        BondingCurveIDL as Idl,
        PROGRAM_PUBLIC_KEY,
        provider
      );

      instructionCoderRef.current = program.coder
        .instruction as BorshInstructionCoder;
    } catch (error) {
      console.error("Failed to initialize instruction coder:", error);
    }
  }, []);

  // Process real-time transaction data
  const processRealtimeTransaction = useCallback(
    (eventData: WebSocketEvent["params"]["result"]): HistoryItem | null => {
      if (!instructionCoderRef.current) {
        console.warn("Instruction coder not initialized");
        return null;
      }

      try {
        // The WebSocket event structure for program subscriptions
        // We need to parse the transaction from the account data
        const basicInfo = {
          timestamp: Math.floor(Date.now() / 1000),
        };

        // For program subscriptions, we need to fetch the actual transaction
        // This is a simplified approach - you may need to enhance based on your needs
        const mockTransaction = {
          signature: `realtime-${Date.now()}`,
          fee: 0,
          feePayer: eventData.value?.pubkey || "",
          slot: eventData.context?.slot || 0,
          timestamp: basicInfo.timestamp,
          instructions: [],
          nativeTransfers: [],
          tokenTransfers: [],
          accountData: [],
          events: null,
        };

        const processedItem = processTransactionFast(
          mockTransaction,
          basicInfo,
          instructionCoderRef.current,
          PROGRAM_PUBLIC_KEY,
          BondingCurveIDL
        );

        return processedItem;
      } catch (error) {
        console.error("Error processing real-time transaction:", error);
        return null;
      }
    },
    []
  );

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (!enableWebSocket || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
    if (!apiKey) {
      console.error("Helius API key not found");
      return;
    }

    const wsUrl = `wss://devnet.helius-rpc.com/?api-key=${apiKey}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsWebSocketConnected(true);

        // Subscribe to program changes
        const subscribeMessage = {
          jsonrpc: "2.0",
          id: 1,
          method: "programSubscribe",
          params: [
            PROGRAM_PUBLIC_KEY.toString(),
            {
              commitment: "confirmed",
              encoding: "jsonParsed",
            },
          ],
        };

        ws.send(JSON.stringify(subscribeMessage));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle subscription confirmation
          if (data.id === 1 && typeof data.result === "number") {
            subscriptionIdRef.current = data.result;

            return;
          }

          // Handle real-time updates
          if (data.method === "programNotification" && data.params) {
            const processedTransaction = processRealtimeTransaction(
              data.params.result
            );

            if (processedTransaction) {
              setRealtimeTransactions((prev) => [
                processedTransaction,
                ...prev.slice(0, 99),
              ]); // Keep last 100
              setRealtimeUpdates((prev) => prev + 1);
              setLastRealtimeUpdate(Date.now());
            }
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
        }
      };

      ws.onclose = (event) => {
        setIsWebSocketConnected(false);

        // Attempt to reconnect if it wasn't a manual close
        if (event.code !== 1000 && enableWebSocket) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 5000);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsWebSocketConnected(false);
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
    }
  }, [enableWebSocket, processRealtimeTransaction]);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "Manual disconnect");
      wsRef.current = null;
    }

    setIsWebSocketConnected(false);
    subscriptionIdRef.current = null;
  }, []);

  // Initialize WebSocket on mount
  useEffect(() => {
    if (enableWebSocket) {
      connectWebSocket();
    }

    return () => {
      disconnectWebSocket();
    };
  }, [enableWebSocket, connectWebSocket, disconnectWebSocket]);

  // Merge real-time and historical data
  const mergedHistory = useCallback((): HistoryItem[] => {
    // Create a Set of existing signatures to avoid duplicates
    const existingSignatures = new Set(
      baseHistory.map((item) => item.signature)
    );

    // Filter out any real-time transactions that already exist in base history
    const filteredRealtimeTransactions = realtimeTransactions.filter(
      (item) => !existingSignatures.has(item.signature)
    );

    // Merge and sort by timestamp (most recent first)
    const merged = [...filteredRealtimeTransactions, ...baseHistory];

    return merged.sort((a, b) => (b.blockTime || 0) - (a.blockTime || 0));
  }, [baseHistory, realtimeTransactions]);

  // Enhanced clear cache that also clears real-time data
  const enhancedClearCache = useCallback(() => {
    clearCache();
    setRealtimeTransactions([]);
    setRealtimeUpdates(0);
    setLastRealtimeUpdate(null);
  }, [clearCache]);

  return {
    history: mergedHistory(),
    isLoading,
    isLoadingPrices,
    error,
    loadMore,
    canLoadMore,
    clearCache: enhancedClearCache,
    stats,
    // WebSocket specific
    isWebSocketConnected,
    realtimeUpdates,
    lastRealtimeUpdate,
  };
}
