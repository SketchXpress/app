import { useState, useEffect } from "react";
import { useAnchorContext } from "@/contexts/AnchorContextProvider";
import { BN } from "@coral-xyz/anchor";
import { safePublicKey, isValidPublicKeyFormat } from "@/utils/bn-polyfill";

type PoolPrices = Record<string, number | "Price N/A" | "Invalid address">;

export const usePoolPrices = (poolAddresses: string[]) => {
  const { program } = useAnchorContext();
  const [prices, setPrices] = useState<PoolPrices>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPoolPrices = async () => {
      if (!poolAddresses.length) {
        return;
      }

      if (!program) {
        return;
      }

      if (!program.account?.bondingCurvePool?.fetch) {
        return;
      }

      setLoading(true);
      setError(null);
      const newPrices: PoolPrices = {};

      try {
        const poolPromises = poolAddresses
          .filter((address) => {
            const isValid = isValidPublicKeyFormat(address);

            if (!isValid) {
              newPrices[address] = "Invalid address";
            }
            return isValid;
          })
          .map(async (address) => {
            try {
              const pool = safePublicKey(address);
              if (!pool) {
                console.warn(`❗ PublicKey generation failed for: ${address}`);
                return { address, price: "Invalid address" as const };
              }

              const poolData = await program.account.bondingCurvePool.fetch(
                pool
              );

              const totalEscrowed = poolData.totalEscrowed as BN;
              const totalEscrowedSOL = totalEscrowed.toNumber() / 1_000_000_000;

              return { address, price: totalEscrowedSOL };
            } catch (err) {
              console.error(`❌ Error fetching pool ${address}:`, err);
              return { address, price: "Price N/A" as const };
            }
          });

        const results = await Promise.all(poolPromises);

        results.forEach((result) => {
          newPrices[result.address] = result.price;
        });

        setPrices((prev) => ({ ...prev, ...newPrices }));
      } catch (err) {
        console.error("🔥 Fatal error in fetchPoolPrices:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unknown error fetching pool prices"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchPoolPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program?.provider, poolAddresses]);

  return { prices, loading, error };
};
