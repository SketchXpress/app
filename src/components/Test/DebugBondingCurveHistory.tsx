// components/DebugBondingCurveHistory.tsx
"use client";

import { useEffect } from "react";
import { useBondingCurveHistory } from "@/hooks/useBondingCurveHistory";

export default function DebugBondingCurveHistory() {
  const {
    history,
    isLoading,
    error,
    loadMore,
    canLoadMore,
    clearCache,
  } = useBondingCurveHistory(10);

  useEffect(() => {
    console.group("🔍 useBondingCurveHistory");
    console.log("history:", history);
    console.log("isLoading:", isLoading);
    console.log("error:", error);
    console.log("canLoadMore:", canLoadMore);
    console.log("functions:", { loadMore, clearCache });
    console.groupEnd();
  }, [history, isLoading, error, canLoadMore, loadMore, clearCache]);

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h2>Check your browser console for useBondingCurveHistory output</h2>
      <button onClick={() => loadMore()} disabled={!canLoadMore || isLoading}>
        Load More
      </button>
      <button onClick={() => clearCache()}>Clear Cache</button>
    </div>
  );
}
