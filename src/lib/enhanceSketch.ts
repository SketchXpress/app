/* eslint-disable @typescript-eslint/no-explicit-any */
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
    private maxFailures: number = 7,
    private resetTimeoutMs: number = 120000
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

// Create circuit breaker for API calls with more lenient settings for network issues
const apiCircuitBreaker = new CircuitBreaker(7, 120000);

/**
 * Enhanced fetch with server failover and fallback mechanism
 */
const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  maxRetries: number = 10 // Increased for severe connection issues
): Promise<Response> => {
  let attempt = 0;

  // Longer initial timeout
  const DEFAULT_TIMEOUT = 60000;

  // Logger for debugging
  const logPrefix = `[fetchWithRetry:${url.split("/").pop()}]`;
  console.log(`${logPrefix} Starting request`);

  // Handle different API base URLs for failover
  const getAlternativeUrl = (
    originalUrl: string,
    attemptNum: number
  ): string => {
    // Extract the API endpoint path (everything after /api/)
    const isStatusEndpoint = originalUrl.includes("/api/status/");
    const isEnhanceEndpoint = originalUrl.includes("/api/enhance");

    // Only modify URLs pointing to specific API endpoints
    if (!isStatusEndpoint && !isEnhanceEndpoint) {
      return originalUrl;
    }

    // Default base URL (from the original URL)
    let baseUrl = originalUrl.split("/api/")[0];

    // Alternate between different potential API endpoints based on the attempt number
    if (attemptNum % 3 === 1) {
      // Try direct domain without subdomain
      if (baseUrl.includes("://api.")) {
        baseUrl = baseUrl.replace("://api.", "://");
      }
    } else if (attemptNum % 3 === 2) {
      // Try www subdomain
      if (!baseUrl.includes("://www.")) {
        baseUrl = baseUrl.replace("://", "://www.");
      }
    }

    // Add cache-busting parameter to avoid CDN caching
    const path = originalUrl.split("/api/")[1];
    let newUrl = `${baseUrl}/api/${path}`;

    // Add timestamp parameter to bust cache
    newUrl = `${newUrl}${newUrl.includes("?") ? "&" : "?"}_t=${Date.now()}`;

    console.log(`${logPrefix} Using alternative URL: ${newUrl}`);

    return newUrl;
  };

  // If it's a POST request with FormData, we need to ensure the FormData is recreated
  // on each attempt, as it can't be reused after being consumed
  let originalFormData: FormData | null = null;
  if (options.method === "POST" && options.body instanceof FormData) {
    // Store entries to recreate later
    originalFormData = options.body;
  }

  // Create a checker for network connectivity
  const checkConnectivity = async (): Promise<boolean> => {
    try {
      return true; // If we got a response, we have connectivity
    } catch (e) {
      console.warn(`${logPrefix} Connectivity check failed: ${e}`);
      return false; // Failed connectivity check
    }
  };

  // Function to create fresh FormData for each retry if needed
  const recreateFormData = (): FormData | null => {
    if (!originalFormData) return null;

    // Create a new FormData object
    const freshFormData = new FormData();

    // Get all entries from the original FormData
    // Note: This is a workaround because FormData is not directly iterable in all browsers
    const entries: [string, FormDataEntryValue][] = [];
    originalFormData.forEach((value, key) => {
      entries.push([key, value]);
    });

    // Add all entries to the new FormData
    for (const [key, value] of entries) {
      freshFormData.append(key, value);
    }

    return freshFormData;
  };

  // Cache for HTTP 502 Bad Gateway responses to avoid repeating the same failing request
  const badGatewayCache = new Set<string>();

  while (attempt < maxRetries) {
    let timeoutId: NodeJS.Timeout | undefined;
    let controller: AbortController | undefined;

    try {
      // If we've already had a "Failed to fetch" error, check connectivity before retrying
      if (attempt > 0) {
        const isConnected = await checkConnectivity();
        if (!isConnected) {
          console.warn(
            `${logPrefix} No network connectivity detected. Waiting longer before retry...`
          );
          // Wait longer if there's no connectivity - 5, 10, 15 seconds based on attempt
          const connectivityWait = 5000 * Math.min(attempt, 5);
          await new Promise((resolve) => setTimeout(resolve, connectivityWait));
          // Check again after waiting
          const reconnected = await checkConnectivity();
          if (!reconnected) {
            console.warn(
              `${logPrefix} Still no connectivity after waiting ${connectivityWait}ms`
            );
          } else {
            console.log(`${logPrefix} Connectivity restored after waiting`);
          }
        }
      }

      // Get potentially alternative URL based on the current attempt
      const currentUrl = attempt > 0 ? getAlternativeUrl(url, attempt) : url;

      // If this URL has already given us a 502, try a different approach
      if (badGatewayCache.has(currentUrl)) {
        console.warn(
          `${logPrefix} URL ${currentUrl} previously returned 502 Bad Gateway, trying alternative`
        );
        attempt++;
        continue;
      }

      // Setup request headers
      const headers = new Headers(options.headers || {});
      if (!headers.has("Accept")) {
        headers.set("Accept", "application/json");
      }

      // Add additional headers to prevent caching issues
      headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
      headers.set("Pragma", "no-cache");
      headers.set("Expires", "0");

      // Setup timeout and abort controller
      controller = new AbortController();
      const signal = controller.signal;

      // Exponential timeout based on retry attempt with a higher base for network issues
      const timeout = DEFAULT_TIMEOUT * Math.pow(1.5, Math.min(attempt, 4));
      timeoutId = setTimeout(() => {
        controller?.abort();
        console.warn(
          `${logPrefix} Request timed out after ${timeout}ms on attempt ${
            attempt + 1
          }`
        );
      }, timeout);

      console.log(
        `${logPrefix} Attempt ${
          attempt + 1
        }/${maxRetries} with URL: ${currentUrl}`
      );

      // If we need to recreate FormData, do it now
      let currentBody = options.body;
      if (originalFormData && attempt > 0) {
        currentBody = recreateFormData();
        console.log(`${logPrefix} Recreated FormData for retry ${attempt + 1}`);
      }

      // Execute fetch with improved options
      const response = await fetch(currentUrl, {
        ...options,
        body: currentBody,
        headers,
        signal,
        cache: "no-store",
        keepalive: true,
        // Need longer timeouts for modern browsers
        // Some browsers have more aggressive network timeouts
        credentials: "same-origin", // This helps with CORS issues
      });

      // Clear the timeout since request completed
      if (timeoutId) clearTimeout(timeoutId);

      // Handle HTTP 502 Bad Gateway specially
      if (response.status === 502) {
        // Cache this URL as returning 502 to try alternatives
        badGatewayCache.add(currentUrl);

        // If this is the original domain and we have attempts left, try an alternative
        if (attempt < maxRetries - 1) {
          console.log(`${logPrefix} Will try alternative URL on next attempt`);
          attempt++;

          // Wait longer between retries for server errors
          const serverErrorDelay = 3000 * Math.pow(1.5, Math.min(attempt, 3));
          await new Promise((resolve) => setTimeout(resolve, serverErrorDelay));

          continue;
        }

        throw new Error(
          `HTTP 502 Bad Gateway: The server is temporarily unable to handle the request`
        );
      }

      // Response validation for other error codes
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

        // Don't retry for certain status codes (4xx client errors except 429 and 408)
        if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 429 &&
          response.status !== 408
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
          } catch (e: any) {
            throw new Error(`Invalid JSON: ${e.message}`);
          }
        } catch (jsonError: any) {
          console.warn(`${logPrefix} JSON validation failed: ${jsonError}`);
          throw new Error(String(jsonError));
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
      const isNetworkError =
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("NetworkError") ||
        errorMessage.includes("network offline") ||
        errorMessage.includes("Internet disconnected") ||
        errorMessage.includes("internet connection") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("ERR_CONNECTION") ||
        errorMessage.includes("Connection closed");

      // For user aborted errors, we should probably not retry
      if (
        errorMessage.includes("user aborted") ||
        errorMessage.includes("aborted")
      ) {
        console.warn(`${logPrefix} Request was aborted. Will not retry.`);
        return Promise.reject(new Error(`Request aborted: ${errorMessage}`));
      }

      if (isNetworkError) {
        // These are likely network connectivity issues - worth retrying with longer waits
        console.warn(`${logPrefix} Network issue detected. Will retry.`);
        // For network errors, use longer backoff times
        const networkBackoff = 3000 * Math.pow(2, Math.min(attempt, 4));
        await new Promise((resolve) => setTimeout(resolve, networkBackoff));
      }

      attempt++;

      if (attempt >= maxRetries) {
        console.error(`${logPrefix} Maximum retries (${maxRetries}) exceeded`);

        // Try one last connectivity check
        const finalConnectivityCheck = await checkConnectivity();
        if (!finalConnectivityCheck) {
          return Promise.reject(
            new Error(
              `Network appears to be offline. Please check your internet connection.`
            )
          );
        }

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
 * Enhanced waitForImageGeneration function to handle connection issues with status endpoint
 */
async function waitForImageGeneration(
  jobId: string
): Promise<{ image: string; width: number; height: number } | null> {
  const startTime = Date.now();
  const maxWaitTime = 300000; // 5 minutes - increased from 3 minutes
  let pollInterval = 3000; // Start with 3s to avoid hammering the server

  let consecutiveErrors = 0;
  let lastProgress = 0;
  let alternateStatusUrls = false;

  console.log(`[waitForImageGeneration] Starting to poll for job ${jobId}`);

  // Create different status URL patterns to try when the default one fails
  const getStatusUrl = (basePattern = 0) => {
    const patterns = [
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/status/${jobId}`,
      `/api/status/${jobId}`, // Relative URL (might work better for same-origin)
      `https://api.sketchxpress.tech/api/status/${jobId}`,
      `https://sketchxpress.tech/api/status/${jobId}`,
    ];
    return patterns[basePattern % patterns.length];
  };

  while (Date.now() - startTime < maxWaitTime) {
    try {
      // Cycle through different status URL patterns if we've had connection issues
      const statusUrl = alternateStatusUrls
        ? getStatusUrl(consecutiveErrors % 4)
        : getStatusUrl(0);

      let data: GenerationStatusResponse;

      try {
        // Use circuit breaker for status checks to avoid hammering the server
        const response = await apiCircuitBreaker.execute(
          () =>
            fetchWithRetry(
              statusUrl,
              {
                headers: new Headers({
                  Accept: "application/json",
                  "Cache-Control": "no-cache, no-store, must-revalidate",
                  Pragma: "no-cache",
                  Expires: "0",
                }),
              },
              4
            ) // Small number of retries per individual call, but we keep polling
        );

        // Reset consecutive errors counter and set alternateStatusUrls to false
        if (consecutiveErrors > 0) {
          console.log(
            `[waitForImageGeneration] Successfully connected to ${statusUrl} after ${consecutiveErrors} consecutive errors`
          );
        }

        consecutiveErrors = 0;
        alternateStatusUrls = false;

        data = await response.json();
      } catch (fetchError) {
        consecutiveErrors++;
        console.error(
          `[waitForImageGeneration] Error fetching status (${consecutiveErrors}): ${fetchError}`
        );

        // Switch to trying different status URL patterns after a few errors
        if (consecutiveErrors >= 3) {
          alternateStatusUrls = true;
          console.log(
            `[waitForImageGeneration] Trying alternative status endpoints after ${consecutiveErrors} errors`
          );
        }

        // Adjust polling interval for errors to back off gradually
        pollInterval = Math.min(pollInterval * 1.5, 15000);

        // Fail fast if too many consecutive errors
        if (consecutiveErrors >= 15) {
          // Increased from 5 to 15
          const errorMsg = "Too many consecutive errors checking job status";
          eventBus.publish("enhance:failed", { error: errorMsg });
          throw new Error(errorMsg);
        }

        // Emit warning to UI
        if (consecutiveErrors % 3 === 0) {
          eventBus.publish("enhance:warning", {
            warning: `Having trouble connecting to the server. Attempting to reconnect... (Attempt ${consecutiveErrors})`,
          });
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
          pollInterval = 3000; // Default polling interval
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

        // Construct multiple potential image URLs to try
        const potentialImageUrls = [
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/generated/${filename}`,
          `/generated/${filename}`,
          `https://api.sketchxpress.tech/generated/${filename}`,
          `https://sketchxpress.tech/generated/${filename}`,
        ];

        let imageBlob: Blob | null = null;
        let imageError: Error | null = null;

        // Try each potential image URL
        for (const imageUrl of potentialImageUrls) {
          try {
            console.log(
              `[waitForImageGeneration] Trying to fetch image from ${imageUrl}`
            );

            const imageRes = await fetchWithRetry(
              imageUrl,
              {
                headers: new Headers({ Accept: "image/*" }),
              },
              3
            );

            imageBlob = await imageRes.blob();
            console.log(
              `[waitForImageGeneration] Successfully fetched image from ${imageUrl}`
            );
            break; // Exit the loop if successful
          } catch (imageFetchError) {
            console.error(
              `[waitForImageGeneration] Failed to fetch the generated image from ${imageUrl}: ${imageFetchError}`
            );
            imageError = imageFetchError as Error;
            // Continue to the next URL
          }
        }

        if (!imageBlob) {
          throw new Error(
            `Failed to fetch the generated image: ${
              imageError?.message || "Unknown error"
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

      // For certain errors, just continue polling instead of failing
      const isContinuableError =
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("NetworkError") ||
        errorMessage.includes("ERR_CONNECTION") ||
        errorMessage.includes("Connection closed") ||
        errorMessage.includes("Maximum retries exceeded");

      if (isContinuableError && Date.now() - startTime < maxWaitTime - 30000) {
        console.log(
          `[waitForImageGeneration] Continuing to poll despite error: ${errorMessage}`
        );

        // Increase consecutive errors count to try alternating URLs
        consecutiveErrors++;
        if (consecutiveErrors >= 3) {
          alternateStatusUrls = true;
        }

        // Gradually increase poll interval when encountering errors
        pollInterval = Math.min(pollInterval * 1.5, 15000);

        // Wait before next attempt
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        continue;
      }

      // Notify UI of failure for non-continuable errors
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
 * Main function to enhance a sketch with improved error handling for server issues
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

    // Check network connectivity before sending the API request
    try {
      const connectivityCheckUrl = `${
        window.location.origin
      }/favicon.ico?_t=${Date.now()}`;
      await fetch(connectivityCheckUrl, {
        method: "HEAD",
        cache: "no-store",
        mode: "no-cors",
        signal: AbortSignal.timeout(2000),
      });
    } catch (e) {
      console.warn(`[enhanceSketch] Initial connectivity check failed: ${e}`);

      // Notify user of connectivity issues
      eventBus.publish("enhance:warning", {
        warning:
          "Network connectivity issues detected. The request may fail or take longer than usual.",
      });

      // Wait a moment before trying anyway
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    // Try multiple potential API URLs if needed
    const potentialApiUrls = [
      `/api/enhance`,
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/enhance`,
      `https://api.sketchxpress.tech/api/enhance`,
      `https://sketchxpress.tech/api/enhance`,
    ];

    let enhanceResult: Response | null = null;
    let enhanceError: Error | null = null;

    // Use the circuit breaker with more attempts for the main API call
    for (const apiUrl of potentialApiUrls) {
      try {
        // Set request headers
        const headers = new Headers({
          Accept: "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        });

        console.log(`[enhanceSketch] Trying API endpoint: ${apiUrl}`);

        // Utility function to recreate form data from the original
        function recreateFormData(): FormData {
          const freshFormData = new FormData();

          freshFormData.append("sketch", imageBlob, "sketch.png");

          if (finalPrompt) {
            freshFormData.append("prompt", finalPrompt);
          }

          if (negativePrompt) {
            freshFormData.append("negative_prompt", negativePrompt);
          }

          freshFormData.append("temperature", temperature.toString());
          freshFormData.append("guidance_scale", guidanceScale.toString());
          freshFormData.append("num_images", numImages.toString());
          freshFormData.append("steps", steps.toString());

          if (seed !== null) {
            freshFormData.append("seed", seed.toString());
          }

          return freshFormData;
        }

        // Use higher maxRetries (10) for the initial submission which includes large image data
        enhanceResult = await apiCircuitBreaker.execute(async () => {
          return await fetchWithRetry(
            apiUrl,
            {
              method: "POST",
              body: recreateFormData(), // Always create fresh form data for each attempt
              headers,
            },
            10
          );
        });

        console.log(
          `[enhanceSketch] Successfully connected to API endpoint: ${apiUrl}`
        );
        break; // Exit the loop if successful
      } catch (error) {
        console.error(
          `[enhanceSketch] API request to ${apiUrl} failed: ${error}`
        );
        enhanceError = error as Error;

        // Continue to the next URL
        eventBus.publish("enhance:warning", {
          warning: `Connection to server failed. Trying alternative endpoint...`,
        });

        // Wait a bit before trying next endpoint
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (!enhanceResult) {
      // If all server endpoints failed, provide a helpful error message
      const errorMessage = enhanceError
        ? `Connection to all server endpoints failed. Please check your internet connection and try again later. Detail: ${enhanceError.message}`
        : "Connection to all server endpoints failed. Please check your internet connection and try again later.";

      console.error(
        `[enhanceSketch] All API endpoints failed: ${errorMessage}`
      );
      eventBus.publish("enhance:failed", { error: errorMessage });
      throw new Error(errorMessage);
    }

    let data;
    try {
      data = await enhanceResult.json();
    } catch (jsonError) {
      console.error(
        `[enhanceSketch] Failed to parse API response as JSON: ${jsonError}`
      );
      throw new Error(`Failed to parse API response: ${jsonError}`);
    }

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

    // Handle 502 Bad Gateway specially with a more user-friendly message
    if (errorMessage.includes("502") || errorMessage.includes("Bad Gateway")) {
      eventBus.publish("enhance:failed", {
        error:
          "The server is temporarily unavailable (Error 502). This usually means the server is under maintenance or experiencing high load. Please try again in a few minutes.",
      });
    } else {
      eventBus.publish("enhance:failed", { error: errorMessage });
    }

    throw error;
  }
}
