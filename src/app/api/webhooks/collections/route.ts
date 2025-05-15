// This one is for SSE endpoint
// src/app/api/webhooks/collections/route.ts
import { NextRequest } from "next/server";
import { broadcastToSSEClients } from "@/lib/sse/eventBroadcaster";

export async function POST(request: NextRequest) {
  // parse the incoming webhook
  const payload = await request.json();

  // send it out to all SSE connections
  broadcastToSSEClients(payload);

  // respond so the webhook sender knows we got it
  return new Response(null, { status: 204 });
}
