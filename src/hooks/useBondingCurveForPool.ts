import { useMemo } from "react";
import { useBondingCurveHistory } from "./useBondingCurveHistory";

export function useBondingCurveForPool(poolAddress: string | undefined) {
  const { history, isLoading, ...rest } = useBondingCurveHistory();

  const filteredHistory = useMemo(() => {
    if (!poolAddress) return [];
    return history.filter((item) => item.poolAddress === poolAddress);
  }, [history, poolAddress]);

  return {
    history: filteredHistory,
    isLoading,
    ...rest,
  };
}
