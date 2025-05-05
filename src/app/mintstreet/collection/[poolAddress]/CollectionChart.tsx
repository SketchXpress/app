"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { 
  createChart, 
  IChartApi, 
  ISeriesApi, 
  CandlestickData, 
  LineData, 
  AreaData, 
  BarData, 
  HistogramData, 
  UTCTimestamp, 
  CrosshairMode, 
  ColorType,
  DeepPartial,
  ChartOptions,
  Time,
  WhitespaceData,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  BarSeries,
  HistogramSeries
} from "lightweight-charts";
import { fetchCandles } from "@/lib/fetchCandles";
import styles from "./CollectionChart.module.scss";
import ChartToolbar from "./ChartToolbar";

// Import or re-define the exact types from ChartToolbar to ensure compatibility
type ChartType = 'candlestick' | 'line' | 'area' | 'bar';
type Timeframe = 'raw' | '1h' | '1d';
type SMAPeriod = 5 | 10 | 20 | 50 | 100;

// Define a custom type for crosshair moved events since it's not exported
interface CrosshairMovedEventParams<T> {
  point?: { x: number; y: number };
  time?: T;
  seriesData: Map<ISeriesApi<any, T, any, any, any>, any>;
}

// Define Candle interface based on expected data structure
interface Candle {
  time: number; // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
}

// Define props for the component
interface CollectionChartProps {
  poolAddress: string;
}

// Type for legend values
interface LegendValues {
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  time: UTCTimestamp | null;
  formattedTime: string | null;
}

// Type definition for the crosshair move handler function
type CrosshairMoveHandler = (param: CrosshairMovedEventParams<Time>) => void;

const CollectionChart: React.FC<CollectionChartProps> = ({ poolAddress }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any, Time, any, any, any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram", Time, HistogramData | WhitespaceData, any, any> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<"Line", Time, LineData | WhitespaceData, any, any> | null>(null);
  
  const [candles, setCandles] = useState<Candle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // States for chart tools and settings
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [showSMA, setShowSMA] = useState(false);
  const [smaPeriod, setSmaPeriod] = useState<SMAPeriod>(20);
  const [timeframe, setTimeframe] = useState<Timeframe>('raw');
  const [legendValues, setLegendValues] = useState<LegendValues>({
    open: null,
    high: null,
    low: null,
    close: null,
    time: null,
    formattedTime: null,
  });

  // Handler for SMAPeriod changes to ensure type safety
  const handleSmaPeriodChange = (period: number) => {
    // Ensure the period is one of the allowed values
    if (period === 5 || period === 10 || period === 20 || period === 50 || period === 100) {
      setSmaPeriod(period);
    }
  };

  // Memoized crosshair move handler to maintain stable reference for unsubscribe
  const crosshairMoveHandler = useCallback<CrosshairMoveHandler>(
    (param) => {
      if (
        param.point === undefined ||
        !param.time ||
        !chartContainerRef.current ||
        param.point.x < 0 ||
        param.point.x > chartContainerRef.current.clientWidth ||
        param.point.y < 0 ||
        param.point.y > chartContainerRef.current.clientHeight ||
        !seriesRef.current
      ) {
        setLegendValues({ open: null, high: null, low: null, close: null, time: null, formattedTime: null });
        return;
      }

      const seriesData = param.seriesData.get(seriesRef.current);
      let newLegendValues: LegendValues = { 
        open: null, 
        high: null, 
        low: null, 
        close: null, 
        time: param.time as UTCTimestamp, 
        formattedTime: null 
      };

      if (seriesData) {
        const currentType = seriesRef.current.seriesType();
        if (currentType === 'Candlestick' || currentType === 'Bar') {
          const candleData = seriesData as CandlestickData | BarData;
          newLegendValues = {
            ...newLegendValues,
            open: candleData.open ?? null,
            high: candleData.high ?? null,
            low: candleData.low ?? null,
            close: candleData.close ?? null,
          };
        } else if (currentType === 'Line' || currentType === 'Area') {
          const lineData = seriesData as LineData | AreaData;
          newLegendValues = {
            ...newLegendValues,
            close: lineData.value ?? null,
          };
        }
      }
      
      // Format time for display
      if (newLegendValues.time) {
          const date = new Date(newLegendValues.time * 1000);
          newLegendValues.formattedTime = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
      }

      setLegendValues(newLegendValues);
    },
    [] // No dependencies needed as we're using refs
  );

  // Fetch initial candle data
  useEffect(() => {
    const loadCandles = async () => {
      setIsLoading(true);
      try {
        const fetchedCandles = await fetchCandles(poolAddress);
        // Ensure candles are sorted by time ascending
        fetchedCandles.sort((a: Candle, b: Candle) => a.time - b.time);
        setCandles(fetchedCandles);
      } catch (error) {
        console.error("Failed to fetch candle data:", error);
        setCandles([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadCandles();
  }, [poolAddress]);

  // Time Aggregation Logic
  const aggregatedCandles = useMemo(() => {
    if (timeframe === "raw" || candles.length === 0) {
      return candles;
    }

    const groupedCandles: { [key: number]: Candle & { count: number } } = {};

    candles.forEach((candle) => {
      let timeKey: number;
      const date = new Date(candle.time * 1000);

      if (timeframe === "1h") {
        date.setMinutes(0, 0, 0);
        timeKey = Math.floor(date.getTime() / 1000);
      } else if (timeframe === "1d") {
        date.setHours(0, 0, 0, 0);
        timeKey = Math.floor(date.getTime() / 1000);
      } else {
        timeKey = candle.time;
      }

      if (!groupedCandles[timeKey]) {
        groupedCandles[timeKey] = { ...candle, count: 1, time: timeKey };
      } else {
        const group = groupedCandles[timeKey];
        group.high = Math.max(group.high, candle.high);
        group.low = Math.min(group.low, candle.low);
        group.close = candle.close;
        group.count += 1;
      }
    });

    return Object.values(groupedCandles).sort((a, b) => a.time - b.time);
  }, [candles, timeframe]);

  // Chart Initialization and Resizing
  useEffect(() => {
    if (!chartContainerRef.current || aggregatedCandles.length === 0) return;

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    // Define chart options
    const chartOptions: DeepPartial<ChartOptions> = {
        width: chartContainerRef.current.clientWidth,
        height: 360,
        layout: {
            background: { type: ColorType.Solid, color: "#ffffff" },
            textColor: "#333",
        },
        grid: {
            vertLines: { color: "#eee" },
            horzLines: { color: "#eee" },
        },
        timeScale: {
            timeVisible: true,
            secondsVisible: false,
            borderColor: "#D1D4DC",
        },
        rightPriceScale: {
            borderColor: "#D1D4DC",
            scaleMargins: {
                top: 0.1,
                bottom: 0.4,
            },
        },
        leftPriceScale: {
            visible: true,
            borderColor: "#D1D4DC",
            scaleMargins: {
                top: 0.7,
                bottom: 0,
            },
        },
        crosshair: {
            mode: CrosshairMode.Normal,
        },
    };

    chartRef.current = createChart(chartContainerRef.current, chartOptions);
    chartRef.current.subscribeCrosshairMove(crosshairMoveHandler);
    window.addEventListener("resize", handleResize);

    // Cleanup function
    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.unsubscribeCrosshairMove(crosshairMoveHandler);
        chartRef.current.remove();
      }
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      smaSeriesRef.current = null;
    };
  }, [aggregatedCandles.length, crosshairMoveHandler]); 

  // Series Type Switching Effect
  useEffect(() => {
    if (!chartRef.current || aggregatedCandles.length === 0) return;

    // Remove existing main series
    if (seriesRef.current) {
      chartRef.current.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    // Common options for series
    const commonOptions = { priceLineVisible: false };

    // Create series based on chartType
    switch (chartType) {
      case "candlestick": {
        const candleOptions = {
          ...commonOptions,
          upColor: "#22C55E", 
          downColor: "#EF4444",
          borderUpColor: "#22C55E", 
          borderDownColor: "#EF4444",
          wickUpColor: "#22C55E", 
          wickDownColor: "#EF4444",
        };
        
        const series = chartRef.current.addSeries(CandlestickSeries, candleOptions);
        const data = aggregatedCandles.map(c => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close
        }));
        
        series.setData(data);
        seriesRef.current = series;
        break;
      }
      
      case "line": {
        const lineOptions = {
          ...commonOptions, 
          color: "#2962FF", 
          lineWidth: 2 as const,
        };
        
        const series = chartRef.current.addSeries(LineSeries, lineOptions);
        const data = aggregatedCandles.map(c => ({
          time: c.time as UTCTimestamp,
          value: c.close
        }));
        
        series.setData(data);
        seriesRef.current = series;
        break;
      }
      
      case "area": {
        const areaOptions = {
          ...commonOptions, 
          lineColor: "#2962FF",
          topColor: "rgba(41, 98, 255, 0.28)", 
          bottomColor: "rgba(41, 98, 255, 0.05)",
        };
        
        const series = chartRef.current.addSeries(AreaSeries, areaOptions);
        const data = aggregatedCandles.map(c => ({
          time: c.time as UTCTimestamp,
          value: c.close
        }));
        
        series.setData(data);
        seriesRef.current = series;
        break;
      }
      
      case "bar": {
        const barOptions = {
          ...commonOptions, 
          upColor: "#22C55E", 
          downColor: "#EF4444",
        };
        
        const series = chartRef.current.addSeries(BarSeries, barOptions);
        const data = aggregatedCandles.map(c => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close
        }));
        
        series.setData(data);
        seriesRef.current = series;
        break;
      }
    }

    chartRef.current?.timeScale().fitContent();
  }, [chartType, aggregatedCandles]);

  // Volume Series Effect
  useEffect(() => {
    if (!chartRef.current || aggregatedCandles.length === 0) return;

    // Remove existing volume series
    if (volumeSeriesRef.current) {
      chartRef.current.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }

    // Create volume series
    const volumeOptions = {
      color: "#26a69a",
      priceFormat: {
        type: 'volume' as const,
      },
      priceScaleId: '',
      lastValueVisible: false,
      priceLineVisible: false,
    };
    
    volumeSeriesRef.current = chartRef.current.addSeries(HistogramSeries, volumeOptions);

    // Create volume data
    const volumeData = aggregatedCandles.map((c) => ({
      time: c.time as UTCTimestamp,
      value: Math.abs(c.close - c.open) * 100,
      color: c.close >= c.open ? "rgba(38, 166, 154, 0.5)" : "rgba(239, 83, 80, 0.5)",
    }));

    volumeSeriesRef.current.setData(volumeData);
  }, [aggregatedCandles]);

  // SMA Indicator Effect
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current || aggregatedCandles.length === 0) return;

    // Remove existing SMA series
    if (smaSeriesRef.current) {
      chartRef.current.removeSeries(smaSeriesRef.current);
      smaSeriesRef.current = null;
    }

    if (showSMA) {
      // Calculate SMA
      const smaData: (LineData | WhitespaceData)[] = aggregatedCandles
        .map((_, index, array) => {
          if (index < smaPeriod - 1) {
            return { time: array[index].time as UTCTimestamp };
          }
          
          const startIndex = index - smaPeriod + 1;
          const relevantCandles = array.slice(startIndex, index + 1);
          const sum = relevantCandles.reduce((total, candle) => total + candle.close, 0);
          
          return {
            time: array[index].time as UTCTimestamp,
            value: sum / smaPeriod,
          };
        });

      // Create SMA series
      const smaOptions = {
        color: "#2962FF",
        lineWidth: 2 as const,
        lastValueVisible: false,
        priceLineVisible: false,
      };
      
      smaSeriesRef.current = chartRef.current.addSeries(LineSeries, smaOptions);
      smaSeriesRef.current.setData(smaData);
    }
  }, [showSMA, smaPeriod, aggregatedCandles]);

  // Legend Component
  const Legend = () => {
    if (!legendValues.time) return null;

    return (
      <div className={styles.legend}>
        {legendValues.formattedTime && <div>Time: {legendValues.formattedTime}</div>}
        {legendValues.open !== null && <div>O: <span>{legendValues.open.toFixed(4)}</span></div>}
        {legendValues.high !== null && <div>H: <span>{legendValues.high.toFixed(4)}</span></div>}
        {legendValues.low !== null && <div>L: <span>{legendValues.low.toFixed(4)}</span></div>}
        {legendValues.close !== null && <div>C: <span>{legendValues.close.toFixed(4)}</span></div>}
      </div>
    );
  };

  // Render loading/empty states or the chart
  if (isLoading) {
    return <div className={styles.loading}>Loading chart…</div>;
  }
  
  if (candles.length === 0) {
    return <div className={styles.empty}>No price history available.</div>;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.title}>Bonding Curve</div>

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

      <Legend />

      <div ref={chartContainerRef} className={styles.chartContainer} />
    </div>
  );
};

export default CollectionChart;
