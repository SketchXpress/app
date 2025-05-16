interface VolumeTransaction {
  poolAddress: string;
  type: "mint" | "sell";
  amount: number; // SOL amount
  trader: string;
  timestamp: number;
  signature: string;
}

interface PoolMetrics {
  volume24h: number;
  transactions24h: number;
  uniqueTraders24h: number;
  priceChange24h: number;
  lastPrice: number;
}

class VolumeCache {
  private transactions: Map<string, VolumeTransaction[]> = new Map();
  private priceHistory: Map<
    string,
    Array<{ price: number; timestamp: number }>
  > = new Map();

  addTransaction(data: {
    poolAddress: string;
    type: "mint" | "sell";
    amount: number;
    trader: string;
    timestamp: number;
    signature: string;
  }) {
    // Add to transactions
    if (!this.transactions.has(data.poolAddress)) {
      this.transactions.set(data.poolAddress, []);
    }

    const poolTransactions = this.transactions.get(data.poolAddress)!;
    poolTransactions.push(data);

    // Keep only last 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.transactions.set(
      data.poolAddress,
      poolTransactions.filter((tx) => tx.timestamp * 1000 > oneDayAgo)
    );

    // Track price history for mint transactions
    if (data.type === "mint" && data.amount > 0) {
      if (!this.priceHistory.has(data.poolAddress)) {
        this.priceHistory.set(data.poolAddress, []);
      }

      const history = this.priceHistory.get(data.poolAddress)!;
      history.push({
        price: data.amount,
        timestamp: data.timestamp,
      });

      // Keep only last 24 hours of prices
      this.priceHistory.set(
        data.poolAddress,
        history.filter((item) => item.timestamp * 1000 > oneDayAgo)
      );
    }
  }

  getPoolMetrics(poolAddress: string): PoolMetrics {
    const transactions = this.transactions.get(poolAddress) || [];
    const priceHistory = this.priceHistory.get(poolAddress) || [];

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recent = transactions.filter((tx) => tx.timestamp * 1000 > oneDayAgo);

    // Calculate volume (sum of all transaction amounts)
    const volume24h = recent.reduce((sum, tx) => sum + tx.amount, 0);

    // Count transactions
    const transactions24h = recent.length;

    // Count unique traders
    const uniqueTraders24h = new Set(recent.map((tx) => tx.trader)).size;

    // Calculate price change
    let priceChange24h = 0;
    let lastPrice = 0;

    if (priceHistory.length > 0) {
      const sortedPrices = priceHistory.sort(
        (a, b) => a.timestamp - b.timestamp
      );
      lastPrice = sortedPrices[sortedPrices.length - 1]?.price || 0;

      const oldPrices = sortedPrices.filter(
        (p) => p.timestamp * 1000 < oneDayAgo
      );
      const startPrice =
        oldPrices.length > 0
          ? oldPrices[oldPrices.length - 1].price
          : lastPrice;

      if (startPrice > 0) {
        priceChange24h = ((lastPrice - startPrice) / startPrice) * 100;
      }
    }

    return {
      volume24h,
      transactions24h,
      uniqueTraders24h,
      priceChange24h,
      lastPrice,
    };
  }

  getAllPoolMetrics(): Map<string, PoolMetrics> {
    const allMetrics = new Map<string, PoolMetrics>();

    // Get metrics for all pools with transactions
    for (const poolAddress of this.transactions.keys()) {
      allMetrics.set(poolAddress, this.getPoolMetrics(poolAddress));
    }

    return allMetrics;
  }

  // Optional: Clear old data periodically
  cleanup() {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Clean transactions
    for (const [poolAddress, transactions] of this.transactions.entries()) {
      const filtered = transactions.filter(
        (tx) => tx.timestamp * 1000 > oneDayAgo
      );
      if (filtered.length === 0) {
        this.transactions.delete(poolAddress);
      } else {
        this.transactions.set(poolAddress, filtered);
      }
    }

    // Clean price history
    for (const [poolAddress, history] of this.priceHistory.entries()) {
      const filtered = history.filter(
        (item) => item.timestamp * 1000 > oneDayAgo
      );
      if (filtered.length === 0) {
        this.priceHistory.delete(poolAddress);
      } else {
        this.priceHistory.set(poolAddress, filtered);
      }
    }
  }

  // Debug methods
  getStats() {
    return {
      totalPools: this.transactions.size,
      totalTransactions: Array.from(this.transactions.values()).reduce(
        (sum, txs) => sum + txs.length,
        0
      ),
      poolsWithPrices: this.priceHistory.size,
    };
  }
}

export const volumeCache = new VolumeCache();

// Optional: Run cleanup every hour
if (typeof window === "undefined") {
  setInterval(() => {
    volumeCache.cleanup();
  }, 60 * 60 * 1000); // Every hour
}
