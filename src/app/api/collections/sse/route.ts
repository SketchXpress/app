/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/collections/sse/route.ts
import { NextRequest } from "next/server";
import { sseManager } from "@/lib/sse/sseManager";

// Helper to send data to all connected clients (used by webhook)
export function broadcastToSSEClients(data: any) {
  return sseManager.broadcast(data);
}

export async function GET(request: NextRequest) {
  // Extract client ID from query params for debugging
  const { searchParams } = new URL(request.url);
  const clientId =
    searchParams.get("clientId") ||
    `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Create readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Add connection to manager
      sseManager.addConnection(clientId, controller);
    },

    cancel() {
      // This is called when the client disconnects
      sseManager.removeConnection(clientId);
    },
  });

  // Handle client disconnect via request signal
  request.signal.addEventListener("abort", () => {
    sseManager.removeConnection(clientId);
  });

  // Return response with SSE headers
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    },
  });
}
