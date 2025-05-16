import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const uri = searchParams.get("uri");
  if (!uri) {
    return NextResponse.json({ error: "Missing uri" }, { status: 400 });
  }

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

    if (!upstream.ok || !contentType.includes("application/json")) {
      return NextResponse.json({});
    }

    const json = await upstream.json();
    return NextResponse.json(json);
  } catch {
    return NextResponse.json({});
  }
}
