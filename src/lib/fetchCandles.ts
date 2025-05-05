/**
 * Interface for candle data structure
 */
export interface Candle {
  time: number; // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Fetches and transforms bonding curve price history into candle data
 * @param poolAddress The address of the pool to fetch data for
 * @returns Promise resolving to an array of candle data
 */
export const fetchCandles = async (poolAddress: string): Promise<Candle[]> => {
  console.log(`Fetching candles for pool: ${poolAddress}`);
  
  try {
    // Fetch the bonding curve data from the API
    const response = await fetch(`/api/bonding-curve?poolAddress=${poolAddress}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText} (${response.status})`);
    }
    
    const data = await response.json();
    
    if (!data.history || !Array.isArray(data.history) || data.history.length === 0) {
      console.warn("No history data returned from API");
      return [];
    }
    
    // IMPORTANT CHANGE: Group history entries by significant price changes
    // First, filter and sort by timestamp
    const sortedHistory = data.history
      .filter((h: any) => h.blockTime != null)
      .sort((a: any, b: any) => (a.blockTime - b.blockTime));
    
    // Next, identify only significant price change events
    // This uses a price change threshold to determine if an event is significant
    const significantEvents: any[] = [];
    let lastIncludedPrice: number | null = null;
    
    sortedHistory.forEach((item: any, index: number) => {
      const currentPrice = item.price || 0;
      
      // Always include the first and last events
      if (index === 0 || index === sortedHistory.length - 1) {
        significantEvents.push(item);
        lastIncludedPrice = currentPrice;
        return;
      }
      
      // Check if this is a transaction event (customize this condition based on your API data)
      const isTransactionEvent = item.supplyChange !== undefined && item.supplyChange !== 0;
      
      // Include events with significant price changes or that represent transactions
      if (isTransactionEvent || 
          lastIncludedPrice === null || 
          Math.abs((currentPrice - lastIncludedPrice) / lastIncludedPrice) > 0.01) { // 1% threshold
        significantEvents.push(item);
        lastIncludedPrice = currentPrice;
      }
    });
    
    console.log(`Filtered ${sortedHistory.length} events down to ${significantEvents.length} significant events`);
    
    // Transform the filtered events into candle format
    let lastPrice: number | null = null;
    const candles = significantEvents.map((item: any) => {
      // Convert to seconds if needed (in case API returns milliseconds)
      const timeInSeconds = typeof item.blockTime === 'number' && item.blockTime > 1000000000000 
        ? Math.floor(item.blockTime / 1000)
        : Math.floor(item.blockTime);
        
      const price = item.price ?? lastPrice ?? 0;
      const open = lastPrice ?? price;
      const high = Math.max(open, price);
      const low = Math.min(open, price);
      
      // Update last price for next candle
      lastPrice = price;
      
      return {
        time: timeInSeconds,
        open,
        high,
        low,
        close: price
      };
    });
    
    console.log(`Processed ${candles.length} candles from significant events`);
    return candles;
    
  } catch (error) {
    console.error("Error fetching or processing candle data:", error);
    
    // For debugging in development, return sample data if needed
    if (process.env.NODE_ENV === 'development') {
      console.warn("Returning sample data for development");
      return generateSampleCandles();
    }
    
    return [];
  }
};

/**
 * Generates sample candle data for development/testing
 * @returns Array of sample candles
 */
const generateSampleCandles = (): Candle[] => {
  const now = Math.floor(Date.now() / 1000);
  const hourInSeconds = 60 * 60;
  
  // Generate just a few sample candles to represent key events
  return [
    {
      time: now - hourInSeconds * 5,
      open: 0,
      high: 0.1,
      low: 0,
      close: 0.1
    },
    {
      time: now - hourInSeconds * 3,
      open: 0.1,
      high: 0.25,
      low: 0.1,
      close: 0.25
    },
    {
      time: now - hourInSeconds * 1,
      open: 0.25,
      high: 0.3,
      low: 0.25,
      close: 0.3
    }
  ];
};
