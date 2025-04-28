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

// CORS Proxy function to bypass CORS issues with ngrok
const getProxiedUrl = (url: string): string => {
  // Use a CORS proxy to bypass CORS issues
  return `https://corsproxy.io/?${encodeURIComponent(url)}`;
};

// Improved fetch function with CORS handling
const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<Response> => {
  let attempt = 0;

  // Use proxy for the URL to avoid CORS issues
  const proxiedUrl = getProxiedUrl(url);

  while (attempt < maxRetries) {
    try {
      const headers = new Headers(options.headers || {});
      if (!headers.has("Accept")) {
        headers.set("Accept", "application/json");
      }

      const response = await fetch(proxiedUrl, {
        ...options,
        headers,
        mode: "cors",
      });

      if (!response.ok) {
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

          if (text.includes("<!DOCTYPE html>") || text.includes("<html")) {
            attempt++;
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            continue;
          }

          if (contentType.includes("application/json")) {
            JSON.parse(text);
          }
        } catch {
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }

      return response;
    } catch {
      attempt++;

      if (attempt >= maxRetries) {
        throw new Error("Maximum retries exceeded");
      }

      // Exponential backoff
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
    } catch {
      // Even if placing image fails, return job_id for RightPanel
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
  const maxWaitTime = 120000; // 2 minutes
  const pollInterval = 2000; // Poll every 2 seconds

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const statusUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/status/${jobId}`;

      const headers = new Headers();
      headers.append("Accept", "application/json");

      let data: GenerationStatusResponse;

      try {
        const response = await fetchWithRetry(statusUrl, { headers }, 3);
        data = await response.json();
      } catch {
        // Wait before next poll attempt
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
        imageHeaders.append("Accept", "*/*");

        let imageBlob: Blob;

        try {
          const imageRes = await fetchWithRetry(imageUrl, {
            headers: imageHeaders,
          });
          imageBlob = await imageRes.blob();
        } catch {
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
    } catch {
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  const timeoutError = "Image generation timed out";
  eventBus.publish("enhance:failed", { error: timeoutError });
  throw new Error(timeoutError);
}
