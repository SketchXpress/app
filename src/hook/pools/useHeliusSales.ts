// src/hook/pools/useHeliusSales.ts
import { useQuery } from "@tanstack/react-query";

export interface SaleEvent {
  signature: string;
  blockTime: number;
  soldSol: number;
  buyer?: string;
  seller?: string;
  nftMint?: string;
}

/**
 * Fetch sales data from Helius API for a specific pool
 * @param poolAddress - The pool address to fetch sales for
 * @param apiKey - Helius API key
 */
async function fetchHeliusSales(
  poolAddress: string,
  apiKey: string
): Promise<SaleEvent[]> {
  if (!poolAddress || !apiKey) {
    return [];
  }

  try {
    // This is a placeholder implementation
    // You would need to implement the actual Helius sales API call
    // based on your backend/API setup
    const response = await fetch(
      `/api/helius-sales/${poolAddress}?apiKey=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch sales: ${response.statusText}`);
    }

    const data = await response.json();
    return data.sales || [];
  } catch (error) {
    console.error("Error fetching Helius sales:", error);
    return [];
  }
}

export function useHeliusSales(poolAddress: string, apiKey: string) {
  return useQuery<SaleEvent[], Error>({
    queryKey: ["heliusSales", poolAddress],
    queryFn: () => fetchHeliusSales(poolAddress, apiKey),
    enabled: Boolean(poolAddress && apiKey),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
    retryDelay: (attemptIndex) =>
      Math.min(1000 * Math.pow(2, attemptIndex), 30000),
  });
}
