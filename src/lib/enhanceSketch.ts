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

  while (attempt < maxRetries) {
    try {
      console.log(
        `[fetchWithRetry] Attempt ${attempt + 1}/${maxRetries} for URL: ${url}`
      );

      // Handle headers properly for TypeScript
      const headers = new Headers(options.headers || {});
      if (!headers.has("Accept")) {
        headers.set("Accept", "application/json");
      }

      const response = await fetch(url, {
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

      const res = await fetchWithRetry(statusUrl, { headers });

      const data: GenerationStatusResponse = await res.json();
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

        const imageRes = await fetchWithRetry(imageUrl, {
          headers: imageHeaders,
        });

        const blob = await imageRes.blob();
        const base64 = await convertBlobToBase64(blob);

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
