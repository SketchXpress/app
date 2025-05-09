import { useQuery } from "@tanstack/react-query";
import { PublicKey } from "@solana/web3.js";
import { fetchSellingPrice, SaleEvent } from "../utils/fetchSellingPrice";

export function useBondingCurveSales(
  escrowAddress: string,
  cluster: "devnet" | "mainnet-beta" = "devnet"
) {
  const escrowPubKey = new PublicKey(escrowAddress);

  // Updated to use the object syntax for v5
  return useQuery<SaleEvent[], Error>({
    queryKey: ["bondingCurveSales", escrowAddress, cluster],
    queryFn: () => fetchSellingPrice(escrowPubKey, cluster),
    enabled: Boolean(escrowAddress),
    staleTime: 5 * 60 * 1000,
  });
}
