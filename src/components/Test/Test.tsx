"use client";

import React, { useState } from "react";
import { usePoolInfo } from "@/hooks/usePoolInfo";

const TestPoolInfo = () => {
  const [address, setAddress] = useState("9CPXf3aVeyN1yJu8hahQeQXbuydtnnSgy4eEd1UZA8PH");

  const { info, loading, error } = usePoolInfo(address);

  const [newAddress, setNewAddress] = useState("");

  const changeAddress = () => {
    if (newAddress.trim()) {
      setAddress(newAddress.trim());
      setNewAddress("");
    }
  };

  return (
    <div style={{ padding: "20px", color: "black" }}>
      <h2>📊 Pool Info Tester</h2>

      <input
        type="text"
        placeholder="Enter Pool Address"
        value={newAddress}
        onChange={(e) => setNewAddress(e.target.value)}
        style={{ width: "400px", padding: "8px", marginRight: "10px" }}
      />
      <button onClick={changeAddress} style={{ padding: "8px 12px" }}>
        Fetch Info
      </button>

      <hr style={{ margin: "20px 0" }} />

      {loading && <p>Loading pool info...</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {!loading && !error && info && (
        <div>
          <p><strong>Collection Mint:</strong> {info.collection}</p>
          <p><strong>Creator:</strong> {info.creator}</p>
          <p><strong>Base Price (SOL):</strong> {info.basePrice}</p>
          <p><strong>Growth Factor:</strong> {info.growthFactor}</p>
          <p><strong>Current NFT Supply:</strong> {info.currentSupply}</p>
          <p><strong>Protocol Fee (%):</strong> {info.protocolFeePercent}%</p>
          <p><strong>Total SOL Escrowed:</strong> {info.totalEscrowed} SOL</p>
          <p><strong>Pool Active:</strong> {info.isActive ? "Yes" : "No"}</p>
          <p><strong>Tensor Migration Status:</strong> {info.migrationStatus}</p>
          <p><strong>Migration Threshold Progress:</strong> {info.migrationProgress}</p>
        </div>
      )}
    </div>
  );
};

export default TestPoolInfo;
