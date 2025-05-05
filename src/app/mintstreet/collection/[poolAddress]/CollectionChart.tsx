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
  HistogramSeries,
  CrosshairMode,
  ColorType,
  Time,
} from "lightweight-charts";
import styles from "./CollectionChart.module.scss";
import { useBondingCurveForPool } from "@/hooks/useBondingCurveForPool";

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
  const [chartType, setChartType] = useState<'candlestick' | 'line' | 'area'>('candlestick');
  const [showSMA, setShowSMA] = useState(false);
  const [smaPeriod, setSmaPeriod] = useState(20);
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

  // Build candles from history
  const candles: Candle[] = useMemo(() => {
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
    }

    // Add volume series
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
      // Candlestick chart uses OHLC data
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
      
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          <button 
            className={chartType === 'candlestick' ? styles.active : ''}
            onClick={() => setChartType('candlestick')}
          >
            Candles
          </button>
          <button 
            className={chartType === 'line' ? styles.active : ''}
            onClick={() => setChartType('line')}
          >
            Line
          </button>
          <button 
            className={chartType === 'area' ? styles.active : ''}
            onClick={() => setChartType('area')}
          >
            Area
          </button>
        </div>
        
        <div className={styles.toolGroup}>
          <button 
            className={showSMA ? styles.active : ''}
            onClick={() => setShowSMA(!showSMA)}
          >
            SMA
          </button>
          <select 
            value={smaPeriod}
            onChange={(e) => setSmaPeriod(Number(e.target.value))}
            disabled={!showSMA}
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </div>
        
        <div className={styles.toolGroup}>
          <button onClick={() => chartRef.current?.timeScale().fitContent()}>
            Reset Zoom
          </button>
        </div>
      </div>
      
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
