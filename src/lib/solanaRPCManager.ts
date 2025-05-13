/* eslint-disable @typescript-eslint/no-explicit-any */
export class SolanaRPCManager {
  private queue: Array<{
    fn: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    method: string;
  }> = [];

  private requestCounts = new Map<string, number[]>();
  private processing = false;
  private readonly maxRequestsPerEndpoint = 30; // Conservative limit (40 is max)
  private readonly timeWindow = 10000; // 10 seconds
  private readonly delayBetweenRequests = 300; // 300ms between requests

  async queueRequest<T>(rpcMethod: string, fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        fn,
        resolve,
        reject,
        method: rpcMethod,
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      // Check if we can make a request
      if (!this.canMakeRequest()) {
        // Wait before checking again
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      const request = this.queue.shift();
      if (!request) break;

      try {
        this.recordRequest();
        const result = await request.fn();
        request.resolve(result);
      } catch (error) {
        // Handle 429 errors specifically
        if (this.is429Error(error)) {
          // Re-queue the request for retry
          this.queue.unshift(request);
          const retryAfter = this.getRetryAfter(error) || 2000;
          console.log(
            `429 error received for ${request.method}, waiting ${retryAfter}ms before retry`
          );
          await new Promise((resolve) => setTimeout(resolve, retryAfter));
          continue;
        }
        request.reject(error);
      }

      // Wait between requests
      await new Promise((resolve) =>
        setTimeout(resolve, this.delayBetweenRequests)
      );
    }

    this.processing = false;
  }

  private canMakeRequest(): boolean {
    const now = Date.now();
    const counts = this.requestCounts.get("default") || [];

    // Remove old requests outside the time window
    const recentRequests = counts.filter(
      (time) => now - time < this.timeWindow
    );
    this.requestCounts.set("default", recentRequests);

    return recentRequests.length < this.maxRequestsPerEndpoint;
  }

  private recordRequest() {
    const now = Date.now();
    const counts = this.requestCounts.get("default") || [];
    counts.push(now);
    this.requestCounts.set("default", counts);
  }

  private is429Error(error: any): boolean {
    return (
      error?.message?.includes("429") ||
      error?.status === 429 ||
      error?.response?.status === 429 ||
      (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 429)
    );
  }

  private getRetryAfter(error: any): number | null {
    // Check for Retry-After header in various places
    const retryAfter =
      error?.response?.headers?.["retry-after"] ||
      error?.headers?.["retry-after"] ||
      error?.retryAfter;

    if (retryAfter) {
      const delaySeconds = parseInt(retryAfter.toString());
      return isNaN(delaySeconds) ? null : delaySeconds * 1000;
    }
    return null;
  }
}

// Create a global instance
export const solanaRPCManager = new SolanaRPCManager();
