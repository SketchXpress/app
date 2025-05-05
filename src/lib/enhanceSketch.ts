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

// Optimized fetch with retry, cache busting, and adaptive backoff
const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<Response> => {
  let attempt = 0;
  
  // Add cache busting parameter to URLs for GET requests
  const isGetRequest = !options.method || options.method === "GET";
  const urlWithCacheBusting = isGetRequest 
    ? `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}` 
    : url;

  while (attempt < maxRetries) {
    try {
      const headers = new Headers(options.headers || {});
      
      // Set proper cache control and common headers
      if (!headers.has("Accept")) {
        headers.set("Accept", "application/json");
      }
      
      // Add cache control headers to prevent stale responses
      headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
      headers.set("Pragma", "no-cache");
      headers.set("Expires", "0");

      const response = await fetch(urlWithCacheBusting, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[fetchWithRetry] Error response body: ${errorText}`);
        
        // Don't retry 4xx errors except rate limiting (429)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new Error(`HTTP error ${response.status}: ${errorText.slice(0, 100)}`);
        }
        
        throw new Error(`HTTP error ${response.status}`);
      }

      // Validate response content for JSON expectations
      const contentType = response.headers.get("content-type") || "";
      const acceptHeader = headers.get("Accept") || "";
      
      if (contentType.includes("application/json") || acceptHeader === "application/json") {
        try {
          const clonedResponse = response.clone();
          const text = await clonedResponse.text();

          // Check for HTML response when JSON expected
          if (text.trim().startsWith("<!DOCTYPE html>") || text.trim().startsWith("<html")) {
            console.warn(`[fetchWithRetry] Received HTML instead of expected JSON. Retrying...`);
            attempt++;
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            continue;
          }

          // Validate JSON parsing if content type indicates JSON
          if (contentType.includes("application/json")) {
            JSON.parse(text);
          }
        } catch (jsonError) {
          console.warn(`[fetchWithRetry] Failed to parse JSON response. Error: ${jsonError}. Retrying...`);
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }

      return response;
    } catch (error) {
      console.error(`[fetchWithRetry] Attempt ${attempt + 1} failed: ${error}`);
      attempt++;

      if (attempt >= maxRetries) {
        throw new Error(`Maximum retries exceeded: ${error}`);
      }

      // Exponential backoff with jitter for network resilience
      const baseDelay = 1000 * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 300;
      await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
    }
  }

  throw new Error("Maximum retries exceeded");
};

// Efficient method to convert base64 to blob
const base64ToBlob = async (base64: string, mimeType: string): Promise<Blob> => {
  try {
    // More efficient method using fetch API
    const res = await fetch(`data:${mimeType};base64,${base64}`);
    return await res.blob();
  } catch (error) {
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

    // Create FormData with parameters using object destructuring
    const formData = new FormData();
    
    // Required parameters
    formData.append("sketch", imageBlob, "sketch.png");
    
    // Optional parameters - only add if they have values
    const params: Record<string, string | null> = {
      prompt: finalPrompt || null,
      negative_prompt: negativePrompt || null,
      temperature: temperature?.toString() || null,
      guidance_scale: guidanceScale?.toString() || null,
      num_images: numImages?.toString() || null,
      steps: steps?.toString() || null,
      seed: seed?.toString() || null,
    };
    
    // Add all valid parameters to formData
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null) {
        formData.append(key, value);
      }
    });

    // Get API URL and prepare request with proper headers
    const apiUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/generate`;
    const headers = new Headers();
    headers.append("Accept", "application/json");

    // Notify application that enhancement is starting
    eventBus.publish("enhance:started", { jobId: null });

    // Execute API request
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
    } catch (placementError) {
      console.error(`[enhanceSketch] Failed to place image on canvas: ${placementError}`);
      // Continue execution - this is not fatal
    }

    return job_id;
  } catch (error) {
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
      } catch (fetchError) {
        console.error(
          `[waitForImageGeneration] Error fetching status for job ${jobId}: ${fetchError}. Retrying...`
        );
        // Waiting before next poll attempt with adaptive interval
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        // Increase poll interval for next attempt to reduce server load
        pollInterval = Math.min(pollInterval * pollIncreaseFactor, maxPollInterval);
        continue;
      }

      // Process successful completion
      if (data.status === "completed" && data.images && data.images.length > 0) {
        const imageFilename = data.images[0];
        const filename = imageFilename.split("/").pop() || "";

        // Add timestamp to prevent caching of image
        const imageUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/generated/${filename}?_t=${Date.now()}`;

        const imageHeaders = new Headers();
        imageHeaders.append("Accept", "image/*");
        imageHeaders.append("Cache-Control", "no-cache, no-store, must-revalidate");

        let imageBlob: Blob;

        try {
          const imageRes = await fetchWithRetry(imageUrl, {
            headers: imageHeaders,
          });
          imageBlob = await imageRes.blob();
        } catch (imageFetchError) {
          console.error(
            `[waitForImageGeneration] Failed to fetch the generated image: ${imageFetchError}`
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
        console.error(`[waitForImageGeneration] Job ${jobId} failed: ${errorMsg}`);
        eventBus.publish("enhance:failed", { error: errorMsg });
        throw new Error(errorMsg);
      }

      // If status is still pending or processing, wait and then poll again
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      // Increase poll interval for next attempt to reduce server load
      pollInterval = Math.min(pollInterval * pollIncreaseFactor, maxPollInterval);
    } catch (error) {
      // Catch errors from within the loop
      console.error(
        `[waitForImageGeneration] Error during polling loop for job ${jobId}: ${error}. Retrying...`
      );
      // Wait before retrying the loop
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      // Increase poll interval for next attempt
      pollInterval = Math.min(pollInterval * pollIncreaseFactor, maxPollInterval);
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
