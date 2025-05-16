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
  console.log(`🔄 fetchHeliusSales called:`, {
    poolAddress,
    hasApiKey: !!apiKey,
  });

  if (!poolAddress || !apiKey) {
    console.warn(`❌ Missing poolAddress or apiKey:`, {
      poolAddress,
      hasApiKey: !!apiKey,
    });
    return [];
  }

  try {
    const url = `/api/helius-sales/${poolAddress}?apiKey=${apiKey}`;
    console.log(`📡 Fetching from API:`, url);

    const response = await fetch(url);
    console.log(
      `📡 API Response status:`,
      response.status,
      response.statusText
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`⚠️ API endpoint not found (404) - returning empty array`);
        return [];
      }
      throw new Error(`Failed to fetch sales: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`📡 Raw API response:`, data);

    const sales = data.sales || [];
    console.log(`📡 Parsed sales from API:`, sales.length, sales);

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
  console.log(`🎣 useHeliusSales called:`, {
    poolAddress,
    hasApiKey: !!apiKey,
  });

  // Get store data first
  const { getPoolDetailsWithRealtime } = useCollectionsStore();
  const storeData = getPoolDetailsWithRealtime(poolAddress);
  const { deduplicatedFetch } = useDeduplicateRequests<SaleEvent[]>();

  console.log(`🏪 Store data:`, storeData);
  console.log(`🏪 Store history length:`, storeData?.history?.length || 0);

  // Extract sales from store history
  const storeSales = useMemo(() => {
    console.log(`🔄 Processing store sales...`);

    if (!storeData?.history) {
      console.log(`❌ No store history available`);
      return [];
    }

    console.log(`📊 Store history:`, storeData.history.length, `transactions`);

    const sellTransactions = storeData.history.filter(
      (tx) => tx.instructionName === "sellNft"
    );
    console.log(
      `📊 Found ${sellTransactions.length} sell transactions in store:`,
      sellTransactions
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

    console.log(
      `💰 Processed store sales:`,
      processedSales.length,
      processedSales
    );
    return processedSales;
  }, [storeData?.history]);

  console.log(`💰 Final store sales count:`, storeSales.length);

  // FIX: Ensure enabled is always boolean (not string)
  const shouldFetchFromAPI = Boolean(
    poolAddress && apiKey && storeSales.length === 0
  );

  console.log(`🤔 Should fetch from API:`, shouldFetchFromAPI, {
    hasPoolAddress: !!poolAddress,
    hasApiKey: !!apiKey,
    storeSalesCount: storeSales.length,
  });

  // Conditional API fetch with deduplication
  const {
    data: apiSales,
    isLoading: apiLoading,
    error: apiError,
  } = useQuery<SaleEvent[], Error>({
    queryKey: ["heliusSales", poolAddress],
    queryFn: () => {
      console.log(`🚀 API query function executing...`);
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

  console.log(`📡 API Query state:`, {
    isLoading: apiLoading,
    hasError: !!apiError,
    salesCount: apiSales?.length || 0,
    apiSales,
  });

  if (apiError) {
    console.error(`❌ API Error:`, apiError);
  }

  // Use store data first, fallback to API
  const finalSales = useMemo(() => {
    console.log(`🔄 Computing final sales...`);

    if (storeSales.length > 0) {
      console.log(`✅ Using store sales:`, storeSales.length);
      const sortedStoreSales = storeSales.sort(
        (a, b) => b.blockTime - a.blockTime
      );
      console.log(`📅 Sorted store sales:`, sortedStoreSales);
      return sortedStoreSales;
    }

    // FIX: Ensure apiSales is always an array
    const apiSalesArray = apiSales && Array.isArray(apiSales) ? apiSales : [];
    console.log(`📡 Using API sales:`, apiSalesArray.length, apiSalesArray);

    return apiSalesArray;
  }, [storeSales, apiSales]);

  console.log(`🎯 Final result:`, {
    salesCount: finalSales.length,
    dataSource: storeSales.length > 0 ? "webhook" : "api",
    hasRealtimeData: storeSales.length > 0,
    isLoading: shouldFetchFromAPI ? apiLoading : false,
    finalSales,
  });

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
