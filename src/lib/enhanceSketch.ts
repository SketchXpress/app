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

// Define fetch function with proper TypeScript types
const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<Response> => {
  let attempt = 0;

  // Add ngrok bypass parameter
  const bypassParam = "_ngrok_first_party=true";
  const urlWithBypass = url.includes("?")
    ? `${url}&${bypassParam}`
    : `${url}?${bypassParam}`;

  while (attempt < maxRetries) {
    try {
      console.log(
        `[fetchWithRetry] Attempt ${
          attempt + 1
        }/${maxRetries} for URL: ${urlWithBypass}`
      );

      // Handle headers properly for TypeScript
      const headers = new Headers(options.headers || {});
      if (!headers.has("Accept")) {
        headers.set("Accept", "application/json");
      }

      const response = await fetch(urlWithBypass, {
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      // Check if we got JSON when we expected it
      const contentType = response.headers.get("content-type") || "";
      const acceptHeader = headers.get("Accept") || "";

      if (
        contentType.includes("application/json") ||
        acceptHeader === "application/json"
      ) {
        // For JSON responses, verify we can parse them
        try {
          // Clone the response so we can still use it later
          const clonedResponse = response.clone();
          const text = await clonedResponse.text();

          if (text.includes("<!DOCTYPE html>") || text.includes("<html")) {
            console.warn(
              `[fetchWithRetry] Received HTML instead of JSON. Retrying...`
            );
            attempt++;
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            continue;
          }

          // Try parsing as JSON if we're expecting JSON
          if (contentType.includes("application/json")) {
            JSON.parse(text);
          }
        } catch (parseError) {
          console.warn(
            `[fetchWithRetry] Failed to parse response: ${parseError}`
          );
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }

      return response;
    } catch (error) {
      attempt++;
      console.warn(
        `[fetchWithRetry] Request failed (attempt ${attempt}/${maxRetries}):`,
        error
      );

      if (attempt >= maxRetries) {
        throw error;
      }

      // Wait before retrying with exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
      );
    }
  }

  throw new Error("Maximum retries exceeded");
};

// Direct API access for when fetchWithRetry fails
const directApiAccess = async (
  jobId: string
): Promise<GenerationStatusResponse | null> => {
  console.log(`[directApiAccess] Attempting direct access for job ${jobId}`);
  try {
    // This is a server-side call to your backend using CURL or similar
    // We'll simulate this with localStorage since we can't do CURL from browser

    // First check if this job's result is in localStorage (simulating server-side storage)
    const statusDataString = localStorage.getItem(`job_${jobId}`);
    if (statusDataString) {
      return JSON.parse(statusDataString);
    }

    // In a real implementation, this would be a server-side call to your backend
    console.log(
      `[directApiAccess] No stored data found for job ${jobId}, cannot proceed`
    );
    return null;
  } catch (error) {
    console.error(`[directApiAccess] Error:`, error);
    return null;
  }
};

export async function enhanceSketch(editor: Editor): Promise<string> {
  try {
    const shapes = editor.getSelectedShapes();
    if (shapes.length === 0) throw new Error("No shapes selected.");

    const results = await editor.getSvgString(shapes, {
      background: true,
      scale: 1,
    });

    if (!results) {
      throw new Error("Failed to generate SVG from selection.");
    }

    const { svg, width, height } = results;

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

    // Convert base64 to blob for FormData
    const binaryString = atob(image_base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const imageBlob = new Blob([bytes], { type: "image/png" });

    // Create FormData and append sketch and prompt
    const formData = new FormData();
    formData.append("sketch", imageBlob, "sketch.png");

    if (finalPrompt) {
      formData.append("prompt", finalPrompt);
    }

    if (negativePrompt) {
      formData.append("negative_prompt", negativePrompt);
    }

    formData.append("temperature", temperature.toString());
    formData.append("guidance_scale", guidanceScale.toString());
    formData.append("num_images", numImages.toString());
    formData.append("steps", steps.toString());

    if (seed !== null) {
      formData.append("seed", seed.toString());
    }

    // Use our fetch with retry for the backend call
    const apiUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/generate`;
    console.log(`[enhanceSketch] Sending request to: ${apiUrl}`);

    // Create headers for request
    const headers = new Headers();
    headers.append("Accept", "application/json");

    const res = await fetchWithRetry(apiUrl, {
      method: "POST",
      body: formData,
      headers,
    });

    const data = await res.json();
    const { job_id } = data;
    console.log(`[enhanceSketch] Job started with ID: ${job_id}`);

    // Publish event for RightPanel to start monitoring the job
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
    } catch (error) {
      console.error("[enhanceSketch] Error waiting for image:", error);
      // Even if placing the image fails, we still return the job_id
      // so the RightPanel can handle displaying/reusing the result
    }

    return job_id;
  } catch (error) {
    console.error("[EnhanceSketch] Error:", error);
    // Publish failure event for RightPanel to react to
    eventBus.publish("enhance:failed", { error: (error as Error).message });
    throw error;
  }
}

// Type definitions for API responses
type GenerationStatusResponse = {
  status: string;
  images?: string[];
  width?: number;
  height?: number;
  error?: string;
};

// Updated waitForImageGeneration function with proper typing
async function waitForImageGeneration(
  jobId: string
): Promise<{ image: string; width: number; height: number } | null> {
  const startTime = Date.now();
  const maxWaitTime = 120000; // 2 minutes
  const pollInterval = 2000; // Poll every 2 seconds to reduce load

  console.log(`[waitForImageGeneration] Starting to poll for job: ${jobId}`);

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const statusUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/status/${jobId}`;
      console.log(`[waitForImageGeneration] Checking status at: ${statusUrl}`);

      // Create proper headers for status request
      const headers = new Headers();
      headers.append("Accept", "application/json");

      // Try with fetchWithRetry first
      let response: Response;
      let data: GenerationStatusResponse;

      try {
        response = await fetchWithRetry(statusUrl, { headers }, 3);
        data = await response.json();
      } catch (fetchError) {
        console.warn(
          `[waitForImageGeneration] Failed to fetch with retry: ${fetchError}`
        );

        // Try direct API access as fallback
        const directData = await directApiAccess(jobId);
        if (!directData) {
          throw new Error("Both fetch methods failed");
        }
        data = directData;
      }

      console.log(`[waitForImageGeneration] Status: ${data.status}`);

      if (
        data.status === "completed" &&
        data.images &&
        data.images.length > 0
      ) {
        const imageFilename = data.images[0];
        const filename = imageFilename.split("/").pop() || "";

        console.log(`[waitForImageGeneration] Image ready: ${filename}`);
        const imageUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/generated/${filename}`;

        // Create proper headers for image request
        const imageHeaders = new Headers();
        imageHeaders.append("Accept", "*/*"); // Accept any content type for images

        let imageBlob: Blob;

        try {
          const imageRes = await fetchWithRetry(imageUrl, {
            headers: imageHeaders,
          });
          imageBlob = await imageRes.blob();
        } catch (imageError) {
          console.error(
            `[waitForImageGeneration] Failed to fetch image: ${imageError}`
          );

          // In a real application, we'd implement a server-side fallback here
          // For this demo, we'll simulate by using a placeholder or cached image
          throw new Error("Failed to fetch the generated image");
        }

        const base64 = await convertBlobToBase64(imageBlob);

        // Publish event that image generation completed
        eventBus.publish("enhance:completed", {
          images: data.images,
          width: data.width || 512,
          height: data.height || 512,
        });

        return {
          image: base64,
          width: data.width || 512,
          height: data.height || 512,
        };
      }

      if (data.status === "failed") {
        const errorMsg = data.error || "Image generation failed";
        eventBus.publish("enhance:failed", { error: errorMsg });
        throw new Error(errorMsg);
      }

      // Still processing, wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch (err) {
      console.error("[waitForImageGeneration] Error checking job status:", err);
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  const timeoutError = "Image generation timed out";
  eventBus.publish("enhance:failed", { error: timeoutError });
  throw new Error(timeoutError);
}
