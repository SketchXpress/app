import { useState, useEffect } from "react";
import { useAnchorContext } from "@/contexts/AnchorContextProvider";
import { BN } from "@coral-xyz/anchor";
import { safePublicKey } from "@/utils/bn-polyfill";
import { PublicKey } from "@solana/web3.js";

// Define the type based on the IDL structure
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

export interface PoolInfo {
  collection: string;
  creator: string;
  basePrice: number;
  growthFactor: number;
  currentSupply: number;
  protocolFeePercent: number;
  totalEscrowed: number;
  isActive: boolean;
  migrationStatus: string;
  migrationProgress: string;
}

export const usePoolInfo = (poolAddress: string | null) => {
  const { program } = useAnchorContext();
  const [info, setInfo] = useState<PoolInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPoolInfo = async () => {
      if (!poolAddress || !program) return;

      try {
        setLoading(true);
        setError(null);

        const poolKey = safePublicKey(poolAddress);
        if (!poolKey) throw new Error("Invalid pool address");

        const poolDataRaw = await program.account.bondingCurvePool.fetch(
          poolKey
        );

        // Cast raw data to BondingCurvePool type
        const poolData = poolDataRaw as unknown as BondingCurvePool;

        const formatLamports = (lamports: BN) =>
          lamports.toNumber() / 1_000_000_000;

        const migrationThreshold = 69_000; // 69,000 SOL
        const totalEscrowedSol = formatLamports(poolData.totalEscrowed);
        const migrationProgress =
          totalEscrowedSol >= migrationThreshold
            ? "Threshold reached! (69k SOL)"
            : `Progress: ${totalEscrowedSol.toFixed(
                9
              )} / ${migrationThreshold} SOL`;

        const migrationStatus = !poolData.isActive
          ? "Migrated (Pool Frozen)"
          : totalEscrowedSol >= migrationThreshold
          ? "Ready for migration (Threshold Met)"
          : "Not eligible for migration yet";

        const poolInfo: PoolInfo = {
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
        };

        setInfo(poolInfo);
      } catch (err) {
        console.error("Error fetching pool info:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchPoolInfo();
  }, [program, poolAddress]);

  return { info, loading, error };
};
