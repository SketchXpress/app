/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from "react";
import {
  HELIUS_RPC_ENDPOINT,
  HELIUS_API_BASE,
  HELIUS_API_KEY,
  MAX_RETRIES,
  RETRY_DELAY_BASE,
  MIN_RPC_DELAY,
  CONCURRENT_RPC_LIMIT,
} from "./constants";
import { delay, createTimer } from "./helpers";
import { PerformanceStats } from "../../hook/useBondingCurveHistory/types";
import React from "react";

// Optimized fetch with retry and backoff
export const fetchWithRetry = async (
  url: string,
  options: any,
  maxRetries: number = MAX_RETRIES,
  setPerformance?: React.Dispatch<React.SetStateAction<PerformanceStats>>
) => {
  let retries = 0;
  const timer = createTimer(`API call to ${url.split("?")[0]}`);

  while (retries < maxRetries) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited - exponential backoff
          const backoffTime = RETRY_DELAY_BASE * Math.pow(2, retries);
          console.log(`Rate limited. Retrying in ${backoffTime / 1000}s...`);
          await delay(backoffTime);
          retries++;
          continue;
        }

        const errorData = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        throw new Error(
          `API Error: ${response.status} - ${
            errorData.message || "Request failed"
          }`
        );
      }

      timer.stop();
      if (setPerformance) {
        setPerformance((prev) => ({
          ...prev,
          totalApiCalls: prev.totalApiCalls + 1,
        }));
      }

      return response;
    } catch (err) {
      if (retries === maxRetries - 1) throw err;
      retries++;

      // Exponential backoff for all errors
      const backoffTime = RETRY_DELAY_BASE * Math.pow(2, retries);
      await delay(backoffTime);
    }
  }

  throw new Error(`Failed after ${maxRetries} retries`);
};

// Create RPC request scheduler hook
export const useRpcScheduler = (
  setPerformance: React.Dispatch<React.SetStateAction<PerformanceStats>>
) => {
  // Queue for RPC requests
  const rpcQueue = React.useRef<Array<() => Promise<any>>>([]);
  // Count of active RPC jobs
  const activeRpcJobs = React.useRef<number>(0);
  // Timestamps of recent RPC calls
  const lastRpcTimes = React.useRef<number[]>([]);

  // Process RPC queue up to concurrency limit
  const processRpcQueue = useCallback(() => {
    if (rpcQueue.current.length === 0) return;

    // Process up to CONCURRENT_RPC_LIMIT jobs
    while (
      activeRpcJobs.current < CONCURRENT_RPC_LIMIT &&
      rpcQueue.current.length > 0
    ) {
      const nextRequest = rpcQueue.current.shift();
      if (nextRequest) {
        nextRequest().catch(() => {}); // Catch at this level to prevent unhandled rejections
      }
    }
  }, []);

  // Helper for controlled RPC request scheduling
  const scheduleRpcRequest = useCallback(
    (requestFn: () => Promise<any>) => {
      return new Promise<any>((resolve, reject) => {
        const wrappedRequest = async () => {
          try {
            // Check the last RPC call times to enforce spacing
            const now = Date.now();
            const recentCalls = lastRpcTimes.current.filter(
              (time) => now - time < MIN_RPC_DELAY
            );

            if (recentCalls.length > 0) {
              // Calculate how long to wait to ensure MIN_RPC_DELAY since last call
              const waitTime = MIN_RPC_DELAY - (now - Math.max(...recentCalls));
              if (waitTime > 0) {
                await delay(waitTime);
              }
            }

            // Record the time of this RPC call
            lastRpcTimes.current.push(Date.now());
            // Keep only the last 10 timestamps
            if (lastRpcTimes.current.length > 10) {
              lastRpcTimes.current = lastRpcTimes.current.slice(-10);
            }

            activeRpcJobs.current++;
            const result = await requestFn();
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            activeRpcJobs.current--;
            // Process next job if queue not empty
            processRpcQueue();
          }
        };

        // Add to queue
        rpcQueue.current.push(wrappedRequest);

        // Try to process immediately if we're under concurrency limit
        processRpcQueue();
      });
    },
    [processRpcQueue]
  );

  // Optimized RPC request with advanced retry and concurrency management
  const rpcRequestWithRetry = useCallback(
    async (method: string, params: any[]) => {
      let retries = 0;
      const requestFn = async () => {
        const timer = createTimer(`RPC ${method}`);

        try {
          // Minimal request payload
          const requestPayload = {
            jsonrpc: "2.0",
            id: Date.now(),
            method,
            params,
          };

          // For getTransaction, optimize the request by only asking for what we need
          if (
            method === "getTransaction" &&
            params.length > 1 &&
            typeof params[1] === "object"
          ) {
            params[1] = {
              ...params[1],
              encoding: "jsonParsed",
              maxSupportedTransactionVersion: 0,
            };
          }

          const response = await fetch(HELIUS_RPC_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestPayload),
          });

          if (!response.ok) {
            if (response.status === 429) {
              const backoffTime = RETRY_DELAY_BASE * Math.pow(3, retries); // More aggressive backoff
              console.log(
                `Rate limited (RPC). Backing off for ${backoffTime / 1000}s...`
              );
              await delay(backoffTime);
              retries++;

              if (retries < MAX_RETRIES) {
                // Retry with the same request function
                timer.stop();
                return requestFn();
              }
              throw new Error(
                `RPC rate limit exceeded after ${retries} retries`
              );
            }

            const errorData = await response
              .json()
              .catch(() => ({ message: response.statusText }));
            throw new Error(
              `RPC Error: ${response.status} - ${
                errorData.message || "Request failed"
              }`
            );
          }

          const result = await response.json();
          if (result.error) {
            throw new Error(
              `RPC Error: ${
                result.error.message || JSON.stringify(result.error)
              }`
            );
          }

          const duration = timer.stop();
          setPerformance((prev) => ({
            ...prev,
            totalRpcCalls: prev.totalRpcCalls + 1,
            avgResponseTime:
              (prev.avgResponseTime * prev.totalRpcCalls + duration) /
              (prev.totalRpcCalls + 1),
          }));

          return result.result;
        } catch (err) {
          timer.stop();
          throw err;
        }
      };

      // Use the scheduler to respect concurrency limits
      return scheduleRpcRequest(requestFn);
    },
    [scheduleRpcRequest, setPerformance]
  );

  return { rpcRequestWithRetry, scheduleRpcRequest };
};

// Helper function to fetch data from Helius API
export const fetchHeliusData = async (
  endpoint: string,
  params: Record<string, string> = {},
  setPerformance?: React.Dispatch<React.SetStateAction<PerformanceStats>>
) => {
  let url = `${HELIUS_API_BASE}${endpoint}`;

  // Add API key
  params = {
    "api-key": HELIUS_API_KEY,
    ...params,
  };

  // Convert params to query string
  const queryParams = new URLSearchParams(params).toString();
  url = `${url}?${queryParams}`;
  // const data = await fetchWithRetry(url, {}, MAX_RETRIES, setPerformance);
  // const json = await data.json();
  // console.log("Fetched data:", json);

  return fetchWithRetry(url, {}, MAX_RETRIES, setPerformance);
};
