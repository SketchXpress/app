import { NextRequest, NextResponse } from "next/server";

interface SaleEvent {
  signature: string;
  blockTime: number;
  soldSol: number;
  buyer?: string;
  seller?: string;
  nftMint?: string;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ poolAddress: string }> }
) {
  try {
    const { poolAddress } = await context.params;
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get("apiKey");

    if (!poolAddress) {
      return NextResponse.json(
        { error: "Pool address is required" },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    const sales: SaleEvent[] = [];

    return NextResponse.json({
      poolAddress,
      sales,
      count: sales.length,
      source: "helius-api",
    });
  } catch (error) {
    console.error("Error fetching Helius sales:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales data" },
      { status: 500 }
    );
  }
}

// Add other HTTP methods if needed
export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
