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

/**
 * Circuit breaker implementation to prevent hammering failing services
 */
class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private isOpen: boolean = false;

  constructor(
    private maxFailures: number = 5,
    private resetTimeoutMs: number = 30000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open (too many failures)
    if (this.isOpen) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;

      // Allow retry after timeout
      if (timeSinceLastFailure > this.resetTimeoutMs) {
        this.isOpen = false;
        this.failures = 0;
        console.log("[CircuitBreaker] Circuit reset after cooling period");
      } else {
        return Promise.reject(
          new Error(
            `Circuit breaker is open. Try again in ${Math.ceil(
              (this.resetTimeoutMs - timeSinceLastFailure) / 1000
            )} seconds`
          )
        );
      }
    }

    try {
      const result = await fn();
      // Reset failures on success
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.maxFailures) {
        this.isOpen = true;
        console.warn(
          `[CircuitBreaker] Circuit opened after ${this.failures} failures`
        );
      }

      throw error;
    }
  }
}

// Create a global circuit breaker for API calls
const apiCircuitBreaker = new CircuitBreaker(5, 60000);

/**
 * Enhanced fetch with robust retry mechanism
 */
const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  maxRetries: number = 5
): Promise<Response> => {
  let attempt = 0;

  // Longer initial timeout
  const DEFAULT_TIMEOUT = 45000;

  // Logger for debugging
  const logPrefix = `[fetchWithRetry:${url.split("/").pop()}]`;
  console.log(`${logPrefix} Starting request`);

  while (attempt < maxRetries) {
    let timeoutId: NodeJS.Timeout | undefined;
    let controller: AbortController | undefined;

    try {
      // Setup request headers
      const headers = new Headers(options.headers || {});
      if (!headers.has("Accept")) {
        headers.set("Accept", "application/json");
      }

      // Setup timeout and abort controller
      controller = new AbortController();
      const signal = controller.signal;

      // Exponential timeout based on retry attempt
      const timeout = DEFAULT_TIMEOUT * Math.pow(1.5, attempt);
      timeoutId = setTimeout(() => {
        controller?.abort();
        console.warn(
          `${logPrefix} Request timed out after ${timeout}ms on attempt ${
            attempt + 1
          }`
        );
      }, timeout);

      console.log(`${logPrefix} Attempt ${attempt + 1}/${maxRetries}`);

      // Execute fetch with improved options
      const response = await fetch(url, {
        ...options,
        headers,
        signal,
        cache: "no-store",
        keepalive: true,
        // Add a random query param to bust cache if retry attempt > 0
        ...(attempt > 0
          ? {
              url: `${url}${url.includes("?") ? "&" : "?"}_t=${Date.now()}`,
            }
          : {}),
      });

      // Clear the timeout since request completed
      if (timeoutId) clearTimeout(timeoutId);

      // Response validation
      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `${logPrefix} Error response: ${response.status} - ${errorText}`
        );

        // Special handling for rate limiting (429)
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const retryDelay = retryAfter ? parseInt(retryAfter) * 1000 : 10000;
          console.warn(
            `${logPrefix} Rate limited. Waiting ${retryDelay}ms before retry`
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          continue;
        }

        // Don't retry for certain status codes (4xx client errors except 429)
        if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 429
        ) {
          return Promise.reject(
            new Error(`HTTP error ${response.status}: ${errorText}`)
          );
        }

        throw new Error(`HTTP error ${response.status}`);
      }

      // Validate JSON response if expected
      const contentType = response.headers.get("content-type") || "";
      if (
        contentType.includes("application/json") ||
        headers.get("Accept") === "application/json"
      ) {
        try {
          const clonedResponse = response.clone();
          const text = await clonedResponse.text();

          // Skip empty responses
          if (text.trim() === "") {
            console.warn(`${logPrefix} Empty response received`);
            return response;
          }

          // Check if response looks like HTML
          if (
            text.trim().startsWith("<!DOCTYPE html>") ||
            text.trim().startsWith("<html")
          ) {
            throw new Error("Received HTML instead of expected JSON");
          }

          // Validate JSON parsing
          try {
            JSON.parse(text);
          } catch (e: unknown) {
            if (e instanceof Error) {
              throw new Error(`Invalid JSON: ${e.message}`);
            } else {
              throw new Error(`Invalid JSON: An unknown error occurred`);
            }
          }
        } catch (jsonError) {
          console.warn(`${logPrefix} JSON validation failed: ${jsonError}`);
          throw jsonError;
        }
      }

      console.log(`${logPrefix} Request successful on attempt ${attempt + 1}`);
      return response;
    } catch (error) {
      // Clear any pending timeout
      if (timeoutId) clearTimeout(timeoutId);

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `${logPrefix} Attempt ${attempt + 1} failed: ${errorMessage}`
      );

      // Check if we should stop retrying
      if (
        errorMessage.includes("user aborted") ||
        errorMessage.includes("network offline") ||
        errorMessage.includes("Failed to fetch")
      ) {
        // These are likely network connectivity issues - worth retrying
        console.warn(`${logPrefix} Network issue detected. Will retry.`);
      }

      attempt++;

      if (attempt >= maxRetries) {
        console.error(`${logPrefix} Maximum retries (${maxRetries}) exceeded`);
        return Promise.reject(
          new Error(`Maximum retries exceeded: ${errorMessage}`)
        );
      }

      // Improved backoff strategy with jitter for better distribution
      const baseDelay = 1000 * Math.pow(2, attempt - 1); // Exponential backoff
      const jitter = Math.random() * 1000; // Add up to 1s of random jitter
      const delay = baseDelay + jitter;

      console.log(`${logPrefix} Retrying in ${Math.round(delay)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return Promise.reject(new Error("Maximum retries exceeded"));
};

/**
 * Type definitions for API responses
 */
type GenerationStatusResponse = {
  status: string;
  progress?: number;
  images?: string[];
  width?: number;
  height?: number;
  error?: string;
};

/**
 * Enhanced function to wait for image generation to complete
 */
async function waitForImageGeneration(
  jobId: string
): Promise<{ image: string; width: number; height: number } | null> {
  const startTime = Date.now();
  const maxWaitTime = 180000; // 3 minutes
  let pollInterval = 2000; // Start with 2s, will adjust based on progress

  let consecutiveErrors = 0;
  let lastProgress = 0;

  console.log(`[waitForImageGeneration] Starting to poll for job ${jobId}`);

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const statusUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/status/${jobId}`;

      let data: GenerationStatusResponse;

      try {
        // Use circuit breaker for status checks to avoid hammering the server
        const response = await apiCircuitBreaker.execute(() =>
          fetchWithRetry(
            statusUrl,
            {
              headers: new Headers({ Accept: "application/json" }),
            },
            3
          )
        );

        data = await response.json();

        // Reset error counter on successful response
        consecutiveErrors = 0;
      } catch (fetchError) {
        consecutiveErrors++;
        console.error(
          `[waitForImageGeneration] Error fetching status (${consecutiveErrors}): ${fetchError}`
        );

        // Adjust polling interval for errors to back off gradually
        pollInterval = Math.min(pollInterval * 1.5, 10000);

        // Fail fast if too many consecutive errors
        if (consecutiveErrors >= 5) {
          const errorMsg = "Too many consecutive errors checking job status";
          eventBus.publish("enhance:failed", { error: errorMsg });
          throw new Error(errorMsg);
        }

        // Wait before next attempt
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        continue;
      }

      // Handle progress updates
      if (data.progress !== undefined && data.progress !== lastProgress) {
        lastProgress = data.progress;
        eventBus.publish("enhance:progress", { progress: data.progress });

        // Adjust polling frequency based on progress (more frequent near completion)
        if (data.progress > 90) {
          pollInterval = 1000; // Poll faster when almost done
        } else if (data.progress > 60) {
          pollInterval = 1500;
        } else {
          pollInterval = 2000; // Default polling interval
        }
      }

      // Handle completed status
      if (
        data.status === "completed" &&
        data.images &&
        data.images.length > 0
      ) {
        const imageFilename = data.images[0];
        const filename = imageFilename.split("/").pop() || "";

        const imageUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/generated/${filename}`;

        let imageBlob: Blob;

        try {
          const imageRes = await fetchWithRetry(
            imageUrl,
            {
              headers: new Headers({ Accept: "image/*" }),
            },
            3
          );

          imageBlob = await imageRes.blob();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (imageFetchError: any) {
          console.error(
            `[waitForImageGeneration] Failed to fetch the generated image: ${imageFetchError}`
          );
          throw new Error(
            `Failed to fetch the generated image: ${
              (imageFetchError as Error).message
            }`
          );
        }

        const base64 = await convertBlobToBase64(imageBlob);

        // Publish event that image generation completed
        eventBus.publish("enhance:completed", {
          images: data.images,
          width: data.width || 512,
          height: data.height || 512,
        });

        console.log(
          `[waitForImageGeneration] Successfully completed job ${jobId}`
        );

        return {
          image: base64,
          width: data.width || 512,
          height: data.height || 512,
        };
      }

      // Handle failed status
      if (data.status === "failed") {
        const errorMsg = data.error || "Image generation failed";
        console.error(
          `[waitForImageGeneration] Job ${jobId} failed: ${errorMsg}`
        );
        eventBus.publish("enhance:failed", { error: errorMsg });
        throw new Error(errorMsg);
      }

      // For in-progress or pending status, wait and continue polling
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch (error) {
      // Catch errors from within the loop
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[waitForImageGeneration] Error: ${errorMessage}`);

      // Notify UI of failure
      if (!errorMessage.includes("Too many consecutive errors")) {
        eventBus.publish("enhance:failed", { error: errorMessage });
      }

      throw error;
    }
  }

  // Loop timed out
  const timeoutError = `Image generation timed out after ${
    maxWaitTime / 1000
  } seconds`;
  console.error(`[waitForImageGeneration] Job ${jobId} timed out`);
  eventBus.publish("enhance:failed", { error: timeoutError });
  throw new Error(timeoutError);
}

/**
 * Main function to enhance a sketch
 */
export async function enhanceSketch(editor: Editor): Promise<string> {
  try {
    console.log("[enhanceSketch] Starting enhancement process");

    // Validate selection
    const shapes = editor.getSelectedShapes();
    if (shapes.length === 0) {
      const error = "No shapes selected.";
      eventBus.publish("enhance:failed", { error });
      throw new Error(error);
    }

    // Generate SVG from selection
    const results = await editor.getSvgString(shapes, {
      background: true,
      scale: 1,
    });

    if (!results) {
      const error = "Failed to generate SVG from selection.";
      eventBus.publish("enhance:failed", { error });
      throw new Error(error);
    }

    const { svg, width, height } = results;

    // Convert SVG to PNG
    const blob = await getSvgAsImage(svg, {
      width,
      height,
      type: "png",
      quality: 0.9,
      pixelRatio: 1,
    });

    if (!blob) {
      const error = "Failed to convert SVG to PNG.";
      eventBus.publish("enhance:failed", { error });
      throw new Error(error);
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
    const apiUrl = `/api/enhance`;

    // Use the circuit breaker for the enhance API call
    const enhanceResult = await apiCircuitBreaker.execute(async () => {
      const headers = new Headers();
      headers.append("Accept", "application/json");

      try {
        console.log("[enhanceSketch] Sending sketch to API");
        return await fetchWithRetry(
          apiUrl,
          {
            method: "POST",
            body: formData,
            headers,
          },
          3
        );
      } catch (error) {
        console.error(`[enhanceSketch] API request failed: ${error}`);
        throw error;
      }
    });

    const data = await enhanceResult.json();
    const { job_id } = data;

    if (!job_id) {
      throw new Error("No job ID received from API");
    }

    console.log(`[enhanceSketch] Job created with ID: ${job_id}`);

    // Publish event for RightPanel to start monitoring the job
    eventBus.publish("enhance:started", { jobId: job_id });

    // For backward compatibility, also wait for the image and place on canvas
    try {
      console.log(`[enhanceSketch] Waiting for image generation to complete`);
      const result = await waitForImageGeneration(job_id);

      if (!result) {
        throw new Error("No enhanced image received.");
      }

      const { image, width: w, height: h } = result;

      const bounds = editor.getSelectionPageBounds();
      if (!bounds) {
        throw new Error("Could not get selection bounds.");
      }

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
      console.log(`[enhanceSketch] Successfully placed image on canvas`);
    } catch (placementError) {
      console.error(
        `[enhanceSketch] Failed to place image on canvas: ${placementError}`
      );
      // Don't rethrow - if the job_id is valid we still want to return it
      // so the UI can continue polling for status
    }

    return job_id;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[enhanceSketch] Fatal error: ${errorMessage}`);
    eventBus.publish("enhance:failed", { error: errorMessage });
    throw error;
  }
}
