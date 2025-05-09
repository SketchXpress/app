import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { HistoryItem } from "./types";
import { extractSellPrice } from "./extractors";
import { findAccountIndex } from "./helpers";
import { IDL as BondingCurveIDL } from "@/utils/idl";

// Configure the batch size for price loading
const BACKGROUND_PROCESS_BATCH = 5;

/**
 * Hook to load NFT prices in the background in batches
 *
 * @param rpcRequestWithRetry The function to make RPC requests with retry logic
 * @param updatePerformanceStats Optional callback to update performance metrics
 * @returns A function to trigger background price loading
 */
export function useBackgroundPriceLoader(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpcRequestWithRetry: (method: string, params: any[]) => Promise<any>,
  updatePerformanceStats?: (success: boolean) => void
) {
  const queryClient = useQueryClient();

  const loadSellPricesInBackground = useCallback(
    async (historyItems: HistoryItem[]) => {
      // Get all items that need price loading
      const itemsNeedingPrices = historyItems.filter(
        (item) => item.isPriceLoading && !item.priceLoadAttempted
      );

      if (itemsNeedingPrices.length === 0) {
        return;
      }

      // Process in batches to avoid overwhelming the RPC
      const batchSize = BACKGROUND_PROCESS_BATCH;
      const batches = Math.ceil(itemsNeedingPrices.length / batchSize);

      // Process each batch sequentially
      for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
        const startIdx = batchIndex * batchSize;
        const endIdx = Math.min(
          startIdx + batchSize,
          itemsNeedingPrices.length
        );
        const batch = itemsNeedingPrices.slice(startIdx, endIdx);

        try {
          // Process the batch in parallel
          const pricePromises = batch.map(async (item) => {
            const signature = item.signature;
            let escrowAddress: string | undefined;

            // Find escrow address from accounts for sell NFT transactions
            if (item.instructionName === "sellNft") {
              const idlInstruction = BondingCurveIDL.instructions.find(
                (ix) => ix.name === "sellNft"
              );

              if (idlInstruction) {
                const escrowIndex = findAccountIndex(idlInstruction, "escrow");
                if (escrowIndex !== -1 && item.accounts.length > escrowIndex) {
                  escrowAddress = item.accounts[escrowIndex].toBase58();
                }
              }
            }

            // Create a function to update performance stats
            const trackPerformance = (success: boolean) => {
              if (updatePerformanceStats) {
                updatePerformanceStats(success);
              }
            };

            // Extract price from blockchain data
            const price = await extractSellPrice(
              rpcRequestWithRetry,
              signature,
              escrowAddress,
              trackPerformance
            );

            return {
              signature,
              price,
              priceLoadAttempted: true,
              isPriceLoading: false,
            };
          });

          // Wait for all prices in this batch to be processed
          const results = await Promise.all(pricePromises);

          // Update transaction history data with the new prices
          queryClient.setQueryData(
            ["transactionHistory"],
            (oldData: HistoryItem[] | undefined) => {
              if (!oldData) return undefined;

              // Create a new array with updated items
              return oldData.map((item) => {
                // Find a matching result
                const result = results.find(
                  (r) => r.signature === item.signature
                );

                // If we found an updated price, merge it with the existing item
                if (result) {
                  return {
                    ...item,
                    price: result.price,
                    priceLoadAttempted: true,
                    isPriceLoading: false,
                  };
                }

                // Otherwise return the item unchanged
                return item;
              });
            }
          );

          // Add a small delay between batches to avoid overwhelming the network
          if (batchIndex < batches - 1) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        } catch (error) {
          console.error(
            "Error loading prices in background (batch",
            batchIndex,
            "):",
            error
          );
        }
      }
    },
    [rpcRequestWithRetry, queryClient, updatePerformanceStats]
  );

  return loadSellPricesInBackground;
}
