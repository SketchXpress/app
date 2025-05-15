// src/providers/CollectionsProvider.tsx - Ensure real-time data initialization
"use client";

import React, { useEffect } from "react";
import { useRealTimeCollections } from "@/hook/api/realtime/useRealTimeCollections";

interface CollectionsProviderProps {
  children: React.ReactNode;
}

/**
 * This provider initializes the real-time collections system
 * It must wrap any components that use trending collections or dropdown
 */
export const CollectionsProvider: React.FC<CollectionsProviderProps> = ({
  children,
}) => {
  // Initialize the real-time collections system
  const realTimeData = useRealTimeCollections({
    enableSSE: true,
    fallbackPolling: true,
    newItemExpiry: 5 * 60 * 1000, // 5 minutes
    useMockData: false,
  });

  // Log initialization status for debugging
  useEffect(() => {
    console.log("🔄 CollectionsProvider Status:", {
      collections: realTimeData.collections.length,
      pools: realTimeData.pools.length,
      connectionState: realTimeData.connectionState,
      isLoading: realTimeData.isLoading,
      error: realTimeData.error,
    });
  }, [realTimeData]);

  // Don't render children until basic connection is established
  // This prevents empty state flashing
  if (
    realTimeData.connectionState === "connecting" &&
    realTimeData.collections.length === 0 &&
    realTimeData.pools.length === 0
  ) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100px",
          color: "#666",
        }}
      >
        Connecting to real-time data...
      </div>
    );
  }

  return <>{children}</>;
};
