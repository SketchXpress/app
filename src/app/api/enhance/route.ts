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
      console.log(
        "Form data received with fields:",
        Array.from(formData.keys())
      );

      // Log file sizes if present
      const sketch = formData.get("sketch") as File;
      if (sketch) {
        console.log(`Sketch file size: ${Math.round(sketch.size / 1024)} KB`);
        if (sketch.size > 5 * 1024 * 1024) {
          console.warn(
            "Warning: Sketch file is larger than 5MB, which might cause issues"
          );
        }
      }
    } catch (formError) {
      console.error("Error parsing form data:", formError);
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    // Try to forward the request with timeout and error handling
    console.log(`Forwarding request to ${backendUrl}/api/generate`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.log("Request to backend timed out after 50 seconds");
    }, 50000); // 50 second timeout

    try {
      // Add custom headers to help with debugging
      const headers = new Headers();
      headers.append("X-Requested-From", "sketchxpress-next-api");
      headers.append("Accept", "application/json");

      const response = await fetch(`${backendUrl}/api/generate`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
        headers: headers,
      });

      clearTimeout(timeoutId);
      console.log("Backend response received:", response.status);

      if (!response.ok) {
        let errorText;
        try {
          errorText = await response.text();
        } catch {
          errorText = "Could not read error response";
        }

        console.error("Backend error:", response.status, errorText);
        return NextResponse.json(
          {
            error: `Backend server error: ${response.status}`,
            details: errorText,
          },
          { status: response.status }
        );
      }

      // Check for job-based response
      let data;
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        try {
          data = await response.json();
          console.log("Successfully parsed JSON response");

          // Check if it's a job ID response
          if (data.job_id) {
            console.log(`Received job ID: ${data.job_id}`);
          }
        } catch (jsonError) {
          console.error("Error parsing JSON response:", jsonError);
          return NextResponse.json(
            { error: "Invalid JSON response from backend" },
            { status: 502 }
          );
        }
      } else {
        // Handle non-JSON response
        const text = await response.text();
        console.warn("Non-JSON response received:", text.substring(0, 100));

        return NextResponse.json(
          { error: "Unexpected response format from backend" },
          { status: 502 }
        );
      }

      return NextResponse.json(data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.error(
        "Fetch to backend failed:",
        fetchError.name,
        fetchError.message
      );

      // Check for specific error types
      if (fetchError.name === "AbortError") {
        return NextResponse.json(
          {
            error: "Request to backend timed out",
            details: "The backend server took too long to respond",
          },
          { status: 504 }
        );
      }

      return NextResponse.json(
        {
          error: "Failed to connect to backend service",
          details: (fetchError as Error).message,
          errorType: (fetchError as Error).name,
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Unhandled API route error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
