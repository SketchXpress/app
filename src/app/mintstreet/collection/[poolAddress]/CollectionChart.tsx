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
  CandlestickSeriesOptions,
  CrosshairMode,
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

const CollectionChart: React.FC<CollectionChartProps> = ({ poolAddress }) => {
  // 1) callback ref so we only run createChart once the DIV exists
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainer(node);
  }, []);

  // 2) fetch on‑chain history
  const { history, isLoading } = useBondingCurveForPool(poolAddress);

  // 3) build simple candles array (time in seconds)
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

  // 4) refs for chart & series
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // 5) mount: create the chart & empty series once the container DIV is set
  useEffect(() => {
    if (!container) return;

    // createChart returns a non‑generic IChartApi
    const chart = createChart(container, {
      autoSize: true,
      layout: { background: { color: "#fff" }, textColor: "#333" },
      grid: { vertLines: { color: "#eee" }, horzLines: { color: "#eee" } },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { timeVisible: true, secondsVisible: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true },
    });
    chartRef.current = chart;

    const series = chart.addSeries(
      CandlestickSeries,
      {
        upColor: "#22C55E",
        downColor: "#EF4444",
        borderUpColor: "#22C55E",
        borderDownColor: "#EF4444",
        wickUpColor: "#22C55E",
        wickDownColor: "#EF4444",
        priceLineVisible: false,
      } as CandlestickSeriesOptions
    );
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [container]);

  // 6) when our candles array updates, push the data into the series
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;

    // build plain UNIX‑second data
    const data = candles.map((c) => ({
      time: c.time,      // number of seconds since epoch
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    // @ts-expect-error the TS defs expect `time: string` but runtime accepts numbers
    seriesRef.current.setData(data);

    chartRef.current?.timeScale().fitContent();
  }, [candles]);



  // 7) responsive: resize the chart on window resize
  useEffect(() => {
    const onResize = () => {
      if (chartRef.current && container) {
        chartRef.current.resize(container.clientWidth, container.clientHeight, true);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [container]);

  if (isLoading) {
    return <div className={styles.loading}>Loading chart…</div>;
  }
  if (candles.length === 0) {
    return <div className={styles.empty}>No price history available.</div>;
  }

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.title}>Bonding Curve</h3>

      {/* Reset Zoom */}
      <button
        onClick={() => chartRef.current?.timeScale().resetTimeScale()}
        className={styles.resetButton}
      >
        Reset Zoom
      </button>

      {/* chart container */}
      <div
        ref={containerRef}
        className={styles.chartContainer}
      />
    </div>
  );
};

export default CollectionChart;