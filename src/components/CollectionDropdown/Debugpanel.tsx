/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/CollectionDropdown/DebugPanel.tsx
import React from "react";

interface DebugPanelProps {
  history: any[];
  isLoading: boolean;
  error: any;
  pools: any[];
  collections: any[];
  connectionState: string;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  history,
  isLoading,
  error,
  pools,
  collections,
  connectionState,
}) => {
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "10px",
        right: "10px",
        background: "#000",
        color: "#0f0",
        padding: "10px",
        borderRadius: "5px",
        fontSize: "12px",
        zIndex: 9999,
        maxWidth: "300px",
      }}
    >
      <div>
        <strong>Debug Panel</strong>
      </div>
      <div>SSE: {connectionState}</div>
      <div>Loading: {isLoading ? "Yes" : "No"}</div>
      <div>Error: {error ? error.message : "None"}</div>
      <div>History: {history?.length || 0} transactions</div>
      <div>Collections: {collections.length}</div>
      <div>Pools: {pools.length}</div>
      {history && history.length > 0 && (
        <div>
          <div>
            <strong>Recent transactions:</strong>
          </div>
          {history.slice(0, 3).map((tx, i) => (
            <div key={i} style={{ fontSize: "11px", marginLeft: "10px" }}>
              {tx.instructionName || "Unknown"} - {tx.signature?.slice(0, 8)}...
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
