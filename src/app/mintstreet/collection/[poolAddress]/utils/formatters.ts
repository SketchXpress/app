export function formatAddress(address: string): string {
  if (!address || address.length <= 12) return address;
  return `${address.substring(0, 6)}...${address.substring(
    address.length - 6
  )}`;
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatSOL(amount: number, decimals: number = 4): string {
  return `${amount.toFixed(decimals)} SOL`;
}

export function formatProtocolFee(feePercent: number): string {
  return `${(feePercent / 100).toFixed(2)}%`;
}

export function formatMigrationProgress(
  totalEscrowed: number,
  threshold: number = 690
): string {
  if (totalEscrowed >= threshold) {
    return `Threshold reached! (${threshold} SOL)`;
  }
  const progress = Math.min((totalEscrowed / threshold) * 100, 100);
  return `Progress: ${totalEscrowed.toFixed(
    4
  )} / ${threshold} SOL (${progress.toFixed(1)}%)`;
}
