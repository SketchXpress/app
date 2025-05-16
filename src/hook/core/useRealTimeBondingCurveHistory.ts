// /home/ubuntu/src_code/src/hook/core/useRealTimeBondingCurveHistory.ts
import { useEffect } from "react";
import {
  useSSEConnection,
  SSEEvent,
} from "@/hook/api/realtime/useSSEConnection"; // Adjust path if needed
import { useCollectionsStore, HistoryItem } from "@/stores/collectionsStore"; // Correctly import HistoryItem

// The SSE event data should conform to the HistoryItem structure,
// plus any additional fields needed for routing, like poolAddress.
// We'll ensure the SSE server sends data compatible with HistoryItem.
// For clarity, we can still use a type alias if the SSE payload has a slightly different name but same structure.
// Or, directly use HistoryItem if the SSE payload is expected to match it perfectly.
// Let's assume the SSE event's `data` field will be an object that is compatible with HistoryItem
// and includes `poolAddress`.

interface SSETransactionData extends HistoryItem {
  poolAddress: string; // Ensure poolAddress is part of the SSE data for routing
}

/**
 * Hook to listen for real-time bonding curve history updates (e.g., sales) via SSE
 * and update the global collections store.
 * @param poolAddress Optional: If provided, the hook will only process events for this specific pool.
 */
export function useRealTimeBondingCurveHistory(poolAddress?: string) {
  // Removed unused 'connectionState' from destructuring
  const { subscribe, isConnected } = useSSEConnection({
    endpoint: "/api/collections/sse",
  });
  // Corrected the store action name to 'addTransactionToPool'
  const addTransactionToStore = useCollectionsStore(
    (state) => state.addTransactionToPool
  );

  useEffect(() => {
    if (!isConnected) {
      // console.log('SSE not connected, skipping subscription for bonding curve history.');
      return;
    }

    const unsubscribe = subscribe("newTransaction", (event: SSEEvent) => {
      try {
        if (!event.data) {
          console.warn("Received SSE event with no data:", event);
          return;
        }

        // Cast the event data to our expected type which is compatible with HistoryItem
        const transactionData = event.data as SSETransactionData;

        // Validate essential fields from the SSE event, which are part of HistoryItem
        // and our SSETransactionData definition
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
          return; // Event is for a different pool
        }

        // The data from SSE (transactionData) should be a valid HistoryItem.
        // The `addTransactionToPool` action expects a HistoryItem.
        // We ensure `poolAddress` is part of `transactionData` for filtering, but it's also part of HistoryItem (optional).
        // If your SSE sends `poolAddress` separately or it's guaranteed in `HistoryItem` from SSE, this is fine.
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
