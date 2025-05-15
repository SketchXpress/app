/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  BarSeries,
  HistogramSeries,
  CrosshairMode,
  ColorType,
  Time,
  SeriesType,
} from "lightweight-charts";
import styles from "./CollectionChart.module.scss";
import { useBondingCurveForPool } from "@/hooks/useBondingCurveForPool";
import ChartToolbar, { ChartType, Timeframe, SMAPeriod } from "./ChartToolbar";
import { useHeliusSales } from "@/hooks/useHeliusSales";
import { useRealtimeChartData } from "@/hook/core/useRealtimeChartData";
import ConnectionStatus from "@/components/ConnectionStatus";

type Candle = {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  isRealtime?: boolean;
};

// Fixed ChartDataPoint type to match useRealtimeChartData
type ChartDataPoint = {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  isRealtime?: boolean;
};

interface CollectionChartProps {
  poolAddress: string;
  hasRealtimeData?: boolean;
  connectionState?: string;
}

function isCandleData(
  data: any
): data is { open: number; high: number; low: number; close: number } {
  return (
    data &&
    typeof data.open === "number" &&
    typeof data.high === "number" &&
    typeof data.low === "number" &&
    typeof data.close === "number"
  );
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

const CollectionChart: React.FC<CollectionChartProps> = ({
  poolAddress,
  hasRealtimeData: _hasRealtimeData = false, // Prefixed with _ to indicate intentionally unused
  connectionState: _connectionState = "disconnected", // Prefixed with _ to indicate intentionally unused
}) => {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainer(node);
  }, []);

  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [showSMA, setShowSMA] = useState(false);
  const [smaPeriod, setSmaPeriod] = useState<SMAPeriod>(20);
  const [timeframe, setTimeframe] = useState<Timeframe>("raw");
  const [legendValues, setLegendValues] = useState<{
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    time: Time | null;
    isRealtime?: boolean;
  }>({
    open: null,
    high: null,
    low: null,
    close: null,
    time: null,
  });

  // Existing data hooks
  const { history, isLoading } = useBondingCurveForPool(poolAddress);
  const { data: sales } = useHeliusSales(
    poolAddress,
    "70eef812-8d6b-496f-bc30-1725d5acb800"
  );

  // Sell price calculation
  function calculateSellPrice(
    basePrice: number,
    growthFactor: number,
    currentSupply: number
  ): number {
    try {
      const supplyAfterSell = currentSupply - 1;
      const price = basePrice + growthFactor * supplyAfterSell;
      return Math.max(price, basePrice);
    } catch (error) {
      console.error("Error in calculateSellPrice:", error);
      return basePrice * 0.8;
    }
  }

  // Process raw historical data into candles
  const rawCandles = useMemo(() => {
    const mintEvents = history
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

    let processedSellEvents =
      sales && sales.length > 0
        ? sales
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
            }))
        : [];

    const sellTransactions = history.filter(
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
          const basePrice = 0.05;
          const growthFactor = 0.02;
          const supplyBeforeSell =
            mintEvents.filter((m) => Number(m.time) <= Number(event.time))
              .length -
            processedSellEvents.filter(
              (s) => Number(s.time) < Number(event.time)
            ).length;
          const sellPrice = calculateSellPrice(
            basePrice,
            growthFactor,
            supplyBeforeSell
          );

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
  }, [history, sales]);

  // **Enhanced candles with real-time data**
  const {
    candles: enhancedCandles,
    hasRealtimeData: chartHasRealtime,
    realtimePoint,
    connectionState: chartConnectionState,
    lastUpdate,
  } = useRealtimeChartData(poolAddress, rawCandles);

  // Process candles based on timeframe
  const candles = useMemo(() => {
    if (timeframe === "raw" || enhancedCandles.length === 0) {
      return [...enhancedCandles].sort(
        (a, b) => Number(a.time) - Number(b.time)
      );
    }

    const groupedCandles: Record<number, Candle & { count: number }> = {};
    const sortedCandles = [...enhancedCandles].sort(
      (a, b) => Number(a.time) - Number(b.time)
    );

    sortedCandles.forEach((candle) => {
      const date = new Date(Number(candle.time) * 1000);
      let timeKey: number;

      if (timeframe === "1h") {
        date.setMinutes(0, 0, 0);
        timeKey = Math.floor(date.getTime() / 1000);
      } else {
        // '1d'
        date.setHours(0, 0, 0, 0);
        timeKey = Math.floor(date.getTime() / 1000);
      }

      if (!groupedCandles[timeKey]) {
        groupedCandles[timeKey] = {
          time: timeKey as Time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          count: 1,
          isRealtime: candle.isRealtime,
        };
      } else {
        const group = groupedCandles[timeKey];
        group.high = Math.max(group.high, candle.high);
        group.low = Math.min(group.low, candle.low);
        group.close = candle.close;
        group.count += 1;
        group.isRealtime = group.isRealtime || candle.isRealtime;
      }
    });
    return Object.values(groupedCandles).sort(
      (a, b) => Number(a.time) - Number(b.time)
    );
  }, [enhancedCandles, timeframe]);

  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null);

  const handleResetZoom = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, []);

  // Chart initialization with real-time enhancements
  useEffect(() => {
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#fff" },
        textColor: "#333",
      },
      grid: {
        vertLines: { color: "#eee" },
        horzLines: { color: "#eee" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: "#eee",
        barSpacing: 15,
        rightBarStaysOnScroll: false,
      },
      rightPriceScale: {
        borderColor: "#eee",
        autoScale: true,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true },
    });
    chartRef.current = chart;

    const initialSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22C55E",
      downColor: "#EF4444",
      borderUpColor: "#22C55E",
      borderDownColor: "#EF4444",
      wickUpColor: "#22C55E",
      wickDownColor: "#EF4444",
      priceLineVisible: false,
    });
    seriesRef.current = initialSeries;

    // Enhanced crosshair handler with real-time detection
    chart.subscribeCrosshairMove((param) => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > container.clientWidth ||
        param.point.y < 0 ||
        param.point.y > container.clientHeight
      ) {
        setLegendValues({
          open: null,
          high: null,
          low: null,
          close: null,
          time: null,
        });
      } else {
        const data = seriesRef.current
          ? param.seriesData.get(seriesRef.current)
          : null;

        // Check if this is a real-time data point
        const candleIndex = candles.findIndex((c) => c.time === param.time);
        const isRealtime =
          candleIndex !== -1 ? candles[candleIndex].isRealtime : false;

        if (data && isCandleData(data)) {
          setLegendValues({
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            time: param.time,
            isRealtime,
          });
        } else if (data && "value" in data && isNumber(data.value)) {
          setLegendValues({
            open: data.value,
            high: data.value,
            low: data.value,
            close: data.value,
            time: param.time,
            isRealtime,
          });
        } else {
          setLegendValues({
            open: null,
            high: null,
            low: null,
            close: null,
            time: param.time,
          });
        }
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
      }
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      smaSeriesRef.current = null;
    };
  }, [container, candles]);

  // Chart update effect with real-time data highlighting
  useEffect(() => {
    if (!chartRef.current || !container) return;

    const finalCandles = [...candles].sort(
      (a, b) => Number(a.time) - Number(b.time)
    );

    // Validate data ordering
    for (let i = 1; i < finalCandles.length; i++) {
      if (Number(finalCandles[i].time) <= Number(finalCandles[i - 1].time)) {
        console.error(
          "CRITICAL: Data not strictly ascending before setting to chart!",
          {
            index: i,
            currentTime: finalCandles[i].time,
            prevTime: finalCandles[i - 1].time,
          }
        );
      }
    }

    if (seriesRef.current) {
      chartRef.current.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    let newSeries;
    if (chartType === "candlestick") {
      newSeries = chartRef.current.addSeries(CandlestickSeries, {
        upColor: "#22C55E",
        downColor: "#EF4444",
        borderUpColor: "#22C55E",
        borderDownColor: "#EF4444",
        wickUpColor: "#22C55E",
        wickDownColor: "#EF4444",
        priceLineVisible: false,
      });
    } else if (chartType === "line") {
      newSeries = chartRef.current.addSeries(LineSeries, {
        color: "#2962FF",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      });
    } else if (chartType === "area") {
      newSeries = chartRef.current.addSeries(AreaSeries, {
        lineColor: "#2962FF",
        topColor: "rgba(41, 98, 255, 0.28)",
        bottomColor: "rgba(41, 98, 255, 0.05)",
        priceLineVisible: false,
        lastValueVisible: true,
      });
    } else if (chartType === "bar") {
      newSeries = chartRef.current.addSeries(BarSeries, {
        upColor: "#22C55E",
        downColor: "#EF4444",
        priceLineVisible: false,
      });
    }

    if (newSeries) {
      seriesRef.current = newSeries;
      if (finalCandles.length > 0) {
        if (chartType === "candlestick" || chartType === "bar") {
          // Fix: Ensure proper Time type casting
          seriesRef.current.setData(
            finalCandles.map((c) => ({
              time: c.time as Time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            }))
          );
        } else {
          // Fix: Ensure proper Time type casting for line/area charts
          seriesRef.current.setData(
            finalCandles.map((c) => ({
              time: c.time as Time,
              value: c.close,
            }))
          );
        }
        chartRef.current.timeScale().fitContent();
      }
    }

    // Volume series
    if (volumeSeriesRef.current) {
      chartRef.current.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }
    volumeSeriesRef.current = chartRef.current.addSeries(HistogramSeries, {
      color: "#26a69a",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    // SMA series
    if (smaSeriesRef.current) {
      chartRef.current.removeSeries(smaSeriesRef.current);
      smaSeriesRef.current = null;
    }
    if (
      showSMA &&
      seriesRef.current &&
      (chartType === "candlestick" ||
        chartType === "line" ||
        chartType === "area") &&
      finalCandles.length >= smaPeriod
    ) {
      const smaData = finalCandles
        .slice(smaPeriod - 1)
        .map((_, index) => {
          const sum = finalCandles
            .slice(index, index + smaPeriod)
            .reduce((acc, curr) => acc + curr.close, 0);
          return {
            time: finalCandles[index + smaPeriod - 1].time as Time,
            value: sum / smaPeriod,
          };
        })
        .sort((a, b) => Number(a.time) - Number(b.time));

      if (smaData.length > 0) {
        smaSeriesRef.current = chartRef.current.addSeries(LineSeries, {
          color: "rgba(255, 165, 0, 0.8)",
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        smaSeriesRef.current.setData(smaData);
      }
    }

    // Apply price scale options
    if (seriesRef.current) {
      seriesRef.current.priceScale().applyOptions({
        scaleMargins: { top: 0.1, bottom: 0.3 },
        autoScale: true,
      });
    }
    if (volumeSeriesRef.current) {
      (chartRef.current.priceScale("volume") as any).applyOptions({
        scaleMargins: { top: 0.7, bottom: 0 },
        autoScale: true,
      });
    }
  }, [chartType, candles, showSMA, smaPeriod, container]);

  if (isLoading && rawCandles.length === 0) {
    return <div className={styles.loadingContainer}>Loading chart data...</div>;
  }

  return (
    <div className={styles.chartWrapper}>
      {/* Enhanced toolbar with connection status */}
      <div className={styles.toolbarContainer}>
        <ChartToolbar
          chartType={chartType}
          setChartType={setChartType}
          showSMA={showSMA}
          setShowSMA={setShowSMA}
          smaPeriod={smaPeriod}
          setSmaPeriod={setSmaPeriod}
          timeframe={timeframe}
          setTimeframe={setTimeframe}
          onResetZoom={handleResetZoom}
        />

        {/* Connection status for chart */}
        <div className={styles.chartStatus}>
          <ConnectionStatus
            connectionState={chartConnectionState}
            hasRealtimeData={chartHasRealtime}
            lastUpdate={lastUpdate}
            size="sm"
            showText={false}
          />
          {chartHasRealtime && realtimePoint && (
            <span className={styles.realtimeIndicator}>
              Live Price: {realtimePoint.close.toFixed(4)} SOL
            </span>
          )}
        </div>
      </div>

      <div ref={containerRef} className={styles.chartContainer}>
        {/* Enhanced legend with real-time indicator */}
        {legendValues.time && (
          <div
            className={`${styles.legend} ${
              legendValues.isRealtime ? styles.realtimeLegend : ""
            }`}
          >
            <div className={styles.legendRow}>
              <span>
                Time:{" "}
                {new Date(Number(legendValues.time) * 1000).toLocaleString()}
              </span>
              {legendValues.isRealtime && (
                <span className={styles.realtimeBadge}>LIVE</span>
              )}
            </div>
            {legendValues.open !== null && (
              <div>Open: {legendValues.open.toFixed(4)}</div>
            )}
            {legendValues.high !== null && (
              <div>High: {legendValues.high.toFixed(4)}</div>
            )}
            {legendValues.low !== null && (
              <div>Low: {legendValues.low.toFixed(4)}</div>
            )}
            {legendValues.close !== null && (
              <div>Close: {legendValues.close.toFixed(4)}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionChart;
