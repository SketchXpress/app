import { NextRequest } from "next/server";
import { broadcastToSSEClients } from "@/lib/sse/eventBroadcaster";

export async function POST(request: NextRequest) {
  // Parsing the incoming webhook
  const payload = await request.json();

  // Sending it out to all SSE connections
  broadcastToSSEClients(payload);

  return new Response(null, { status: 204 });
}
