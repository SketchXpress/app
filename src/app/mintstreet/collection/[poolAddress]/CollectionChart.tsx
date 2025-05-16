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

import { useBondingCurveForPool } from "@/hook/pools";
import { useHeliusSales } from "@/hook/pools/useHeliusSales";
import ConnectionStatus from "@/components/ConnectionStatus";
import { useRealtimeChartData } from "@/hook/core/useRealtimeChartData";

import styles from "./CollectionChart.module.scss";
import ChartToolbar, { ChartType, Timeframe, SMAPeriod } from "./ChartToolbar";

type Candle = {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  isRealtime?: boolean;
};

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hasRealtimeData: _hasRealtimeData = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  connectionState: _connectionState = "disconnected",
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

  const { history, isLoading } = useBondingCurveForPool(poolAddress);
  const { data: sales } = useHeliusSales(
    poolAddress,
    "70eef812-8d6b-496f-bc30-1725d5acb800"
  );

  const rawCandles = useMemo(() => {
    if (!history || !sales) {
      return [];
    }

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

    const sellEvents = sales
      .filter((s) => s.blockTime != null && s.soldSol != null && s.soldSol > 0)
      .map((item) => ({
        time: Math.floor(item.blockTime!) as Time,
        price: item.soldSol!,
        type: "sell" as const,
        signature: item.signature,
      }))
      .sort((a, b) => Number(a.time) - Number(b.time));

    const allEvents = [...mintEvents, ...sellEvents].sort((a, b) => {
      const timeDiff = Number(a.time) - Number(b.time);
      if (timeDiff !== 0) return timeDiff;
      // If same time, put mints before sells
      if (a.type === "mint" && b.type === "sell") return -1;
      if (a.type === "sell" && b.type === "mint") return 1;
      return 0;
    });

    const candles: ChartDataPoint[] = [];
    let lastPrice = 0;
    let lastTime = 0;

    allEvents.forEach((event, index) => {
      // Ensure strictly increasing timestamps
      let eventTime = Number(event.time);
      if (eventTime <= lastTime) {
        eventTime = lastTime + 1;
      }

      // Handle first event
      if (index === 0) {
        lastPrice = 0;
        // Create initial candle 1 day before first event
        const initialTime = Math.max(1, eventTime - 86400);
        if (event.type === "mint") {
          candles.push({
            time: initialTime as Time,
            open: 0,
            high: event.price,
            low: 0,
            close: event.price,
          });
        }
      }

      let candle: ChartDataPoint;

      if (event.type === "mint") {
        // MINT = GREEN CANDLE
        candle = {
          time: eventTime as Time,
          open: lastPrice,
          high: Math.max(lastPrice, event.price),
          low: Math.min(lastPrice, event.price),
          close: event.price,
        };
      } else {
        // SELL = RED CANDLE
        candle = {
          time: eventTime as Time,
          open: lastPrice,
          high: lastPrice,
          low: Math.min(lastPrice, event.price),
          close: event.price,
        };
      }

      candles.push(candle);
      lastPrice = event.price;
      lastTime = eventTime;
    });

    // Final validation and deduplication
    const validatedCandles: ChartDataPoint[] = [];
    const timesSeen = new Set<number>();

    candles.forEach((candle) => {
      const time = Number(candle.time);
      if (!timesSeen.has(time)) {
        timesSeen.add(time);
        validatedCandles.push(candle);
      }
    });

    // Sort final candles
    const sortedCandles = validatedCandles.sort(
      (a, b) => Number(a.time) - Number(b.time)
    );

    return sortedCandles;
  }, [history, sales]);

  const {
    candles: enhancedCandles,
    hasRealtimeData: chartHasRealtime,
    realtimePoint,
    connectionState: chartConnectionState,
    lastUpdate,
  } = useRealtimeChartData(poolAddress, rawCandles);

  // Processing candles based on timeframe
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

  // Chart initialization
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

  useEffect(() => {
    if (!chartRef.current || !container) return;

    const finalCandles = [...candles].sort(
      (a, b) => Number(a.time) - Number(b.time)
    );

    const validatedCandles: ChartDataPoint[] = [];
    const timesSeen = new Set<number>();

    finalCandles.forEach((candle, index) => {
      const time = Number(candle.time);

      if (timesSeen.has(time)) {
        console.warn(
          `Duplicate timestamp found at index ${index}, time: ${time}. Skipping.`
        );
        return;
      }

      if (validatedCandles.length > 0) {
        const lastTime = Number(
          validatedCandles[validatedCandles.length - 1].time
        );
        if (time <= lastTime) {
          console.warn(
            `Non-ascending timestamp found at index ${index}. Current: ${time}, Previous: ${lastTime}. Adjusting.`
          );
          candle.time = (lastTime + 1) as Time;
        }
      }

      timesSeen.add(Number(candle.time));
      validatedCandles.push(candle);
    });

    let hasError = false;
    for (let i = 1; i < validatedCandles.length; i++) {
      if (
        Number(validatedCandles[i].time) <= Number(validatedCandles[i - 1].time)
      ) {
        console.error(
          "CRITICAL: Data still not strictly ascending after validation!",
          {
            index: i,
            currentTime: validatedCandles[i].time,
            prevTime: validatedCandles[i - 1].time,
          }
        );
        hasError = true;
      }
    }

    if (hasError) {
      validatedCandles.forEach((candle, index) => {
        if (index === 0) return;
        const prevTime = Number(validatedCandles[index - 1].time);
        if (Number(candle.time) <= prevTime) {
          candle.time = (prevTime + 1) as Time;
        }
      });
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
      if (validatedCandles.length > 0) {
        if (chartType === "candlestick" || chartType === "bar") {
          seriesRef.current.setData(
            validatedCandles.map((c) => ({
              time: c.time as Time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            }))
          );
        } else {
          seriesRef.current.setData(
            validatedCandles.map((c) => ({
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
      validatedCandles.length >= smaPeriod
    ) {
      const smaData = validatedCandles
        .slice(smaPeriod - 1)
        .map((_, index) => {
          const sum = validatedCandles
            .slice(index, index + smaPeriod)
            .reduce((acc, curr) => acc + curr.close, 0);
          return {
            time: validatedCandles[index + smaPeriod - 1].time as Time,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
