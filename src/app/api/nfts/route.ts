import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get("wallet");

  if (!walletAddress) {
    return NextResponse.json(
      { error: "Wallet address is required" },
      { status: 400 }
    );
  }

  // Use environment variables
  const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;

  try {
    // Use Helius RPC directly to get NFTs (for testnet)
    const url = `https://api-devnet.helius-rpc.com/v0/addresses/${walletAddress}/tokens?api-key=${HELIUS_API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Helius API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch NFTs from Helius API",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
