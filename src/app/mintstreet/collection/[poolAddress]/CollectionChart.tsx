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
} from "lightweight-charts";
import styles from "./CollectionChart.module.scss";
import { useBondingCurveForPool } from "@/hooks/useBondingCurveForPool";
import ChartToolbar, { ChartType, Timeframe, SMAPeriod } from "./ChartToolbar";

type Candle = {
  time: number;    // seconds since epoch
  open: number;
  high: number;
  low: number;
  close: number;
};

interface CollectionChartProps {
  poolAddress: string;
}

// Type guard for checking OHLC data structure
function isCandleData(data: any): data is { open: number; high: number; low: number; close: number } {
  return data &&
    typeof data.open === 'number' &&
    typeof data.high === 'number' &&
    typeof data.low === 'number' &&
    typeof data.close === 'number';
}

// Type guard for checking if value is a number
function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

const CollectionChart: React.FC<CollectionChartProps> = ({ poolAddress }) => {
  // Chart container reference
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainer(node);
  }, []);

  // Chart settings and state
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [showSMA, setShowSMA] = useState(false);
  const [smaPeriod, setSmaPeriod] = useState<SMAPeriod>(20);
  const [timeframe, setTimeframe] = useState<Timeframe>('raw');
  const [legendValues, setLegendValues] = useState<{
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    time: Time | null;
  }>({
    open: null,
    high: null,
    low: null,
    close: null,
    time: null
  });

  // Fetch data directly using the hook
  const { history, isLoading } = useBondingCurveForPool(poolAddress);

  // Build raw candles from history
  const rawCandles: Candle[] = useMemo(() => {
    let lastPrice: number | null = null;
    return history
      .filter((h) => h.blockTime != null)
      .sort((a, b) => (a.blockTime! - b.blockTime!))
      .map((item) => {
        const t = Math.floor(item.blockTime!) as number;
        const price = item.price ?? lastPrice ?? 0;
        const open = lastPrice ?? price;
        const high = Math.max(open, price);
        const low = Math.min(open, price);
        lastPrice = price;
        return { time: t, open, high, low, close: price };
      });
  }, [history]);

  // Aggregate candles based on timeframe
  const candles = useMemo(() => {
    if (timeframe === 'raw' || rawCandles.length === 0) {
      return rawCandles;
    }

    const groupedCandles: Record<number, Candle & { count: number }> = {};

    rawCandles.forEach(candle => {
      const date = new Date(candle.time * 1000);
      let timeKey: number;

      if (timeframe === '1h') {
        // Group by hour
        date.setMinutes(0, 0, 0);
        timeKey = Math.floor(date.getTime() / 1000);
      } else { // '1d'
        // Group by day
        date.setHours(0, 0, 0, 0);
        timeKey = Math.floor(date.getTime() / 1000);
      }

      if (!groupedCandles[timeKey]) {
        groupedCandles[timeKey] = {
          time: timeKey,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          count: 1
        };
      } else {
        const group = groupedCandles[timeKey];
        group.high = Math.max(group.high, candle.high);
        group.low = Math.min(group.low, candle.low);
        group.close = candle.close;
        group.count += 1;
      }
    });

    return Object.values(groupedCandles);
  }, [rawCandles, timeframe]);

  // Chart and series refs
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<any> | null>(null);

  // Create chart and configure container
  useEffect(() => {
    if (!container) return;

    // Create chart
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#fff' },
        textColor: '#333'
      },
      grid: {
        vertLines: { color: '#eee' },
        horzLines: { color: '#eee' }
      },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: '#eee'
      },
      rightPriceScale: {
        borderColor: '#eee',
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true },
    });
    chartRef.current = chart;

    // Set up crosshair move handler for legend
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
          time: null
        });
      } else {
        const data = seriesRef.current ? param.seriesData.get(seriesRef.current) : null;

        if (data && isCandleData(data)) {
          setLegendValues({
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            time: param.time
          });
        } else if (data && 'value' in data && isNumber(data.value)) {
          // Handle line/area chart data with type guard
          setLegendValues({
            open: data.value,
            high: data.value,
            low: data.value,
            close: data.value,
            time: param.time
          });
        } else {
          // Handle non-number case
          setLegendValues({
            open: null,
            high: null,
            low: null,
            close: null,
            time: param.time
          });
        }
      }
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      smaSeriesRef.current = null;
    };
  }, [container]);

  // Handle chart type changes and create appropriate series
  useEffect(() => {
    if (!chartRef.current || !container) return;

    // Remove existing series
    if (seriesRef.current) {
      chartRef.current.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    // Create new series based on chart type
    if (chartType === 'candlestick') {
      seriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
        upColor: '#22C55E',
        downColor: '#EF4444',
        borderUpColor: '#22C55E',
        borderDownColor: '#EF4444',
        wickUpColor: '#22C55E',
        wickDownColor: '#EF4444',
        priceLineVisible: false,
      });
    } else if (chartType === 'line') {
      seriesRef.current = chartRef.current.addSeries(LineSeries, {
        color: '#2962FF',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      });
    } else if (chartType === 'area') {
      seriesRef.current = chartRef.current.addSeries(AreaSeries, {
        lineColor: '#2962FF',
        topColor: 'rgba(41, 98, 255, 0.28)',
        bottomColor: 'rgba(41, 98, 255, 0.05)',
        priceLineVisible: false,
        lastValueVisible: true,
      });
    } else if (chartType === 'bar') {
      seriesRef.current = chartRef.current.addSeries(BarSeries, {
        upColor: '#22C55E',
        downColor: '#EF4444',
        priceLineVisible: false,
      });
    }

    // Add volume series
    if (volumeSeriesRef.current) {
      chartRef.current.removeSeries(volumeSeriesRef.current);
    }

    volumeSeriesRef.current = chartRef.current.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    // Then apply scale margins separately
    if (volumeSeriesRef.current) {
      chartRef.current.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });
    }

    // Configure scale margins
    const priceSeries = seriesRef.current;
    if (priceSeries) {
      priceSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.1,
          bottom: 0.3,
        },
      });
    }
  }, [chartType, container]);

  // Update data when candles or chart type changes
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;

    if (chartType === 'line' || chartType === 'area') {
      // Line and area charts use simple price points
      seriesRef.current.setData(
        candles.map(c => ({ time: c.time, value: c.close }))
      );
    } else {
      // Candlestick/Bar chart uses OHLC data
      seriesRef.current.setData(candles);
    }

    // Update volume data
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(
        candles.map(c => ({
          time: c.time,
          value: Math.abs(c.close - c.open) * 100, // Use price change as proxy for volume
          color: c.close >= c.open ? '#26a69a' : '#ef5350',
        }))
      );
    }

    chartRef.current?.timeScale().fitContent();
  }, [candles, chartType]);

  // Handle SMA indicator
  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;

    if (showSMA) {
      // Calculate SMA
      const smaData = candles.map((_, index, array) => {
        if (index < smaPeriod - 1) return null;

        const sum = array
          .slice(index - smaPeriod + 1, index + 1)
          .reduce((total, candle) => total + candle.close, 0);

        return {
          time: array[index].time,
          value: sum / smaPeriod,
        };
      }).filter(Boolean);

      // Create or update SMA series
      if (!smaSeriesRef.current) {
        smaSeriesRef.current = chartRef.current.addSeries(LineSeries, {
          color: '#FF9800',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          title: `SMA (${smaPeriod})`,
        });
      }

      if (smaSeriesRef.current) {
        smaSeriesRef.current.setData(smaData);
      }
    } else if (smaSeriesRef.current) {
      // Remove series when disabled
      chartRef.current.removeSeries(smaSeriesRef.current);
      smaSeriesRef.current = null;
    }
  }, [showSMA, smaPeriod, candles]);

  // Handle window resize
  useEffect(() => {
    const onResize = () => {
      if (chartRef.current && container) {
        chartRef.current.resize(container.clientWidth, container.clientHeight, true);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [container]);

  // Legend component
  const Legend = () => {
    if (!legendValues.time) return null;

    return (
      <div className={styles.legend}>
        <div>O: <span>{legendValues.open?.toFixed(4)}</span></div>
        <div>H: <span>{legendValues.high?.toFixed(4)}</span></div>
        <div>L: <span>{legendValues.low?.toFixed(4)}</span></div>
        <div>C: <span>{legendValues.close?.toFixed(4)}</span></div>
      </div>
    );
  };

  // Loading & empty states
  if (isLoading) {
    return <div className={styles.loading}>Loading chart…</div>;
  }
  if (candles.length === 0) {
    return <div className={styles.empty}>No price history available.</div>;
  }

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.title}>Bonding Curve</h3>

      {/* Integrated toolbar component */}
      <ChartToolbar
        onResetZoom={() => chartRef.current?.timeScale().fitContent()}
        chartType={chartType}
        setChartType={setChartType}
        showSMA={showSMA}
        setShowSMA={setShowSMA}
        smaPeriod={smaPeriod}
        setSmaPeriod={setSmaPeriod}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
      />

      {/* Legend */}
      <Legend />

      {/* Chart container */}
      <div
        ref={containerRef}
        className={styles.chartContainer}
      />
    </div>
  );
};

export default CollectionChart;
