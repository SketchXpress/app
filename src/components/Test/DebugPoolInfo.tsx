// components/DebugPoolInfo.tsx
"use client";

import { useEffect } from "react";
import { usePoolInfo } from "@/hooks/usePoolInfo";

export default function DebugPoolInfo() {
  // pass in a sample pool address or list
  const samplePool = "4rRTpqAJu1S6gUBVaAFusZboYpTRtAy6RikZXkKp3WM4";
  const { info, loading, error } = usePoolInfo(samplePool);

  useEffect(() => {
    console.group("🔍 usePoolInfo");
    console.log("info:", info);
    console.log("loading:", loading);
    console.log("error:", error);
    console.groupEnd();
  }, [info, loading, error]);

  return (
    <div style={{ padding: 20 }}>
      <h2>Check console for usePoolInfo output</h2>
    </div>
  );
}
