import { useMemo } from "react";
import { useCollectionsStore } from "@/stores/collectionsStore";
import { Time } from "lightweight-charts";

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

export function useRealtimeChartData(
  poolAddress: string | null,
  historicalCandles: ChartDataPoint[]
): EnhancedChartData {
  const { poolMetrics, connectionState, lastUpdate } = useCollectionsStore();

  const poolMetricsData = poolAddress ? poolMetrics.get(poolAddress) : null;

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

    const timeDiff = Number(currentTime) - Number(lastCandle.time || 0);
    const priceDiff = Math.abs(poolMetricsData.lastPrice - lastCandle.close);

    if (timeDiff < 30 || priceDiff < 0.0001) {
      return undefined;
    }

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
