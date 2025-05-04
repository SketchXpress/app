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

const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<Response> => {
  let attempt = 0;

  const directUrl = url;

  while (attempt < maxRetries) {
    try {
      const headers = new Headers(options.headers || {});
      if (!headers.has("Accept")) {
        headers.set("Accept", "application/json");
      }

      // Force TCP by setting the appropriate signal options
      const controller = new AbortController();
      const signal = controller.signal;

      // Set timeout to prevent idle timeout issues (30 seconds)
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      // Fetch directly from the URL with TCP options
      const response = await fetch(directUrl, {
        ...options,
        headers,
        signal,
        // Force HTTP/1.1 instead of HTTP/2 or HTTP/3 (which might use QUIC)
        cache: "no-store",
        keepalive: true,
      });

      // Clear the timeout
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[fetchWithRetry] Error response body: ${errorText}`);
        throw new Error(`HTTP error ${response.status}`);
      }

      // Check if we got JSON when expecting it
      const contentType = response.headers.get("content-type") || "";
      const acceptHeader = headers.get("Accept") || "";

      if (
        contentType.includes("application/json") ||
        acceptHeader === "application/json"
      ) {
        try {
          const clonedResponse = response.clone();
          const text = await clonedResponse.text();

          // Basic check if response looks like HTML (could indicate an error page)
          if (
            text.trim().startsWith("<!DOCTYPE html>") ||
            text.trim().startsWith("<html")
          ) {
            console.warn(
              `[fetchWithRetry] Received HTML instead of expected JSON from ${directUrl}. Retrying...`
            );
            attempt++;
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            continue;
          }

          // Ensure it's valid JSON if content type indicates it
          if (contentType.includes("application/json")) {
            JSON.parse(text);
          }
        } catch (jsonError) {
          console.warn(
            `[fetchWithRetry] Failed to parse JSON response from ${directUrl}. Error: ${jsonError}. Retrying...`
          );
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }

      return response;
    } catch (error) {
      console.error(
        `[fetchWithRetry] Attempt ${
          attempt + 1
        } failed for URL: ${directUrl}. Error: ${error}`
      );
      attempt++;

      if (attempt >= maxRetries) {
        throw new Error("Maximum retries exceeded");
      }

      // Exponential backoff
      const delay = 1000 * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
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

    // Get API URL and prepare request
    const apiUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/generate`;
    const headers = new Headers();
    headers.append("Accept", "application/json");

    const res = await fetchWithRetry(apiUrl, {
      method: "POST",
      body: formData,
      headers,
    });

    const data = await res.json();
    const { job_id } = data;

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
    } catch (placementError) {
      console.error(
        `[enhanceSketch] Failed to place image on canvas: ${placementError}`
      );
    }

    return job_id;
  } catch (error) {
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
  const maxWaitTime = 120000;
  const pollInterval = 2000;

  while (Date.now() - startTime < maxWaitTime) {
    try {
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
        // Waiting before next poll attempt
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        continue;
      }

      if (
        data.status === "completed" &&
        data.images &&
        data.images.length > 0
      ) {
        const imageFilename = data.images[0];
        const filename = imageFilename.split("/").pop() || "";

        const imageUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/generated/${filename}`;

        const imageHeaders = new Headers();
        imageHeaders.append("Accept", "image/*");

        let imageBlob: Blob;

        try {
          const imageRes = await fetchWithRetry(imageUrl, {
            headers: imageHeaders,
          });
          imageBlob = await imageRes.blob();
        } catch (imageFetchError) {
          console.error(
            `[waitForImageGeneration] Failed to fetch the generated image from ${imageUrl}: ${imageFetchError}`
          );
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
        console.error(
          `[waitForImageGeneration] Job ${jobId} failed: ${errorMsg}`
        );
        eventBus.publish("enhance:failed", { error: errorMsg });
        throw new Error(errorMsg);
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch (error) {
      // Catch errors from within the loop (e.g., failed status, failed image fetch)
      console.error(
        `[waitForImageGeneration] Error during polling loop for job ${jobId}: ${error}. Retrying...`
      );
      // Wait before retrying the loop
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
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
