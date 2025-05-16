import { NextRequest } from "next/server";
import { sseManager } from "@/lib/sse/sseManager";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId =
    searchParams.get("clientId") ||
    `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const stream = new ReadableStream({
    start(controller) {
      sseManager.addConnection(clientId, controller);
    },

    cancel() {
      sseManager.removeConnection(clientId);
    },
  });

  // Handle client disconnect via request signal
  request.signal.addEventListener("abort", () => {
    sseManager.removeConnection(clientId);
  });

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
