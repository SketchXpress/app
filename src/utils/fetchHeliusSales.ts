/* eslint-disable @typescript-eslint/no-explicit-any */
// src/utils/fetchHeliusSales.ts

import { extractSalesFromParsedTxs, SaleEvent } from "./salesHelper";

const HELIUS_RPC = "https://api-devnet.helius.xyz/v0";

export async function fetchHeliusSales(
  pool: string,
  apiKey: string
): Promise<SaleEvent[]> {
  console.log("Fetching Helius sales for pool:", pool);

  // 1) GET the last 100 signatures for your pool
  const sigResp = await fetch(
    `${HELIUS_RPC}/addresses/${pool}/transactions?api-key=${apiKey}&limit=100`
  );
  if (!sigResp.ok) {
    throw new Error(`Signature list error ${sigResp.status}`);
  }
  const sigList: { signature: string }[] = await sigResp.json();
  const signatures = sigList.map((s) => s.signature);
  if (signatures.length === 0) return [];

  // 2) POST them to the Parse Transaction(s) endpoint
  const parseResp = await fetch(
    `${HELIUS_RPC}/transactions/?api-key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions: signatures }),
    }
  );
  if (!parseResp.ok) {
    throw new Error(`Parse error ${parseResp.status}`);
  }
  const parsedTxs: any[] = await parseResp.json();

  // 3) Extract sale prices with validation
  const salesEvents = extractSalesFromParsedTxs(parsedTxs);

  // Add validation layer
  const validatedSales = salesEvents.filter((sale) => {
    // Log all detected sales for debugging
    console.log("Sale detected:", sale);

    // Validate: The price should be reasonable (not dust amounts)
    if (sale.soldSol !== undefined && sale.soldSol < 0.01) {
      console.warn("Filtering out suspiciously small sale price:", sale);
      return false;
    }

    return true;
  });

  console.log(
    `Found ${salesEvents.length} sales, validated ${validatedSales.length}`
  );
  return validatedSales;
}
export type { SaleEvent };
