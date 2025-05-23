"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";

import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";
import { safePublicKey } from "@/utils/bn-polyfill";
import { PoolInfo, UsePoolInfoConfig } from "@/types/pool";
import { useAnchorContext } from "@/contexts/AnchorContextProvider";
import { useGlobalCache } from "@/hook/shared/state/useGlobalCache";

interface BondingCurvePool {
  collection: PublicKey;
  basePrice: BN;
  growthFactor: BN;
  currentSupply: BN;
  protocolFee: BN;
  creator: PublicKey;
  totalEscrowed: BN;
  isActive: boolean;
  totalDistributed: BN;
  totalSupply: BN;
  currentMarketCap: BN;
  authority: PublicKey;
  tensorMigrationTimestamp: BN;
  isMigratedToTensor: boolean;
  isPastThreshold: boolean;
  bump: number;
}

// Pool info fetching function
const fetchPoolInfo = async (
  poolAddress: string,
  program: any
): Promise<PoolInfo> => {
  const poolKey = safePublicKey(poolAddress);
  if (!poolKey) throw new Error("Invalid pool address");

  const poolDataRaw = await program.account.bondingCurvePool.fetch(poolKey);
  const poolData = poolDataRaw as unknown as BondingCurvePool;

  const formatLamports = (lamports: BN) => lamports.toNumber() / 1_000_000_000;

  const migrationThreshold = 69_000; // 69,000 SOL
  const totalEscrowedSol = formatLamports(poolData.totalEscrowed);
  const migrationProgress =
    totalEscrowedSol >= migrationThreshold
      ? "Threshold reached! (69k SOL)"
      : `Progress: ${totalEscrowedSol.toFixed(9)} / ${migrationThreshold} SOL`;

  const migrationStatus = !poolData.isActive
    ? "Migrated (Pool Frozen)"
    : totalEscrowedSol >= migrationThreshold
    ? "Ready for migration (Threshold Met)"
    : "Not eligible for migration yet";

  return {
    collection: poolData.collection.toString(),
    creator: poolData.creator.toString(),
    basePrice: formatLamports(poolData.basePrice),
    growthFactor: poolData.growthFactor.toNumber() / 1_000_000,
    currentSupply: poolData.currentSupply.toNumber(),
    protocolFeePercent: poolData.protocolFee.toNumber() / 100,
    totalEscrowed: totalEscrowedSol,
    isActive: poolData.isActive,
    migrationStatus,
    migrationProgress,
    collectionName: poolData.collection.toString(),
  };
};

// Main Hook
export function usePoolInfo(
  poolAddress: string | null,
  config: UsePoolInfoConfig = {}
) {
  const {
    enabled = true,
    staleTime = 30 * 1000,
    gcTime = 5 * 60 * 1000,
    refetchOnWindowFocus = false,
  } = config;

  const { program } = useAnchorContext();
  const cache = useGlobalCache();

  return useQuery({
    queryKey: ["poolInfo", poolAddress],
    queryFn: () => {
      if (!poolAddress || !program) {
        throw new Error("Pool address or program not available");
      }

      // Check cache first
      const cached = cache.get(`pool-info-${poolAddress}`);
      if (cached) return cached;

      return fetchPoolInfo(poolAddress, program).then((info) => {
        cache.set(`pool-info-${poolAddress}`, info, staleTime);
        return info;
      });
    },
    enabled: enabled && !!poolAddress && !!program,
    staleTime,
    gcTime,
    refetchOnWindowFocus,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

// Export for backward compatibility
export const usePoolInfo_OLD = (poolAddress: string | null) => {
  const { program } = useAnchorContext();
  const [info, setInfo] = useState<PoolInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInfo = async () => {
      if (!poolAddress || !program) return;

      try {
        setLoading(true);
        setError(null);
        const poolInfo = await fetchPoolInfo(poolAddress, program);
        setInfo(poolInfo);
      } catch (err) {
        console.error("Error fetching pool info:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, [program, poolAddress]);

  return { info, loading, error };
};
