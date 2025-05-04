// components/DebugPoolPrices.tsx
"use client";

import { useEffect, useState } from "react";
import { usePoolPrices } from "@/hooks/usePoolPrices";

export default function DebugPoolPrices() {
  // start with an array of pool addresses
  const [pools] = useState([
    "4rRTpqAJu1S6gUBVaAFusZboYpTRtAy6RikZXkKp3WM4",
    // add more if you like…
  ]);

  const { prices, loading, error } = usePoolPrices(pools);

  useEffect(() => {
    console.group("🔍 usePoolPrices");
    console.log("prices:", prices);
    console.log("loading:", loading);
    console.log("error:", error);
    console.groupEnd();
  }, [prices, loading, error]);

  return (
    <div style={{ padding: 20 }}>
      <h2>Check console for usePoolPrices output</h2>
    </div>
  );
}
