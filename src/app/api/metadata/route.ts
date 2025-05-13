// src/app/api/metadata/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const uri = searchParams.get("uri");
  if (!uri) {
    return NextResponse.json({ error: "Missing uri" }, { status: 400 });
  }

  // Resolve ipfs/arweave/force-https exactly once
  let target = uri;
  if (uri.startsWith("ipfs://")) {
    target = `https://ipfs.io/ipfs/${uri.slice(7)}`;
  } else if (uri.startsWith("ar://")) {
    target = `https://arweave.net/${uri.slice(5)}`;
  } else if (!uri.startsWith("http://") && !uri.startsWith("https://")) {
    target = `https://${uri}`;
  }

  try {
    const upstream = await fetch(target);
    const contentType = upstream.headers.get("content-type") || "";

    // If it’s not JSON or not 2xx, just return empty JSON
    if (!upstream.ok || !contentType.includes("application/json")) {
      return NextResponse.json({});
    }

    const json = await upstream.json();
    return NextResponse.json(json);
  } catch {
    // swallow any network or parse errors
    return NextResponse.json({});
  }
}
