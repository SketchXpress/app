interface ApiClientOptions {
  baseDelay?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

/**
 * Creates an API client for Helius API and RPC endpoints.
 * @param options - Options for the API client
 * @param options.baseDelay - Base delay for exponential backoff (default: 1000ms)
 * @param options.maxRetries - Maximum number of retries for failed requests (default: 3)
 * @param options.headers - Additional headers to include in requests
 * @param options.HELIUS_API_KEY - Helius API key (required)
 * @returns
 */
export function createApiClient(options: ApiClientOptions = {}) {
  const { baseDelay = 1000, maxRetries = 3, headers = {} } = options;

  // loading and validating env vars
  const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
  const HELIUS_API_BASE = process.env.NEXT_PUBLIC_HELIUS_API_BASE;
  const HELIUS_RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;

  if (!HELIUS_API_KEY) {
    throw new Error("Missing env var NEXT_PUBLIC_HELIUS_API_KEY");
  }
  if (!HELIUS_API_BASE) {
    throw new Error("Missing env var NEXT_PUBLIC_HELIUS_API_BASE");
  }
  if (!HELIUS_RPC_URL) {
    throw new Error("Missing env var NEXT_PUBLIC_HELIUS_RPC_URL");
  }

  // Appending the API key to the base URL
  const HELIUS_RPC_ENDPOINT = `${HELIUS_RPC_URL}?api-key=${HELIUS_API_KEY}`;

  // Tracking in-flight requests for deduplication
  const pendingRequests = new Map<string, Promise<unknown>>();

  // Core function to fetch + retry + backoff + deduplication
  async function doFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
    const cacheKey =
      url +
      (init.method ?? "GET") +
      (init.body ? JSON.stringify(init.body) : "");

    const existing = pendingRequests.get(cacheKey) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }

    const attemptFetch = async (): Promise<T> => {
      let attempt = 0;
      while (attempt < maxRetries) {
        try {
          const resp = await fetch(url, {
            ...init,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-cache",
              ...headers,
              ...(init.headers as Record<string, string>),
            },
          });
          if (!resp.ok) {
            throw new Error(`API error: ${resp.status}`);
          }
          return (await resp.json()) as T;
        } catch (err) {
          attempt++;
          if (attempt >= maxRetries) {
            throw err;
          }
          const delay =
            baseDelay * 2 ** (attempt - 1) * (0.9 + Math.random() * 0.2);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
      throw new Error("Max retries exceeded");
    };

    const promise = attemptFetch().finally(() => {
      pendingRequests.delete(cacheKey);
    });
    pendingRequests.set(cacheKey, promise);
    return promise;
  }

  return {
    fetch: doFetch,

    async heliusApi<T>(
      endpoint: string,
      params: Record<string, string> = {}
    ): Promise<T> {
      const url = new URL(`${HELIUS_API_BASE}${endpoint}`);
      url.searchParams.append("api-key", HELIUS_API_KEY);
      Object.entries(params).forEach(([k, v]) => {
        url.searchParams.append(k, v);
      });
      return doFetch<T>(url.toString());
    },

    async heliusRpc<T>(method: string, params: unknown[]): Promise<T> {
      return doFetch<T>(HELIUS_RPC_ENDPOINT, {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method,
          params,
        }),
      });
    },
  };
}

// Singleton instance of the API client
export const apiClient = createApiClient();
