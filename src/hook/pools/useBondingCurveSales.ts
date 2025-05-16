// src/hook/pools/useBondingCurveSales.ts - Enhanced with comprehensive debugging
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCollectionsStore } from "@/stores/collectionsStore";
import { useDeduplicateRequests } from "@/hook/shared/utils/useDeduplicateRequests";

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
 */
async function fetchHeliusSales(
  poolAddress: string,
  apiKey: string
): Promise<SaleEvent[]> {
  if (!poolAddress || !apiKey) {
    console.warn(`❌ Missing poolAddress or apiKey:`, {
      poolAddress,
      hasApiKey: !!apiKey,
    });
    return [];
  }

  try {
    const url = `/api/helius-sales/${poolAddress}?apiKey=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`⚠️ API endpoint not found (404) - returning empty array`);
        return [];
      }
      throw new Error(`Failed to fetch sales: ${response.statusText}`);
    }

    const data = await response.json();

    const sales = data.sales || [];

    return sales;
  } catch (error) {
    console.error("❌ Error fetching Helius sales:", error);
    return [];
  }
}

/**
 * Hook to get sales data for a pool
 * OPTIMIZED: Uses store data first, falls back to Helius API only when needed
 */
export function useHeliusSales(poolAddress: string, apiKey: string) {
  // Get store data first
  const { getPoolDetailsWithRealtime } = useCollectionsStore();
  const storeData = getPoolDetailsWithRealtime(poolAddress);
  const { deduplicatedFetch } = useDeduplicateRequests<SaleEvent[]>();

  // Extract sales from store history
  const storeSales = useMemo(() => {
    if (!storeData?.history) {
      return [];
    }

    const sellTransactions = storeData.history.filter(
      (tx) => tx.instructionName === "sellNft"
    );

    const processedSales = sellTransactions
      .map((tx) => ({
        signature: tx.signature,
        blockTime: tx.blockTime || 0,
        soldSol: tx.price || 0,
        buyer: tx.accounts?.[0]?.toString(),
        seller: tx.accounts?.[1]?.toString(),
        nftMint: tx.accounts?.[2]?.toString(),
      }))
      .filter((sale) => sale.blockTime > 0); // Only include valid sales

    return processedSales;
  }, [storeData?.history]);

  // FIX: Ensure enabled is always boolean (not string)
  const shouldFetchFromAPI = Boolean(
    poolAddress && apiKey && storeSales.length === 0
  );

  // Conditional API fetch with deduplication
  const {
    data: apiSales,
    isLoading: apiLoading,
    error: apiError,
  } = useQuery<SaleEvent[], Error>({
    queryKey: ["heliusSales", poolAddress],
    queryFn: () => {
      return deduplicatedFetch(
        `helius-sales-${poolAddress}`,
        () => fetchHeliusSales(poolAddress, apiKey),
        60000 // 1 minute deduplication window
      );
    },
    enabled: shouldFetchFromAPI, // Now guaranteed to be boolean
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
    retryDelay: (attemptIndex) =>
      Math.min(1000 * Math.pow(2, attemptIndex), 30000),
  });

  if (apiError) {
    console.error(`❌ API Error:`, apiError);
  }

  // Use store data first, fallback to API
  const finalSales = useMemo(() => {
    if (storeSales.length > 0) {
      const sortedStoreSales = storeSales.sort(
        (a, b) => b.blockTime - a.blockTime
      );
      return sortedStoreSales;
    }

    // FIX: Ensure apiSales is always an array
    const apiSalesArray = apiSales && Array.isArray(apiSales) ? apiSales : [];

    return apiSalesArray;
  }, [storeSales, apiSales]);

  // Return with additional metadata about data source
  return {
    data: finalSales,
    isLoading: shouldFetchFromAPI ? apiLoading : false,
    error: shouldFetchFromAPI ? apiError : null,
    dataSource: storeSales.length > 0 ? "webhook" : "api",
    salesCount: finalSales.length,
    hasRealtimeData: storeSales.length > 0,
    // Debug information
    debug: {
      storeData: !!storeData,
      storeHistoryLength: storeData?.history?.length || 0,
      storeSalesCount: storeSales.length,
      apiSalesCount: apiSales?.length || 0,
      shouldFetchFromAPI,
      isLoading: apiLoading,
      hasError: !!apiError,
      errorMessage: apiError?.message,
    },
  };
}

export { fetchHeliusSales };
