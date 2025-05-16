// src/hook/core/useOptimizedChartData.ts
import { useMemo } from "react";
import { useCollectionsStore } from "@/stores/collectionsStore";
import { useBondingCurveForPool } from "@/hooks/useBondingCurveForPool";
import { useHeliusSales } from "@/hooks/useHeliusSales";
import { useRealtimeChartData } from "./useRealtimeChartData";
import { Time } from "lightweight-charts";

type ChartDataPoint = {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  isRealtime?: boolean;
};

/**
 * Optimized chart data hook that prioritizes store data
 * Reduces API calls by using webhook/SSE data when available
 */
export function useOptimizedChartData(poolAddress: string) {
  // Get store data first
  const { getPoolDetailsWithRealtime } = useCollectionsStore();
  const storeData = getPoolDetailsWithRealtime(poolAddress);

  // Only fetch from API if store data is insufficient
  const shouldFetchHistory =
    !storeData?.history || storeData.history.length < 10;
  const shouldFetchSales = !storeData?.history?.some(
    (tx) => tx.instructionName === "sellNft"
  );

  // Conditional API calls
  const { history, isLoading: historyLoading } = useBondingCurveForPool(
    shouldFetchHistory ? poolAddress : undefined
  );

  const { data: sales, isLoading: salesLoading } = useHeliusSales(
    shouldFetchSales ? poolAddress : "",
    shouldFetchSales ? "70eef812-8d6b-496f-bc30-1725d5acb800" : ""
  );

  // Use store data if available, otherwise use API data
  const finalHistory = useMemo(() => {
    if (storeData?.history && storeData.history.length > 0) {
      return storeData.history;
    }
    return history || [];
  }, [storeData?.history, history]);

  // Extract sales from store data or API
  const finalSales = useMemo(() => {
    if (storeData?.history) {
      // Extract sales from store history
      return storeData.history
        .filter((tx) => tx.instructionName === "sellNft")
        .map((tx) => ({
          signature: tx.signature,
          blockTime: tx.blockTime || 0,
          soldSol: tx.price || 0,
        }));
    }
    return sales || [];
  }, [storeData?.history, sales]);

  // Process raw historical data into candles (existing logic)
  const rawCandles = useMemo(() => {
    const mintEvents = finalHistory
      .filter(
        (h) =>
          h.blockTime != null &&
          h.instructionName === "mintNft" &&
          h.price != null
      )
      .map((item) => ({
        time: Math.floor(item.blockTime!) as Time,
        price: item.price!,
        type: "mint" as const,
        signature: item.signature,
      }))
      .sort((a, b) => Number(a.time) - Number(b.time));

    // Process sell events
    let processedSellEvents = finalSales
      .filter((s) => {
        const isDuplicateOfMint = mintEvents.some(
          (mint) =>
            Math.abs(mint.price - (s.soldSol || 0)) < 0.0001 &&
            mint.signature === s.signature
        );
        return s.blockTime != null && !isDuplicateOfMint;
      })
      .map((item) => ({
        time: Math.floor(item.blockTime!) as Time,
        price: item.soldSol || 0,
        type: "sell" as const,
        signature: item.signature,
      }));

    // Add sell transactions from history if not in sales data
    const sellTransactions = finalHistory.filter(
      (tx) => tx.instructionName === "sellNft" && tx.blockTime != null
    );

    if (sellTransactions.length > 0) {
      const historySellEvents = sellTransactions.map((tx) => ({
        time: Math.floor(tx.blockTime!) as Time,
        price: tx.price || 0,
        type: "sell" as const,
        signature: tx.signature,
      }));
      processedSellEvents = [...processedSellEvents, ...historySellEvents];
    }

    processedSellEvents.sort((a, b) => Number(a.time) - Number(b.time));

    // Convert to candles (existing logic from CollectionChart.tsx)
    const allEvents = [...mintEvents, ...processedSellEvents].sort((a, b) => {
      const timeDiff = Number(a.time) - Number(b.time);
      if (timeDiff !== 0) return timeDiff;
      if (a.type === "mint" && b.type === "sell") return -1;
      if (a.type === "sell" && b.type === "mint") return 1;
      return 0;
    });

    const candles: ChartDataPoint[] = [];
    let lastPrice = 0;
    let lastTimestamp = 0;

    allEvents.forEach((event, index) => {
      let currentEventTime = Number(event.time);

      if (lastTimestamp > 0 && currentEventTime <= lastTimestamp) {
        currentEventTime = lastTimestamp + 1;
      }

      if (index === 0 && event.type === "mint") {
        let initialTime = Number(event.time) - 86400;
        if (initialTime >= currentEventTime) {
          initialTime = currentEventTime - 1;
        }
        candles.push({
          time: initialTime as Time,
          open: 0,
          high: event.price,
          low: 0,
          close: event.price,
        });
        lastPrice = event.price;
        candles.push({
          time: currentEventTime as Time,
          open: 0,
          high: event.price,
          low: 0,
          close: event.price,
        });
        lastTimestamp = currentEventTime;
      } else {
        if (event.type === "mint") {
          candles.push({
            time: currentEventTime as Time,
            open: lastPrice,
            high: Math.max(lastPrice, event.price),
            low: Math.min(lastPrice, event.price),
            close: event.price,
          });
        } else if (event.type === "sell") {
          // Sell price calculation (existing logic)
          const basePrice = 0.05;
          const growthFactor = 0.02;
          const supplyBeforeSell =
            mintEvents.filter((m) => Number(m.time) <= Number(event.time))
              .length -
            processedSellEvents.filter(
              (s) => Number(s.time) < Number(event.time)
            ).length;

          const sellPrice = basePrice + growthFactor * (supplyBeforeSell - 1);

          candles.push({
            time: currentEventTime as Time,
            open: lastPrice,
            high: lastPrice,
            low: sellPrice,
            close: sellPrice,
          });
        }
        lastPrice = candles[candles.length - 1].close;
        lastTimestamp = currentEventTime;
      }
    });

    return candles.sort((a, b) => Number(a.time) - Number(b.time));
  }, [finalHistory, finalSales]);

  // Enhanced candles with real-time data
  const {
    candles: enhancedCandles,
    hasRealtimeData,
    realtimePoint,
    connectionState,
    lastUpdate,
  } = useRealtimeChartData(poolAddress, rawCandles);

  // Calculate loading state - only loading if we're fetching from API
  const isLoading =
    (shouldFetchHistory && historyLoading) ||
    (shouldFetchSales && salesLoading);

  return {
    candles: enhancedCandles,
    hasRealtimeData,
    realtimePoint,
    connectionState,
    lastUpdate,
    isLoading,
    dataSource: {
      history: storeData?.history?.length ? "store" : "api",
      sales: storeData?.history?.some((tx) => tx.instructionName === "sellNft")
        ? "store"
        : "api",
    },
  };
}
