import { useState, useEffect, useCallback, useRef } from "react";

export interface WebSocketConfig {
  url: string;
  protocols?: string | string[];
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  onOpen?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onReconnectAttempt?: (attempt: number) => void;
  onReconnectFailed?: () => void;
}

export interface WebSocketState {
  readyState: number;
  isConnected: boolean;
  reconnectAttempts: number;
  lastError: Event | null;
}

export function useWebSocketManager(config: WebSocketConfig) {
  const [state, setState] = useState<WebSocketState>({
    readyState: WebSocket.CONNECTING,
    isConnected: false,
    reconnectAttempts: 0,
    lastError: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManuallyClosedRef = useRef(false);
  const configRef = useRef(config);

  // Update config ref when config changes
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      isManuallyClosedRef.current = false;
      const ws = new WebSocket(
        configRef.current.url,
        configRef.current.protocols
      );
      wsRef.current = ws;

      ws.onopen = (event) => {
        setState((prev) => ({
          ...prev,
          readyState: ws.readyState,
          isConnected: true,
          reconnectAttempts: 0,
          lastError: null,
        }));
        configRef.current.onOpen?.(event);
      };

      ws.onmessage = (event) => {
        configRef.current.onMessage?.(event);
      };

      ws.onclose = (event) => {
        setState((prev) => ({
          ...prev,
          readyState: ws.readyState,
          isConnected: false,
        }));

        configRef.current.onClose?.(event);

        // Attempt to reconnect if not manually closed
        if (!isManuallyClosedRef.current && event.code !== 1000) {
          const maxAttempts = configRef.current.maxReconnectAttempts ?? 5;

          setState((prev) => {
            if (prev.reconnectAttempts < maxAttempts) {
              const newAttempts = prev.reconnectAttempts + 1;
              configRef.current.onReconnectAttempt?.(newAttempts);

              const delay = configRef.current.reconnectDelay ?? 5000;
              reconnectTimeoutRef.current = setTimeout(() => {
                connect();
              }, delay);

              return { ...prev, reconnectAttempts: newAttempts };
            } else {
              configRef.current.onReconnectFailed?.();
              return prev;
            }
          });
        }
      };

      ws.onerror = (event) => {
        setState((prev) => ({
          ...prev,
          lastError: event,
        }));
        configRef.current.onError?.(event);
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
    }
  }, []);

  const disconnect = useCallback(() => {
    isManuallyClosedRef.current = true;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "Manual disconnect");
      wsRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      readyState: WebSocket.CLOSED,
      isConnected: false,
    }));
  }, []);

  const sendMessage = useCallback(
    (message: string | ArrayBufferLike | Blob | ArrayBufferView) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(message);
        return true;
      }
      return false;
    },
    []
  );

  // Auto-connect on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    state,
    connect,
    disconnect,
    sendMessage,
  };
}
