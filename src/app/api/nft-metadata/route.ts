/* eslint-disable @typescript-eslint/no-explicit-any */
// app/src/app/api/nft-metadata/route.ts
import { NextRequest, NextResponse } from "next/server";

const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
  "https://cf-ipfs.com/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Delay function
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Normalize URI helper
function normalizeUri(uri: string): string {
  if (!uri) return "";

  // Handle IPFS URLs
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.substring(7)}`;
  }

  // Handle Arweave URLs
  if (uri.startsWith("ar://")) {
    return `https://arweave.net/${uri.substring(5)}`;
  }

  // Add https if missing
  if (!uri.startsWith("http") && !uri.startsWith("//")) {
    return `https://${uri}`;
  }

  return uri;
}

// Fetch with retry and fallback gateways
async function fetchWithRetryAndFallback(url: string): Promise<any> {
  let lastError: Error;

  // Try each gateway
  for (const gateway of IPFS_GATEWAYS) {
    let currentUrl = url;

    // Convert IPFS URLs to use the current gateway
    if (
      url.startsWith("https://ipfs.io/ipfs/") ||
      url.startsWith("https://gateway.pinata.cloud/ipfs/")
    ) {
      const hash = url.split("/ipfs/")[1];
      if (hash) {
        currentUrl = `${gateway}${hash}`;
      }
    }

    // Try with retries for this gateway
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(currentUrl, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "User-Agent": "NFT-Metadata-Fetcher/1.0",
          },
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          return data;
        }

        // If we get a 429, wait before retrying
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const waitTime = retryAfter
            ? parseInt(retryAfter) * 1000
            : RETRY_DELAY * (attempt + 1);
          await delay(waitTime);
          continue;
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error as Error;
        if (attempt < MAX_RETRIES) {
          await delay(RETRY_DELAY * (attempt + 1));
        }
      }
    }
  }

  throw lastError!;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uri = searchParams.get("uri");

    if (!uri) {
      return NextResponse.json(
        { error: "URI parameter is required" },
        { status: 400 }
      );
    }

    // Validate URI
    if (
      !uri.startsWith("http") &&
      !uri.startsWith("ipfs://") &&
      !uri.startsWith("ar://")
    ) {
      return NextResponse.json(
        { error: "Invalid URI format" },
        { status: 400 }
      );
    }

    const normalizedUri = normalizeUri(uri);
    const metadata = await fetchWithRetryAndFallback(normalizedUri);

    // Return metadata with cache headers
    return NextResponse.json(metadata, {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400", // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error("Error fetching NFT metadata:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch metadata",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Optional: Support POST for batch requests
export async function POST(request: NextRequest) {
  try {
    const { uris } = await request.json();

    if (!Array.isArray(uris) || uris.length === 0) {
      return NextResponse.json(
        { error: "Array of URIs is required" },
        { status: 400 }
      );
    }

    // Limit batch size to prevent abuse
    const limitedUris = uris.slice(0, 10);

    const results = await Promise.allSettled(
      limitedUris.map(async (uri: string) => {
        try {
          const normalizedUri = normalizeUri(uri);
          const metadata = await fetchWithRetryAndFallback(normalizedUri);
          return { uri, metadata, success: true };
        } catch (error) {
          return {
            uri,
            error: error instanceof Error ? error.message : "Unknown error",
            success: false,
          };
        }
      })
    );

    const response = results.map((result) =>
      result.status === "fulfilled" ? result.value : result.reason
    );

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Error in batch metadata fetch:", error);
    return NextResponse.json(
      { error: "Failed to process batch request" },
      { status: 500 }
    );
  }
}
