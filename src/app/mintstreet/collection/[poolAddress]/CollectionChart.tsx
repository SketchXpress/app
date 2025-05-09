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


type Candle = {
  time: Time;    // Time type from lightweight-charts
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
  const { data: sales } = useHeliusSales(poolAddress, "69b4db73-1ed1-4558-8e85-192e0994e556");

  // Price calculation function matching your smart contract
  function calculateSellPrice(basePrice: number, growthFactor: number, currentSupply: number): number {
    try {
      // Match the logic in calculate_sell_price
      // This is the equivalent of your Rust function
      // Subtract 1 from supply first since we're calculating price AFTER the sell
      const supplyAfterSell = currentSupply - 1;

      // Formula: base_price + (growth_factor * supply)
      // This calculates the price after removing one NFT from supply
      const price = basePrice + (growthFactor * supplyAfterSell);

      // Return price in SOL
      return Math.max(price, basePrice);
    } catch (error) {
      console.error("Error in calculateSellPrice:", error);
      // Return a fallback price (20% less than current price)
      return basePrice * 0.8;
    }
  }

  // Build raw candles from history and sales - focusing on price changes
  const rawCandles = useMemo(() => {
    console.log("Building candles based on mint and sell prices");

    // Extract mint prices and timestamps from history
    const mintEvents = history
      .filter(h => h.blockTime != null && h.instructionName === "mintNft" && h.price != null)
      .map(item => ({
        time: Math.floor(item.blockTime!) as Time,
        price: item.price!,
        type: 'mint' as const,
        signature: item.signature
      }))
      .sort((a, b) => Number(a.time) - Number(b.time));

    // Log the raw sales data for debugging
    console.log("Raw sales data:", sales);

    // Extract sell events from Helius sales data
    // Only include sell events that aren't duplicates of mint events
    const sellEvents = sales && sales.length > 0
      ? sales
        .filter(s => {
          // Check if this sale is a duplicate of a mint event
          const isDuplicateOfMint = mintEvents.some(mint =>
            Math.abs(mint.price - (s.soldSol || 0)) < 0.0001 && // Similar price
            mint.signature === s.signature // Same transaction
          );

          console.log("Checking sell event:", {
            signature: s.signature,
            blockTime: s.blockTime,
            soldSol: s.soldSol,
            isDuplicateOfMint
          });

          // Only include if it's not a duplicate mint and has a valid blockTime
          return s.blockTime != null && !isDuplicateOfMint;
        })
        .map(item => {
          return {
            time: Math.floor(item.blockTime) as Time,
            price: item.soldSol || 0,
            type: 'sell' as const,
            signature: item.signature
          };
        })
        .sort((a, b) => Number(a.time) - Number(b.time))
      : [];

    // Find your actual sell transaction from history
    const sellTransactions = history.filter(tx =>
      tx.instructionName === "sellNft" && tx.blockTime != null
    );

    console.log("Sell transactions from history:", sellTransactions);

    // If we have actual sell transactions, use them instead of Helius data
    if (sellTransactions.length > 0) {
      // Create sell events from actual sell transactions
      const historySellEvents = sellTransactions.map(tx => ({
        time: Math.floor(tx.blockTime!) as Time,
        price: tx.price || 0, // Use 0 as fallback
        type: 'sell' as const,
        signature: tx.signature
      }));

      console.log("Using sell events from transaction history:", historySellEvents);

      // Replace or augment the sell events
      if (historySellEvents.length > 0) {
        // Use history sells instead of Helius data
        sellEvents.push(...historySellEvents);
      }
    }

    console.log("Final mint events:", mintEvents);
    console.log("Final sell events:", sellEvents);

    // Sort mint and sell events chronologically by timestamp
    const allEvents = [...mintEvents, ...sellEvents].sort((a, b) =>
      Number(a.time) - Number(b.time)
    );

    console.log("All events in chronological order:", allEvents);

    // Build candles based on the events
    const candles: Candle[] = [];
    let lastPrice = 0;

    // Process events in order
    allEvents.forEach((event, index) => {
      if (index === 0 && event.type === 'mint') {
        // First mint - create initial candle from 0
        candles.push({
          time: (Number(event.time) - 86400) as Time, // One day before
          open: 0,
          high: event.price,
          low: 0,
          close: event.price
        });
        lastPrice = event.price;
      } else {
        // Subsequent events
        if (event.type === 'mint') {
          // Mint event - price increases
          candles.push({
            time: event.time,
            open: lastPrice,
            high: event.price,
            low: lastPrice,
            close: event.price
          });
          lastPrice = event.price;
          console.log(`Added green candle for mint: time=${new Date(Number(event.time) * 1000).toLocaleString()}, open=${lastPrice}, close=${event.price}`);
        } else if (event.type === 'sell') {
          // Sell event - price decreases

          // Get pool parameters from your bond curve pool
          // These should match your smart contract values
          const basePrice = 0.05; // Example, update with your actual base price
          const growthFactor = 0.02; // Example, update with your actual growth factor

          // Calculate the supply before the sell operation (current supply + 1)
          // If you have 3 mints and are selling 1, the current supply is 3
          const supplyBeforeSell = mintEvents.length;

          // Calculate theoretical sell price using the same algorithm as your smart contract
          const sellPrice = calculateSellPrice(basePrice, growthFactor, supplyBeforeSell);

          console.log(`Calculated sell price using smart contract logic: ${sellPrice} SOL`);
          console.log(`Supply before sell: ${supplyBeforeSell}, basePrice: ${basePrice}, growthFactor: ${growthFactor}`);

          candles.push({
            time: event.time,
            open: lastPrice,
            high: lastPrice,
            low: sellPrice,
            close: sellPrice
          });

          lastPrice = sellPrice;
          console.log(`Added red candle for sell: time=${new Date(Number(event.time) * 1000).toLocaleString()}, open=${lastPrice}, close=${sellPrice}`);
        }
      }
    });

    // Output the final candles
    console.table(candles.map((candle, index) => ({
      index,
      time: new Date(Number(candle.time) * 1000).toLocaleString(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      isGreen: candle.close > candle.open,
      isRed: candle.close < candle.open,
      change: candle.open !== 0 ? ((candle.close - candle.open) / candle.open * 100).toFixed(2) + '%' : 'Infinity%'
    })));

    return candles;
  }, [history, sales]);

  // Aggregate candles based on timeframe
  const candles = useMemo(() => {
    if (timeframe === 'raw' || rawCandles.length === 0) {
      return rawCandles;
    }

    const groupedCandles: Record<number, Candle & { count: number }> = {};

    rawCandles.forEach(candle => {
      const date = new Date(Number(candle.time) * 1000);
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
          time: timeKey as Time,
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
  const seriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null);

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
        borderColor: '#eee',
        rightOffset: 5,  // Add some padding on the right
        barSpacing: 15,  // Set spacing between bars
      },
      rightPriceScale: {
        borderColor: '#eee',
        autoScale: true,  // Enable auto scaling
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true },
    });
    chartRef.current = chart;

    // Immediately create the candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22C55E',       // Green for up candles (mints)
      downColor: '#EF4444',     // Red for down candles (sells)
      borderUpColor: '#22C55E',
      borderDownColor: '#EF4444',
      wickUpColor: '#22C55E',
      wickDownColor: '#EF4444',
      priceLineVisible: false,
    });
    seriesRef.current = candleSeries;

    // Set data if available
    if (candles.length > 0) {
      candleSeries.setData(candles);
      chart.timeScale().fitContent();
    }

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
  }, [container, candles]);

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

    // Configure scale margins
    const priceSeries = seriesRef.current;
    if (priceSeries) {
      priceSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.1,
          bottom: 0.3,
        },
        autoScale: true,  // Enable auto scaling
        entireTextOnly: true,
      });
    }

    // Then apply scale margins separately for volume
    if (volumeSeriesRef.current) {
      chartRef.current.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
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

    // Fit content with some padding and adjust visible range
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [candles, chartType]);

  // Handle SMA indicator
  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;

    if (showSMA) {
      // Calculate SMA
      const smaData = candles.map((_, index, array) => {
        if (index < smaPeriod - 1) return { time: array[index].time, value: null };

        const sum = array
          .slice(index - smaPeriod + 1, index + 1)
          .reduce((total, candle) => total + candle.close, 0);

        return {
          time: array[index].time,
          value: sum / smaPeriod,
        };
      });

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

  // Add a legend for sales
  const SalesLegend = () => {
    return (
      <div className={styles.salesLegend}>
        <div className={styles.legendItem}>
          <div className={styles.mintIndicator}></div>
          <span>Mint</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.sellIndicator}></div>
          <span>Sell</span>
        </div>
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
      <div className={styles.legendContainer}>
        <Legend />
        <SalesLegend />
      </div>

      {/* Chart container */}
      <div
        ref={containerRef}
        className={styles.chartContainer}
      />
    </div>

  );
};

export default CollectionChart;