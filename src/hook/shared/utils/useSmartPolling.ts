import { useEffect, useRef, useCallback } from "react";

interface PollingConfig {
  interval: number;
  immediate?: boolean;
  enabled?: boolean;
  onError?: (error: Error) => void;
}

export function useSmartPolling(
  callback: () => Promise<void> | void,
  config: PollingConfig
) {
  const { interval, immediate = true, enabled = true, onError } = config;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);

  const executeCallback = useCallback(async () => {
    // Preventing concurrent executions
    if (isRunningRef.current) return;

    isRunningRef.current = true;
    try {
      await callback();
    } catch (error) {
      console.error("Polling error:", error);
      onError?.(error as Error);
    } finally {
      isRunningRef.current = false;
    }
  }, [callback, onError]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(executeCallback, interval);
  }, [executeCallback, interval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopPolling();
      return;
    }

    if (immediate) {
      executeCallback();
    }

    startPolling();

    return stopPolling;
  }, [enabled, immediate, startPolling, stopPolling, executeCallback]);

  return { startPolling, stopPolling };
}
