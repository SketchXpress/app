/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/hook/api/realtime/useSSEConnection.ts
import { useState, useEffect, useRef, useCallback } from "react";

export interface SSEEvent {
  type: "connection" | "heartbeat" | "newPools" | "newCollections" | "error";
  timestamp: string;
  data?: any;
  message?: string;
  clientId?: string;
}

export interface UseSSEConnectionOptions {
  endpoint?: string;
  clientId?: string;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export function useSSEConnection(options: UseSSEConnectionOptions = {}) {
  const {
    endpoint = "/api/collections/sse",
    clientId = `client-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`,
    autoReconnect = true,
    reconnectDelay = 5000, // Increased delay
    maxReconnectAttempts = 3, // Reduced attempts
  } = options;

  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const eventCallbacksRef = useRef<Map<string, Set<(event: SSEEvent) => void>>>(
    new Map()
  );
  const isConnectingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Subscribe to specific event types
  const subscribe = useCallback(
    (eventType: string, callback: (event: SSEEvent) => void) => {
      if (!eventCallbacksRef.current.has(eventType)) {
        eventCallbacksRef.current.set(eventType, new Set());
      }
      eventCallbacksRef.current.get(eventType)!.add(callback);

      // Return unsubscribe function
      return () => {
        eventCallbacksRef.current.get(eventType)?.delete(callback);
      };
    },
    []
  );

  // Emit events to subscribers
  const emitEvent = useCallback((event: SSEEvent) => {
    if (!isMountedRef.current) return;

    setLastEvent(event);

    // Call type-specific callbacks
    const callbacks = eventCallbacksRef.current.get(event.type);
    if (callbacks) {
      callbacks.forEach((callback) => callback(event));
    }

    // Call general callbacks
    const generalCallbacks = eventCallbacksRef.current.get("*");
    if (generalCallbacks) {
      generalCallbacks.forEach((callback) => callback(event));
    }
  }, []);

  // Connect to SSE
  const connect = useCallback(() => {
    if (!isMountedRef.current) return;

    if (eventSourceRef.current || isConnectingRef.current) {
      console.log("SSE already connected or connecting");
      return; // Already connected or connecting
    }

    isConnectingRef.current = true;
    setConnectionState("connecting");
    setError(null);

    console.log(`SSE attempting connection: ${clientId}`);

    const url = `${endpoint}?clientId=${encodeURIComponent(clientId)}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (!isMountedRef.current) return;

      console.log(`SSE connected successfully: ${clientId}`);
      setConnectionState("connected");
      setError(null);
      reconnectAttemptsRef.current = 0;
      isConnectingRef.current = false;
    };

    eventSource.onmessage = (event) => {
      if (!isMountedRef.current) return;

      try {
        const data: SSEEvent = JSON.parse(event.data);
        emitEvent(data);
      } catch (parseError) {
        console.error("Error parsing SSE event:", parseError);
        setError("Error parsing server event");
      }
    };

    eventSource.onerror = (event) => {
      if (!isMountedRef.current) return;

      console.error("SSE error for client:", clientId, event);
      isConnectingRef.current = false;

      // Close the connection
      eventSource.close();
      eventSourceRef.current = null;

      // Only attempt reconnection if we had a successful connection before
      if (
        connectionState === "connected" &&
        autoReconnect &&
        reconnectAttemptsRef.current < maxReconnectAttempts
      ) {
        setConnectionState("error");
        setError("Connection lost - attempting reconnect...");

        reconnectAttemptsRef.current++;
        console.log(
          `Attempting reconnect ${reconnectAttemptsRef.current}/${maxReconnectAttempts} in ${reconnectDelay}ms`
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            connect();
          }
        }, reconnectDelay * reconnectAttemptsRef.current); // Exponential backoff
      } else {
        setConnectionState("disconnected");
        setError("Connection failed");
      }
    };
  }, [
    endpoint,
    clientId,
    autoReconnect,
    reconnectDelay,
    maxReconnectAttempts,
    emitEvent,
    connectionState,
  ]);

  // Disconnect from SSE
  const disconnect = useCallback(() => {
    console.log(`SSE disconnecting: ${clientId}`);

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    isConnectingRef.current = false;
    setConnectionState("disconnected");
  }, [clientId]);

  // Auto-connect on mount
  useEffect(() => {
    isMountedRef.current = true;

    // Only connect if not already connected
    if (connectionState === "disconnected") {
      connect();
    }

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, []); // Empty dependency array - only run on mount/unmount

  return {
    connectionState,
    lastEvent,
    error,
    connect,
    disconnect,
    subscribe,
    isConnected: connectionState === "connected",
    isConnecting: connectionState === "connecting",
    isDisconnected: connectionState === "disconnected",
    hasError: connectionState === "error",
  };
}
