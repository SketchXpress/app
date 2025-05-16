import { useQuery } from "@tanstack/react-query";
import { useAnchorContext } from "@/contexts/AnchorContextProvider";
import { isValidPublicKeyFormat, safePublicKey } from "@/utils/bn-polyfill";
import { PublicKey } from "@solana/web3.js";

export const usePoolPrices = (poolAddresses: string[]) => {
  const { program } = useAnchorContext();

  return useQuery({
    queryKey: ["poolPrices", poolAddresses.sort().join(",")],
    queryFn: async () => {
      if (!poolAddresses.length || !program) {
        return {};
      }

      // Filtering valid addresses
      const validPools = poolAddresses
        .filter(isValidPublicKeyFormat)
        .map((address) => safePublicKey(address))
        .filter((key): key is PublicKey => key !== null);

      if (!validPools.length) {
        return {};
      }

      try {
        // Fetch multiple accounts in a batch
        const poolData = await program.account.bondingCurvePool.fetchMultiple(
          validPools
        );

        // Process results
        const prices: { [key: string]: number } = {};
        poolData.forEach((data, index) => {
          if (data && "totalEscrowed" in data) {
            const address = validPools[index].toString();
            const totalEscrowed = data.totalEscrowed as {
              toNumber: () => number;
            };
            const totalEscrowedSOL = totalEscrowed.toNumber() / 1_000_000_000;
            prices[address] = totalEscrowedSOL;
          }
        });

        return prices;
      } catch (error) {
        console.error("Error fetching pool prices:", error);
        throw error;
      }
    },
    enabled: !!program && poolAddresses.length > 0,
    staleTime: 60 * 1000,
  });
};
