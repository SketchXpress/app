// app/api/enhance/route.ts
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // Set max duration to 60 seconds for Vercel

export async function POST(request: NextRequest) {
  try {
    console.log("API route handler started");

    // Check environment variable
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backendUrl) {
      console.error("Missing NEXT_PUBLIC_BACKEND_URL environment variable");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Get form data
    let formData;
    try {
      formData = await request.formData();
      console.log("Form data received, fields:", Array.from(formData.keys()));
    } catch (formError) {
      console.error("Error parsing form data:", formError);
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    // Try to forward the request with timeout and error handling
    console.log(`Forwarding request to ${backendUrl}/api/generate`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000); // 50 second timeout

    try {
      const response = await fetch(`${backendUrl}/api/generate`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log("Backend response received:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Backend error:", response.status, errorText);
        return NextResponse.json(
          { error: `Backend server error: ${response.status}` },
          { status: response.status }
        );
      }

      // Successfully received data from backend
      const data = await response.json();
      return NextResponse.json(data);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error("Fetch to backend failed:", fetchError);
      return NextResponse.json(
        {
          error: "Failed to connect to backend service",
          details: (fetchError as Error).message,
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Unhandled API route error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 }
    );
  }
}
