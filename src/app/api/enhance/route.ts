import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Forward the request to your API
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/generate`,
      {
        method: "POST",
        body: formData,
      }
    );

    // Forward the response back to the client
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error proxying request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
