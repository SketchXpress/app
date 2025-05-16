import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { IDL as BondingCurveIDL } from "@/utils/idl";
import { BorshInstructionCoder } from "@coral-xyz/anchor";
import { useAnchorContext } from "@/contexts/AnchorContextProvider";
import { PROGRAM_PUBLIC_KEY } from "@/hooks/useBondingCurveHistory/constants";
import { processTransactionFast } from "@/hooks/useBondingCurveHistory/extractors";
import {
  HistoryItem,
  HeliusTransaction,
} from "@/hook/useBondingCurveHistory/types";

export const useTransactionHistory = (limit: number = 50) => {
  const { program } = useAnchorContext();

  // Get the Borsh instruction coder from the program
  const instructionCoder = program?.coder.instruction as
    | BorshInstructionCoder
    | undefined;

  return useQuery({
    queryKey: ["transactionHistory", limit],
    queryFn: async (): Promise<HistoryItem[]> => {
      if (!instructionCoder) {
        throw new Error(
          "Instruction coder not available. Program may not be initialized."
        );
      }

      // Fetch transaction history from Helius API
      const response = await apiClient.heliusApi<HeliusTransaction[]>(
        `/addresses/${PROGRAM_PUBLIC_KEY.toBase58()}/transactions`,
        { limit: limit.toString() }
      );

      if (!Array.isArray(response)) {
        throw new Error("Invalid response format from Helius API");
      }

      // Process each transaction with proper typing and all required arguments
      return response.map((tx: HeliusTransaction) => {
        // Create basic info object required by processTransactionFast
        const basicInfo = {
          timestamp: tx.timestamp || Math.floor(Date.now() / 1000),
        };

        // Process transaction using the full set of required arguments
        return processTransactionFast(
          tx,
          basicInfo,
          instructionCoder,
          PROGRAM_PUBLIC_KEY,
          BondingCurveIDL
        );
      });
    },
    enabled: !!instructionCoder,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};

export default useTransactionHistory;
