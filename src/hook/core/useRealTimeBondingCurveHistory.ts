import { useEffect } from "react";
import {
  useSSEConnection,
  SSEEvent,
} from "@/hook/api/realtime/useSSEConnection";
import { useCollectionsStore, HistoryItem } from "@/stores/collectionsStore";

interface SSETransactionData extends HistoryItem {
  poolAddress: string;
}

export function useRealTimeBondingCurveHistory(poolAddress?: string) {
  const { subscribe, isConnected } = useSSEConnection({
    endpoint: "/api/collections/sse",
  });

  const addTransactionToStore = useCollectionsStore(
    (state) => state.addTransactionToPool
  );

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    const unsubscribe = subscribe("newTransaction", (event: SSEEvent) => {
      try {
        if (!event.data) {
          console.warn("Received SSE event with no data:", event);
          return;
        }

        const transactionData = event.data as SSETransactionData;

        if (
          !transactionData.poolAddress ||
          !transactionData.signature ||
          typeof transactionData.blockTime === "undefined"
        ) {
          console.warn(
            "Received incomplete transaction data from SSE:",
            transactionData
          );
          return;
        }

        if (poolAddress && transactionData.poolAddress !== poolAddress) {
          return;
        }

        addTransactionToStore(
          transactionData.poolAddress,
          transactionData as HistoryItem
        );
      } catch (e) {
        console.error(
          "Error processing SSE transaction event in useRealTimeBondingCurveHistory:",
          e
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isConnected, subscribe, addTransactionToStore, poolAddress]);
}
