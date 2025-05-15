// src/app/api/collections/sse/stats/route.ts
import { NextResponse } from "next/server";
import { sseManager } from "@/lib/sse/sseManager";

export async function GET() {
  const stats = sseManager.getStats();

  return NextResponse.json({
    ...stats,
    timestamp: new Date().toISOString(),
  });
}
