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
      console.log("🔄 [usePoolPrices] Fetch triggered...");
      console.log("Pool Addresses:", poolAddresses);
      console.log("Program exists:", !!program);

      if (!poolAddresses.length) {
        console.log("⛔ No pool addresses. Exiting early.");
        return;
      }

      if (!program) {
        console.log("⏳ Program not ready yet. Will retry later...");
        return;
      }

      if (!program.account?.bondingCurvePool?.fetch) {
        console.log("⏳ bondingCurvePool not ready yet. Waiting...");
        return;
      }

      setLoading(true);
      setError(null);
      const newPrices: PoolPrices = {};

      try {
        const poolPromises = poolAddresses
          .filter((address) => {
            const isValid = isValidPublicKeyFormat(address);
            console.log(
              `✅ Validating address: ${address} → Valid? ${isValid}`
            );
            if (!isValid) {
              console.warn(`❗ Invalid address format: ${address}`);
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

              console.log(
                `📡 Fetching bondingCurvePool for address: ${address}`
              );
              const poolData = await program.account.bondingCurvePool.fetch(
                pool
              );
              console.log(`✅ Pool data fetched for ${address}:`, poolData);

              const totalEscrowed = poolData.totalEscrowed as BN;
              const totalEscrowedSOL = totalEscrowed.toNumber() / 1_000_000_000;

              console.log(
                `💰 Total Escrowed SOL for ${address}: ${totalEscrowedSOL}`
              );

              return { address, price: totalEscrowedSOL };
            } catch (err) {
              console.error(`❌ Error fetching pool ${address}:`, err);
              return { address, price: "Price N/A" as const };
            }
          });

        console.log("⏳ Waiting for all pool fetches to complete...");
        const results = await Promise.all(poolPromises);

        results.forEach((result) => {
          console.log(`📌 Setting price for ${result.address}:`, result.price);
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
        console.log("✅ Finished fetching pool prices.");
      }
    };

    fetchPoolPrices();
  }, [program?.provider, poolAddresses]);

  return { prices, loading, error };
};
