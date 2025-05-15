import { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCollectionsStore } from "@/stores/collectionsStore";
import { useAnchorContext } from "@/contexts/AnchorContextProvider";
import { fetchAllPoolData } from "@/lib/poolDetails";
import type { PoolDetailsWithRealtime } from "@/stores/collectionsStore";

export interface UsePoolDetailsResult {
  poolInfo:
    | (PoolDetailsWithRealtime["info"] & {
        hasRealtimeData: boolean;
        connectionState: string;
        dataSource: "api" | "store" | "hybrid";
      })
    | null;
  nfts: PoolDetailsWithRealtime["nfts"];
  history: PoolDetailsWithRealtime["history"];
  metrics: PoolDetailsWithRealtime["metrics"];
  isLoading: boolean;
  error: string | null;
  hasRealtimeData: boolean;
  connectionState: string;
  lastUpdate: number;
  refetch: () => void;
}

export function usePoolDetails(poolAddress: string): UsePoolDetailsResult {
  console.log(`🔍 usePoolDetails (hybrid) for pool: ${poolAddress}`);

  const { program } = useAnchorContext();

  // Get everything from store
  const {
    getPoolDetailsWithRealtime,
    getPoolByAddress,
    getCollectionByMint,
    poolMetrics,
    connectionState,
    lastUpdate,
    isLoading: storeLoading,
    error: storeError,
    setPoolDetails,
    updatePoolInfo,
  } = useCollectionsStore();

  // Get current store data
  const storeData = getPoolDetailsWithRealtime(poolAddress);
  const pool = getPoolByAddress(poolAddress);
  const collection = pool ? getCollectionByMint(pool.collectionMint) : null;
  const metrics = poolMetrics.get(poolAddress) || null;

  console.log(`📊 Store data for pool ${poolAddress}:`);
  console.table({
    "Has Store Data": !!storeData,
    "Has Pool Info": !!storeData?.info,
    "Has Pool Object": !!pool,
    "Has Collection": !!collection,
    "Collection Name (from collection)":
      collection?.collectionName || "Not found",
    "Collection Name (from pool)": pool?.collectionName || "Not found",
    "NFT Count": storeData?.nfts.length || 0,
    "History Count": storeData?.history.length || 0,
    "Has Metrics": !!metrics,
    "Connection State": connectionState,
  });

  // Fetch pool details from API if not in store
  const shouldFetch = !storeData?.info && !!program;

  console.log(`🤔 Should fetch from API: ${shouldFetch}`, {
    hasStoreInfo: !!storeData?.info,
    hasProgram: !!program,
  });

  const {
    data: apiData,
    isLoading: apiLoading,
    error: apiError,
    refetch,
  } = useQuery({
    queryKey: ["poolDetails", poolAddress],
    queryFn: async () => {
      console.log(`🚀 Fetching pool data from API for ${poolAddress}`);
      // Use empty array for history since webhook will provide real-time updates
      return fetchAllPoolData(poolAddress, program, []);
    },
    enabled: shouldFetch,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    retry: 2,
  });

  // Store API data when it arrives
  useEffect(() => {
    if (apiData && poolAddress) {
      console.log(`💾 Storing API data for pool ${poolAddress}`);

      setPoolDetails(poolAddress, {
        info: apiData.info,
        nfts: apiData.nfts || [], // Use NFTs from API if available
        history: apiData.history || [], // Use history from API if available
        lastUpdated: Date.now(),
        isLoading: false,
      });

      // Also update individual collections
      updatePoolInfo(poolAddress, apiData.info);
    }
  }, [apiData, poolAddress, setPoolDetails, updatePoolInfo]);

  // Create enhanced pool info
  const enhancedPoolInfo = useMemo(() => {
    // Use store data first, fallback to API data
    const info = storeData?.info || apiData?.info;
    if (!info) return null;

    // Get collection name from store objects (webhook data)
    const collectionName =
      collection?.collectionName ||
      pool?.collectionName ||
      info.collectionName ||
      `Collection ${info.collection.slice(0, 6)}...`;

    // Determine data source
    let dataSource: "api" | "store" | "hybrid" = "store";
    if (!storeData?.info && apiData?.info) dataSource = "api";
    if (storeData?.info && metrics) dataSource = "hybrid";

    return {
      ...info,
      collectionName,
      // Add real-time metrics if available (from webhook)
      ...(metrics && {
        volume24h: metrics.volume24h,
        transactions24h: metrics.transactions24h,
        uniqueTraders24h: metrics.uniqueTraders24h,
        priceChange24h: metrics.priceChange24h,
        lastPrice: metrics.lastPrice,
      }),
      hasRealtimeData: !!metrics,
      connectionState,
      dataSource,
    };
  }, [
    storeData?.info,
    apiData?.info,
    collection,
    pool,
    metrics,
    connectionState,
  ]);

  // Get NFTs and history - prioritize webhook data from store, then API, then empty
  const nfts = storeData?.nfts && storeData.nfts.length > 0 ? storeData.nfts : apiData?.nfts || [];
  const history = storeData?.history && storeData.history.length > 0 ? storeData.history : apiData?.history || [];

  // Calculate loading state
  const isLoading = (!storeData?.info && apiLoading) || storeLoading;

  // Calculate error state
  const error = storeError || apiError?.message || null;

  console.log(`📋 Final result for ${poolAddress}:`);
  console.table({
    "Has Pool Info": !!enhancedPoolInfo,
    "Collection Name": enhancedPoolInfo?.collectionName || "Not set",
    "NFT Count": nfts.length,
    "History Count": history.length,
    "Data Source": enhancedPoolInfo?.dataSource || "none",
    "Is Loading": isLoading,
    Error: error || "None",
    "Has Real-time Data": !!metrics,
  });

  return {
    poolInfo: enhancedPoolInfo,
    nfts,
    history,
    metrics,
    isLoading,
    error,
    hasRealtimeData: !!metrics,
    connectionState,
    lastUpdate: storeData?.lastUpdate || lastUpdate,
    refetch,
  };
}

