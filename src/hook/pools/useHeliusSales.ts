import { useQuery } from "@tanstack/react-query";
import { fetchHeliusSales, SaleEvent } from "@/utils/fetchHeliusSales";

export function useHeliusSales(poolAddress: string, apiKey: string) {
  return useQuery<SaleEvent[], Error>({
    queryKey: ["heliusSales", poolAddress],
    queryFn: () => fetchHeliusSales(poolAddress, apiKey),
    enabled: Boolean(poolAddress && apiKey),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
export type { SaleEvent };
