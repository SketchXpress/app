import { processTrendingCollections } from "@/utils/processTrendingCollections";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(
      `${process.env.HELIUS_API_BASE}/addresses/${process.env.PROGRAM_ID}/transactions?api-key=${process.env.HELIUS_API_KEY}&limit=100`
    );
    const transactions = await response.json();

    // Process the data on the server
    const collections = processTrendingCollections(transactions);

    return NextResponse.json({ collections });
  } catch (error) {
    console.error("Error fetching trending collections:", error);
    return NextResponse.json(
      { error: "Failed to fetch trending collections" },
      { status: 500 }
    );
  }
}
