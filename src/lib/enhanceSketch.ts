import {
  Editor,
  AssetRecordType,
  getSvgAsImage,
  createShapeId,
  TLImageShape,
} from "@tldraw/tldraw";
import { extractPromptFromSelection } from "./extractPromptFromSelection";
import { convertBlobToBase64 } from "./convertBlobToBase64";
import { useEnhanceStore } from "@/stores/enhanceStore";
import { eventBus } from "./events";

// Type definitions for API responses
type GenerationStatusResponse = {
  status: string;
  images?: string[];
  width?: number;
  height?: number;
  error?: string;
};

// Add a utility function to show QUIC error guidance
const showQuicErrorGuidance = (): void => {
  console.info(`
===================== QUIC ERROR GUIDANCE ======================
You're experiencing a QUIC protocol error. To fix this:

1. Try the following in Chrome:
   - Visit chrome://flags/#enable-quic
   - Set "Experimental QUIC Protocol" to "Disabled"
   - Restart Chrome

2. Check your firewall settings:
   - Ensure UDP port 443 is not blocked

3. Check for problematic extensions:
   - Disable extensions one by one to identify any causing issues

4. Verify proxy settings:
   - Make sure "Use a proxy server" is unchecked in network settings
=====================================================================
  `);
};

// Optimized fetch with retry, cache control, and better error handling
const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<Response> => {
  let attempt = 0;
  let forceDisableQuic = false;

  // Add cache busting parameter to URLs for GET requests
  const isGetRequest = !options.method || options.method === "GET";
  const urlWithCacheBusting = isGetRequest
    ? `${url}${url.includes("?") ? "&" : "?"}_t=${Date.now()}`
    : url;

  while (attempt < maxRetries) {
    try {
      const headers = new Headers(options.headers || {});

      if (!headers.has("Accept")) {
        headers.set("Accept", "application/json");
      }

      // Add cache control headers to prevent stale responses
      headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
      headers.set("Pragma", "no-cache");
      headers.set("Expires", "0");

      // If QUIC error was detected, add a parameter to force TCP
      const finalUrl = forceDisableQuic
        ? `${urlWithCacheBusting}${
            urlWithCacheBusting.includes("?") ? "&" : "?"
          }_quicDisabled=1`
        : urlWithCacheBusting;

      const response = await fetch(finalUrl, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[fetchWithRetry] Error response body: ${errorText}`);

        // Handle rate limiting specifically
        if (response.status === 429 && attempt < maxRetries - 1) {
          console.warn(
            `[fetchWithRetry] Rate limited (429). Waiting before retry...`
          );
          const retryAfter = parseInt(
            response.headers.get("Retry-After") || "5",
            10
          );
          await new Promise((resolve) =>
            setTimeout(resolve, retryAfter * 1000)
          );
          attempt++;
          continue;
        }

        // Don't retry client errors (except 429 which we handled above)
        if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 429
        ) {
          throw new Error(
            `HTTP error ${response.status}: ${errorText.slice(0, 100)}`
          );
        }

        throw new Error(`HTTP error ${response.status}`);
      }

      // Validate response content type
      const contentType = response.headers.get("content-type") || "";
      const acceptHeader = headers.get("Accept") || "";

      if (
        contentType.includes("application/json") ||
        acceptHeader === "application/json"
      ) {
        try {
          const clonedResponse = response.clone();
          const text = await clonedResponse.text();

          // Check for HTML response when JSON expected
          if (
            text.trim().startsWith("<!DOCTYPE html>") ||
            text.trim().startsWith("<html")
          ) {
            console.warn(
              `[fetchWithRetry] Received HTML instead of expected JSON. Retrying...`
            );
            attempt++;
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            continue;
          }

          // Validate JSON parsing
          if (contentType.includes("application/json")) {
            JSON.parse(text);
          }
        } catch (jsonError) {
          console.warn(
            `[fetchWithRetry] Failed to parse JSON response. Error: ${jsonError}. Retrying...`
          );
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }

      return response;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[fetchWithRetry] Attempt ${attempt + 1} failed: ${errorMessage}`
      );

      // Detect QUIC protocol errors specifically
      if (errorMessage.includes("ERR_QUIC_PROTOCOL_ERROR")) {
        console.warn(
          "[fetchWithRetry] QUIC protocol error detected. Trying to disable QUIC."
        );
        showQuicErrorGuidance();

        // Try to force disable QUIC for subsequent requests
        forceDisableQuic = true;

        // If it's the last retry, try a fallback approach with TCP explicitly
        if (attempt >= maxRetries - 1) {
          // Try one last approach - fetch with keepalive option to prevent QUIC
          try {
            console.info(
              "[fetchWithRetry] Last attempt: using TCP-only approach"
            );
            const tcpHeaders = new Headers(options.headers || {});
            tcpHeaders.set(
              "Cache-Control",
              "no-cache, no-store, must-revalidate"
            );

            const tcpResponse = await fetch(urlWithCacheBusting, {
              ...options,
              headers: tcpHeaders,
              keepalive: true, // This can help avoid QUIC in some cases
              mode: "cors", // Explicitly set CORS mode
              cache: "no-store", // Explicitly disable cache
            });

            return tcpResponse;
          } catch (tcpError) {
            console.error(
              `[fetchWithRetry] TCP fallback failed: ${
                tcpError instanceof Error ? tcpError.message : String(tcpError)
              }`
            );
          }
        }
      }

      attempt++;

      if (attempt >= maxRetries) {
        throw new Error(`Maximum retries exceeded: ${errorMessage}`);
      }

      // Exponential backoff with jitter for network resilience
      const baseDelay = 1000 * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 300;
      await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
    }
  }

  throw new Error("Maximum retries exceeded");
};

// Efficient base64 to blob conversion using fetch API
const base64ToBlob = async (
  base64: string,
  mimeType: string
): Promise<Blob> => {
  try {
    // More efficient method using fetch API
    const res = await fetch(`data:${mimeType};base64,${base64}`);
    return await res.blob();
  } catch {
    // Fallback method if fetch approach fails
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }
};

export async function enhanceSketch(editor: Editor): Promise<string> {
  try {
    // Validate editor state
    const shapes = editor.getSelectedShapes();
    if (shapes.length === 0) throw new Error("No shapes selected.");

    // Get SVG from selection
    const results = await editor.getSvgString(shapes, {
      background: true,
      scale: 1,
    });

    if (!results) {
      throw new Error("Failed to generate SVG from selection.");
    }

    const { svg, width, height } = results;

    // Convert SVG to PNG blob
    const blob = await getSvgAsImage(svg, {
      width,
      height,
      type: "png",
      quality: 0.9,
      pixelRatio: 1,
    });

    if (!blob) {
      throw new Error("Failed to convert SVG to PNG.");
    }

    // Convert PNG blob to base64
    const image_base64 = await convertBlobToBase64(blob);

    // Get settings from the enhance store
    const {
      prompt: userPrompt,
      negativePrompt,
      temperature,
      guidanceScale,
      numImages,
      steps,
      seed,
    } = useEnhanceStore.getState();

    // Optional text from shapes as fallback prompt
    const extractedPrompt = extractPromptFromSelection(editor);
    const finalPrompt = userPrompt || extractedPrompt;

    // Convert base64 to blob for FormData using optimized method
    const imageBlob = await base64ToBlob(image_base64, "image/png");

    // Create FormData with parameters
    const formData = new FormData();
    formData.append("sketch", imageBlob, "sketch.png");

    // Only append parameters that have valid values
    if (finalPrompt) {
      formData.append("prompt", finalPrompt);
    }

    if (negativePrompt) {
      formData.append("negative_prompt", negativePrompt);
    }

    // Add numeric parameters with proper validation
    if (temperature !== undefined && temperature !== null) {
      formData.append("temperature", temperature.toString());
    }

    if (guidanceScale !== undefined && guidanceScale !== null) {
      formData.append("guidance_scale", guidanceScale.toString());
    }

    if (numImages !== undefined && numImages !== null) {
      formData.append("num_images", numImages.toString());
    }

    if (steps !== undefined && steps !== null) {
      formData.append("steps", steps.toString());
    }

    if (seed !== undefined && seed !== null) {
      formData.append("seed", seed.toString());
    }

    // Get API URL and prepare request
    const apiUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/generate`;
    const headers = new Headers();
    headers.append("Accept", "application/json");

    // Notify application that enhancement is starting
    eventBus.publish("enhance:started", { jobId: null });

    try {
      const res = await fetchWithRetry(apiUrl, {
        method: "POST",
        body: formData,
        headers,
      });

      const data = await res.json();
      const { job_id } = data;

      // Update event with actual job ID
      eventBus.publish("enhance:started", { jobId: job_id });

      // For backward compatibility, also wait for the image and place on canvas
      try {
        const result = await waitForImageGeneration(job_id);
        if (!result) throw new Error("No enhanced image received.");

        const { image, width: w, height: h } = result;

        const bounds = editor.getSelectionPageBounds();
        if (!bounds) throw new Error("Could not get selection bounds.");

        const assetId = AssetRecordType.createId();
        const shapeId = createShapeId();

        // Create asset from enhanced image
        editor.createAssets([
          {
            id: assetId,
            type: "image",
            typeName: "asset",
            props: {
              name: "enhanced-sketch.png",
              src: `data:image/png;base64,${image}`,
              w,
              h,
              mimeType: "image/png",
              isAnimated: false,
            },
            meta: {},
          },
        ]);

        // Insert enhanced image next to selection
        editor.createShape<TLImageShape>({
          id: shapeId,
          type: "image",
          x: bounds.maxX + 60,
          y: bounds.maxY - h / 2,
          props: {
            assetId,
            w,
            h,
          },
        });

        editor.select(shapeId);
      } catch (placementError: unknown) {
        console.error(
          `[enhanceSketch] Failed to place image on canvas: ${
            placementError instanceof Error
              ? placementError.message
              : String(placementError)
          }`
        );
        // Continue execution - this is not fatal
      }

      return job_id;
    } catch (fetchError: unknown) {
      // Specifically check for QUIC errors
      if (
        fetchError instanceof Error &&
        fetchError.message.includes("ERR_QUIC_PROTOCOL_ERROR")
      ) {
        showQuicErrorGuidance();
      }
      throw fetchError;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    eventBus.publish("enhance:failed", { error: errorMessage });
    throw error;
  }
}

// Optimized waitForImageGeneration with adaptive polling
async function waitForImageGeneration(
  jobId: string
): Promise<{ image: string; width: number; height: number } | null> {
  const startTime = Date.now();
  const maxWaitTime = 120000; // 2 minutes
  let pollInterval = 2000; // Start with 2 seconds
  const maxPollInterval = 10000; // Max 10 seconds
  const pollIncreaseFactor = 1.5; // Increase poll interval by 50% each time

  while (Date.now() - startTime < maxWaitTime) {
    try {
      // Add timestamp to URL to prevent caching
      const statusUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/status/${jobId}`;

      const headers = new Headers();
      headers.append("Accept", "application/json");

      let data: GenerationStatusResponse;

      try {
        const response = await fetchWithRetry(statusUrl, { headers }, 3);
        data = await response.json();
      } catch (fetchError: unknown) {
        console.error(
          `[waitForImageGeneration] Error fetching status for job ${jobId}: ${
            fetchError instanceof Error
              ? fetchError.message
              : String(fetchError)
          }. Retrying...`
        );
        // Waiting before next poll attempt with adaptive interval
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        // Increase poll interval for next attempt to reduce server load
        pollInterval = Math.min(
          pollInterval * pollIncreaseFactor,
          maxPollInterval
        );
        continue;
      }

      // Process successful completion
      if (
        data.status === "completed" &&
        data.images &&
        data.images.length > 0
      ) {
        const imageFilename = data.images[0];
        const filename = imageFilename.split("/").pop() || "";

        // Add timestamp to prevent caching of image
        const imageUrl = `${
          process.env.NEXT_PUBLIC_BACKEND_URL
        }/generated/${filename}?_t=${Date.now()}`;

        const imageHeaders = new Headers();
        imageHeaders.append("Accept", "image/*");
        imageHeaders.append(
          "Cache-Control",
          "no-cache, no-store, must-revalidate"
        );

        let imageBlob: Blob;

        try {
          const imageRes = await fetchWithRetry(imageUrl, {
            headers: imageHeaders,
          });
          imageBlob = await imageRes.blob();
        } catch (imageFetchError: unknown) {
          console.error(
            `[waitForImageGeneration] Failed to fetch the generated image: ${
              imageFetchError instanceof Error
                ? imageFetchError.message
                : String(imageFetchError)
            }`
          );
          throw new Error("Failed to fetch the generated image");
        }

        const base64 = await convertBlobToBase64(imageBlob);

        // Get actual dimensions or fall back to defaults
        const width = data.width || 512;
        const height = data.height || 512;

        // Publish event that image generation completed
        eventBus.publish("enhance:completed", {
          images: data.images,
          width,
          height,
        });

        return {
          image: base64,
          width,
          height,
        };
      }

      // Handle failure case
      if (data.status === "failed") {
        const errorMsg = data.error || "Image generation failed";
        console.error(
          `[waitForImageGeneration] Job ${jobId} failed: ${errorMsg}`
        );
        eventBus.publish("enhance:failed", { error: errorMsg });
        throw new Error(errorMsg);
      }

      // If status is still pending or processing, wait and then poll again
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      // Increase poll interval for next attempt to reduce server load
      pollInterval = Math.min(
        pollInterval * pollIncreaseFactor,
        maxPollInterval
      );
    } catch (error: unknown) {
      console.error(
        `[waitForImageGeneration] Error during polling loop for job ${jobId}: ${
          error instanceof Error ? error.message : String(error)
        }. Retrying...`
      );
      // Wait before retrying the loop with adaptive interval
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      // Increase poll interval for next attempt
      pollInterval = Math.min(
        pollInterval * pollIncreaseFactor,
        maxPollInterval
      );
    }
  }

  // Loop timed out
  const timeoutError = "Image generation timed out";
  console.error(
    `[waitForImageGeneration] Job ${jobId} timed out after ${maxWaitTime}ms.`
  );
  eventBus.publish("enhance:failed", { error: timeoutError });
  throw new Error(timeoutError);
}
