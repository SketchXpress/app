// src/hook/core/useRealtimeChartData.ts
import { useMemo } from "react";
import { useCollectionsStore } from "@/stores/collectionsStore";
import { Time } from "lightweight-charts";

// Types for chart data enhancement
export interface ChartDataPoint {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  isRealtime?: boolean;
}

export interface EnhancedChartData {
  candles: ChartDataPoint[];
  hasRealtimeData: boolean;
  realtimePoint?: ChartDataPoint;
  connectionState: string;
  lastUpdate: number;
}

/**
 * Hook to enhance chart data with real-time price points
 * Adds current/live price data to existing historical candles
 *
 * @param poolAddress - Pool address to get real-time data for
 * @param historicalCandles - Existing historical candlestick data
 * @returns Enhanced chart data with real-time integration
 */
export function useRealtimeChartData(
  poolAddress: string | null,
  historicalCandles: ChartDataPoint[]
): EnhancedChartData {
  // Get real-time store data
  const { poolMetrics, connectionState, lastUpdate } = useCollectionsStore();

  // Get metrics for this specific pool
  const poolMetricsData = poolAddress ? poolMetrics.get(poolAddress) : null;

  // Generate real-time data point
  const realtimePoint = useMemo((): ChartDataPoint | undefined => {
    if (
      !poolMetricsData ||
      !poolMetricsData.lastPrice ||
      historicalCandles.length === 0
    ) {
      return undefined;
    }

    const lastCandle = historicalCandles[historicalCandles.length - 1];
    const currentTime = Math.floor(Date.now() / 1000) as Time;

    // Only add if the price is different from the last candle
    // and if it's been at least 30 seconds since the last update
    const timeDiff = Number(currentTime) - Number(lastCandle.time || 0);
    const priceDiff = Math.abs(poolMetricsData.lastPrice - lastCandle.close);

    if (timeDiff < 30 || priceDiff < 0.0001) {
      return undefined;
    }

    // Create a real-time candle point
    // Since we only have current price, we'll create a minimal candle
    const realtimeCandle: ChartDataPoint = {
      time: currentTime,
      open: lastCandle.close,
      high: Math.max(poolMetricsData.lastPrice, lastCandle.close),
      low: Math.min(poolMetricsData.lastPrice, lastCandle.close),
      close: poolMetricsData.lastPrice,
      volume: poolMetricsData.volume24h || 0,
      isRealtime: true,
    };

    return realtimeCandle;
  }, [poolMetricsData, historicalCandles]);

  // Combine historical and real-time data
  const enhancedCandles = useMemo((): ChartDataPoint[] => {
    if (!realtimePoint) {
      return historicalCandles;
    }

    // Check if we already have a recent candle to avoid duplication
    const lastHistoricalTime = Number(
      historicalCandles[historicalCandles.length - 1]?.time || 0
    );
    const realtimeTime = Number(realtimePoint.time);

    // If real-time point is too close to last historical point, update the last point
    if (realtimeTime - lastHistoricalTime < 60) {
      const updatedCandles = [...historicalCandles];
      updatedCandles[updatedCandles.length - 1] = {
        ...updatedCandles[updatedCandles.length - 1],
        close: realtimePoint.close,
        high: Math.max(
          updatedCandles[updatedCandles.length - 1].high,
          realtimePoint.close
        ),
        low: Math.min(
          updatedCandles[updatedCandles.length - 1].low,
          realtimePoint.close
        ),
        isRealtime: true,
      };
      return updatedCandles;
    }

    // Add real-time point as a new candle
    return [...historicalCandles, realtimePoint];
  }, [historicalCandles, realtimePoint]);

  return {
    candles: enhancedCandles,
    hasRealtimeData: !!realtimePoint,
    realtimePoint,
    connectionState,
    lastUpdate,
  };
}

/**
 * Hook to get real-time pool statistics for display
 * @param poolAddress - Pool address to get stats for
 */
export function useRealtimePoolStats(poolAddress: string | null) {
  const { poolMetrics, connectionState } = useCollectionsStore();
  const metrics = poolAddress ? poolMetrics.get(poolAddress) : null;

  return {
    metrics,
    hasRealtime: !!metrics,
    connectionState,
    stats: metrics
      ? {
          volume24h: metrics.volume24h,
          transactions24h: metrics.transactions24h,
          uniqueTraders24h: metrics.uniqueTraders24h,
          priceChange24h: metrics.priceChange24h,
          lastPrice: metrics.lastPrice,
        }
      : null,
  };
}
