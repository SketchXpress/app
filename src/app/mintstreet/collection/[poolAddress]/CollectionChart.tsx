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
  DeepPartial,
  ChartOptions,
  CandlestickSeriesOptions,
  LineSeriesOptions,
  AreaSeriesOptions,
  BarSeriesOptions,
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
  volume?: number;
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

interface LegendValues {
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  time: Time | null;
  volume?: number | null;
  isRealtime?: boolean;
}

// Type guards
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
  return typeof value === "number" && !isNaN(value) && isFinite(value);
}

function isValidPrice(price: number): boolean {
  return isNumber(price) && price > 0 && price < 1000000; // Reasonable price range
}

const CollectionChart: React.FC<CollectionChartProps> = ({
  poolAddress,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hasRealtimeData: _hasRealtimeData = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  connectionState: _connectionState = "disconnected",
}) => {
  // Chart state
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [showSMA, setShowSMA] = useState(false);
  const [smaPeriod, setSmaPeriod] = useState<SMAPeriod>(20);
  const [timeframe, setTimeframe] = useState<Timeframe>("raw");
  const [legendValues, setLegendValues] = useState<LegendValues>({
    open: null,
    high: null,
    low: null,
    close: null,
    time: null,
  });

  // Chart refs
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Data hooks
  const {
    history,
    isLoading,
    error: historyError,
  } = useBondingCurveForPool(poolAddress);
  const { data: sales, error: salesError } = useHeliusSales(
    poolAddress,
    "70eef812-8d6b-496f-bc30-1725d5acb800"
  );

  console.table(sales);

  // Container ref callback with improved resize handling
  const containerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (container && resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }

      setContainer(node);

      if (node) {
        // Use ResizeObserver for better performance
        resizeObserverRef.current = new ResizeObserver((entries) => {
          if (chartRef.current && entries[0]) {
            const { width, height } = entries[0].contentRect;
            chartRef.current.applyOptions({
              width: Math.floor(width),
              height: Math.floor(height),
            });
          }
        });
        resizeObserverRef.current.observe(node);
      }
    },
    [container]
  );

  // Enhanced candle processing with better validation
  const rawCandles = useMemo(() => {
    if (!history || !sales) {
      return [];
    }

    try {
      // Filter and validate mint events
      const mintEvents = history
        .filter((h) => {
          return (
            h.blockTime != null &&
            h.instructionName === "mintNft" &&
            h.price != null &&
            isValidPrice(h.price)
          );
        })
        .map((item) => ({
          time: Math.floor(item.blockTime!) as Time,
          price: item.price!,
          type: "mint" as const,
          signature: item.signature,
        }))
        .sort((a, b) => Number(a.time) - Number(b.time));

      // Filter and validate sell events
      const sellEvents = sales
        .filter((s) => {
          return (
            s.blockTime != null && s.soldSol != null && isValidPrice(s.soldSol)
          );
        })
        .map((item) => ({
          time: Math.floor(item.blockTime!) as Time,
          price: item.soldSol!,
          type: "sell" as const,
          signature: item.signature,
        }))
        .sort((a, b) => Number(a.time) - Number(b.time));

      // Combine and sort all events
      const allEvents = [...mintEvents, ...sellEvents].sort((a, b) => {
        const timeDiff = Number(a.time) - Number(b.time);
        if (timeDiff !== 0) return timeDiff;
        // If same time, put mints before sells
        return a.type === "mint" && b.type === "sell" ? -1 : 1;
      });

      if (allEvents.length === 0) {
        return [];
      }

      const candles: ChartDataPoint[] = [];
      let lastPrice = 0;
      let lastTime = 0;

      // Process events into candles
      allEvents.forEach((event, index) => {
        // Ensure strictly increasing timestamps
        let eventTime = Number(event.time);
        if (eventTime <= lastTime) {
          eventTime = lastTime + 1;
        }

        // Handle first event - create baseline
        if (index === 0) {
          lastPrice = Math.max(0.0001, event.price * 0.9); // Small baseline
          const initialTime = Math.max(1, eventTime - 3600); // 1 hour before

          candles.push({
            time: initialTime as Time,
            open: lastPrice,
            high: lastPrice,
            low: lastPrice,
            close: lastPrice,
            volume: 0,
          });
        }

        let candle: ChartDataPoint;

        if (event.type === "mint") {
          // MINT = Price going up (green candle)
          candle = {
            time: eventTime as Time,
            open: lastPrice,
            high: Math.max(lastPrice, event.price),
            low: Math.min(lastPrice, event.price),
            close: event.price,
            volume: event.price, // Volume in SOL
          };
        } else {
          // SELL = Price going down (red candle)
          candle = {
            time: eventTime as Time,
            open: lastPrice,
            high: lastPrice,
            low: Math.min(lastPrice, event.price),
            close: event.price,
            volume: event.price, // Volume in SOL
          };
        }

        candles.push(candle);
        lastPrice = event.price;
        lastTime = eventTime;
      });

      // Validate and deduplicate final candles
      const validatedCandles: ChartDataPoint[] = [];
      const timesSeen = new Set<number>();

      candles.forEach((candle) => {
        const time = Number(candle.time);
        if (!timesSeen.has(time) && isValidPrice(candle.close)) {
          timesSeen.add(time);
          validatedCandles.push(candle);
        }
      });

      return validatedCandles.sort((a, b) => Number(a.time) - Number(b.time));
    } catch (error) {
      console.error("Error processing candle data:", error);
      return [];
    }
  }, [history, sales]);

  // Real-time data integration
  const {
    candles: enhancedCandles,
    hasRealtimeData: chartHasRealtime,
    realtimePoint,
    connectionState: chartConnectionState,
    lastUpdate,
  } = useRealtimeChartData(poolAddress, rawCandles);

  // Timeframe processing with improved aggregation
  const processedCandles = useMemo(() => {
    if (timeframe === "raw" || enhancedCandles.length === 0) {
      return enhancedCandles;
    }

    const groupedCandles: Record<
      number,
      Candle & { volumeSum: number; count: number }
    > = {};

    enhancedCandles.forEach((candle) => {
      const date = new Date(Number(candle.time) * 1000);
      let timeKey: number;

      switch (timeframe) {
        case "1h":
          date.setMinutes(0, 0, 0);
          timeKey = Math.floor(date.getTime() / 1000);
          break;
        case "1d":
        default:
          date.setHours(0, 0, 0, 0);
          timeKey = Math.floor(date.getTime() / 1000);
          break;
      }

      if (!groupedCandles[timeKey]) {
        groupedCandles[timeKey] = {
          time: timeKey as Time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume || 0,
          volumeSum: candle.volume || 0,
          count: 1,
          isRealtime: candle.isRealtime,
        };
      } else {
        const group = groupedCandles[timeKey];
        group.high = Math.max(group.high, candle.high);
        group.low = Math.min(group.low, candle.low);
        group.close = candle.close; // Latest close in the period
        group.volumeSum += candle.volume || 0;
        group.count += 1;
        group.isRealtime = group.isRealtime || candle.isRealtime;
        group.volume = group.volumeSum; // Total volume for the period
      }
    });

    return (
      Object.values(groupedCandles)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ volumeSum, count, ...candle }) => candle)
        .sort((a, b) => Number(a.time) - Number(b.time))
    );
  }, [enhancedCandles, timeframe]);

  // Chart initialization with better error handling
  useEffect(() => {
    if (!container) return;

    try {
      const chartOptions: DeepPartial<ChartOptions> = {
        autoSize: true,
        layout: {
          background: { type: ColorType.Solid, color: "#ffffff" },
          textColor: "#333333",
        },
        grid: {
          vertLines: { color: "#f0f0f0" },
          horzLines: { color: "#f0f0f0" },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            width: 1,
            color: "#C3BCDB44",
            style: 0,
          },
          horzLine: {
            width: 1,
            color: "#C3BCDB44",
            style: 0,
          },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: "#e0e0e0",
          barSpacing: 15,
          rightBarStaysOnScroll: true,
          fixLeftEdge: false,
          fixRightEdge: false,
        },
        rightPriceScale: {
          borderColor: "#e0e0e0",
          autoScale: true,
          scaleMargins: {
            top: 0.1,
            bottom: 0.2,
          },
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
      };

      const chart = createChart(container, chartOptions);
      chartRef.current = chart;

      // Add crosshair move handler
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
            volume: null,
          });
        } else {
          const data = seriesRef.current
            ? param.seriesData.get(seriesRef.current)
            : null;

          const candleIndex = processedCandles.findIndex(
            (c) => c.time === param.time
          );
          const currentCandle =
            candleIndex !== -1 ? processedCandles[candleIndex] : null;

          if (data && isCandleData(data)) {
            setLegendValues({
              open: data.open,
              high: data.high,
              low: data.low,
              close: data.close,
              time: param.time,
              volume: currentCandle?.volume || null,
              isRealtime: currentCandle?.isRealtime,
            });
          } else if (data && "value" in data && isNumber(data.value)) {
            setLegendValues({
              open: data.value,
              high: data.value,
              low: data.value,
              close: data.value,
              time: param.time,
              volume: currentCandle?.volume || null,
              isRealtime: currentCandle?.isRealtime,
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
    } catch (error) {
      console.error("Error initializing chart:", error);
    }
  }, [container, processedCandles]);

  // Series management with improved error handling
  useEffect(() => {
    if (!chartRef.current || !container || processedCandles.length === 0)
      return;

    try {
      // Remove existing series
      if (seriesRef.current) {
        chartRef.current.removeSeries(seriesRef.current);
        seriesRef.current = null;
      }
      if (volumeSeriesRef.current) {
        chartRef.current.removeSeries(volumeSeriesRef.current);
        volumeSeriesRef.current = null;
      }
      if (smaSeriesRef.current) {
        chartRef.current.removeSeries(smaSeriesRef.current);
        smaSeriesRef.current = null;
      }

      // Create main series based on chart type
      let newSeries: ISeriesApi<SeriesType, Time>;

      switch (chartType) {
        case "candlestick":
          const candlestickOptions: DeepPartial<CandlestickSeriesOptions> = {
            upColor: "#22C55E",
            downColor: "#EF4444",
            borderUpColor: "#22C55E",
            borderDownColor: "#EF4444",
            wickUpColor: "#22C55E",
            wickDownColor: "#EF4444",
            priceLineVisible: false,
          };
          newSeries = chartRef.current.addSeries(
            CandlestickSeries,
            candlestickOptions
          );
          break;

        case "line":
          const lineOptions: DeepPartial<LineSeriesOptions> = {
            color: "#2962FF",
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            crosshairMarkerVisible: true,
          };
          newSeries = chartRef.current.addSeries(LineSeries, lineOptions);
          break;

        case "area":
          const areaOptions: DeepPartial<AreaSeriesOptions> = {
            lineColor: "#2962FF",
            topColor: "rgba(41, 98, 255, 0.28)",
            bottomColor: "rgba(41, 98, 255, 0.05)",
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
          };
          newSeries = chartRef.current.addSeries(AreaSeries, areaOptions);
          break;

        case "bar":
        default:
          const barOptions: DeepPartial<BarSeriesOptions> = {
            upColor: "#22C55E",
            downColor: "#EF4444",
            priceLineVisible: false,
          };
          newSeries = chartRef.current.addSeries(BarSeries, barOptions);
          break;
      }

      seriesRef.current = newSeries;

      // Set data based on chart type
      if (chartType === "candlestick" || chartType === "bar") {
        newSeries.setData(
          processedCandles.map((c) => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        );
      } else {
        newSeries.setData(
          processedCandles.map((c) => ({
            time: c.time,
            value: c.close,
          }))
        );
      }

      // Add volume series if we have volume data
      if (processedCandles.some((c) => c.volume && c.volume > 0)) {
        volumeSeriesRef.current = chartRef.current.addSeries(HistogramSeries, {
          color: "rgba(76, 175, 80, 0.5)",
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
          priceLineVisible: false,
        });

        const volumeData = processedCandles
          .filter((c) => c.volume && c.volume > 0)
          .map((c) => ({
            time: c.time,
            value: c.volume!,
            color:
              c.close > c.open
                ? "rgba(76, 175, 80, 0.5)"
                : "rgba(255, 82, 82, 0.5)",
          }));

        if (volumeData.length > 0) {
          volumeSeriesRef.current.setData(volumeData);
        }
      }

      // Add SMA if enabled
      if (showSMA && processedCandles.length >= smaPeriod) {
        try {
          const smaData = processedCandles
            .slice(smaPeriod - 1)
            .map((_, index) => {
              const slice = processedCandles.slice(index, index + smaPeriod);
              const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
              return {
                time: processedCandles[index + smaPeriod - 1].time,
                value: sum / smaPeriod,
              };
            });

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
        } catch (error) {
          console.error("Error adding SMA:", error);
        }
      }

      // Configure price scales
      if (volumeSeriesRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (chartRef.current.priceScale("volume") as any).applyOptions({
          scaleMargins: { top: 0.7, bottom: 0 },
          autoScale: true,
        });
      }

      // Fit content after data is loaded
      chartRef.current.timeScale().fitContent();
    } catch (error) {
      console.error("Error updating chart series:", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType, processedCandles, showSMA, smaPeriod]);

  // Reset zoom handler
  const handleResetZoom = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, []);

  // Error handling
  const hasError = historyError || salesError;
  const errorMessage = historyError || salesError?.message;

  if (hasError) {
    return (
      <div className={styles.chartWrapper}>
        <div className={styles.errorContainer}>
          <p>Error loading chart data: {errorMessage}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  if (isLoading && rawCandles.length === 0) {
    return (
      <div className={styles.chartWrapper}>
        <div className={styles.loadingContainer}>
          <p>Loading chart data...</p>
        </div>
      </div>
    );
  }

  if (processedCandles.length === 0) {
    return (
      <div className={styles.chartWrapper}>
        <div className={styles.emptyContainer}>
          <p>No trading data available for this pool</p>
        </div>
      </div>
    );
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
              Live: {realtimePoint.close.toFixed(4)} SOL
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
              <span className={styles.legendTime}>
                {new Date(Number(legendValues.time) * 1000).toLocaleString()}
              </span>
              {legendValues.isRealtime && (
                <span className={styles.realtimeBadge}>LIVE</span>
              )}
            </div>

            <div className={styles.legendData}>
              {legendValues.open !== null && (
                <span className={styles.legendItem}>
                  O: {legendValues.open.toFixed(4)}
                </span>
              )}
              {legendValues.high !== null && (
                <span className={styles.legendItem}>
                  H: {legendValues.high.toFixed(4)}
                </span>
              )}
              {legendValues.low !== null && (
                <span className={styles.legendItem}>
                  L: {legendValues.low.toFixed(4)}
                </span>
              )}
              {legendValues.close !== null && (
                <span className={styles.legendItem}>
                  C: {legendValues.close.toFixed(4)}
                </span>
              )}
              {legendValues.volume !== null && legendValues.volume! > 0 && (
                <span className={styles.legendItem}>
                  V: {legendValues.volume!.toFixed(2)} SOL
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionChart;
