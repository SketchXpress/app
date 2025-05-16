import { sseManager } from "@/lib/sse/sseManager";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function broadcastToSSEClients(data: any) {
  return sseManager.broadcast(data);
}
