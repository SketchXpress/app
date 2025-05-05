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

type GenerationStatusResponse = {
  status: string;
  images?: string[];
  width?: number;
  height?: number;
  error?: string;
};

const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<Response> => {
  let attempt = 0;
  const urlObj = new URL(url);
  
  // Protocol busting with random fingerprint
  urlObj.searchParams.set("_fp", 
    `${Date.now()}_${Math.random().toString(36).slice(2,8)}`);

  while (attempt < maxRetries) {
    try {
      const headers = new Headers(options.headers || {});
      headers.set("Accept", "application/json");
      
      // Force HTTP/1.1 connections
      headers.set("Alt-Used", "disable");
      headers.set("Connection", "close");
      headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
      headers.set("Pragma", "no-cache");

      const response = await fetch(urlObj.toString(), {
        ...options,
        headers,
        cache: "no-store",
        referrerPolicy: "no-referrer",
        keepalive: false
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get("Retry-After") || "5", 10);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        }
        throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 100)}`);
      }

      // Validate JSON response structure
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const clone = response.clone();
        await clone.json(); // Force JSON parse
      }

      return response;
    } catch (error: unknown) {
      attempt++;
      if (attempt >= maxRetries) {
        throw new Error(`Request failed after ${maxRetries} attempts: ${
          error instanceof Error ? error.message : String(error)
        }`);
      }
      
      // Exponential backoff with jitter
      await new Promise(resolve => 
        setTimeout(resolve, 1000 * Math.pow(2, attempt) + Math.random() * 500));
    }
  }
  throw new Error("Maximum retries exceeded");
};

const base64ToBlob = async (base64: string, mimeType: string): Promise<Blob> => {
  try {
    const res = await fetch(`data:${mimeType};base64,${base64}`);
    return await res.blob();
  } catch {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return new Blob([bytes], { type: mimeType });
  }
};

export async function enhanceSketch(editor: Editor): Promise<string> {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backendUrl?.startsWith('http')) {
      const errorMsg = "Invalid backend configuration";
      eventBus.publish("enhance:failed", { error: errorMsg });
      throw new Error(errorMsg);
    }

    const shapes = editor.getSelectedShapes();
    if (!shapes.length) throw new Error("No selection");

    // Get SVG with null check
    const results = await editor.getSvgString(shapes);
    if (!results?.svg) throw new Error("SVG generation failed");
    const { svg, width, height } = results;

    // Convert to PNG with non-null assertions
    const blob = await getSvgAsImage(svg, { 
      width: width!, 
      height: height!, 
      type: "png" 
    });
    if (!blob) throw new Error("PNG conversion failed");

    const imageBase64 = await convertBlobToBase64(blob);
    const imageBlob = await base64ToBlob(imageBase64, "image/png");

    // Build form data with type-safe append
    const formData = new FormData();
    formData.append("sketch", imageBlob, "sketch.png");

    const { 
      prompt: userPrompt,
      negativePrompt,
      temperature,
      guidanceScale,
      numImages,
      steps,
      seed 
    } = useEnhanceStore.getState();
    
    const finalPrompt = userPrompt || extractPromptFromSelection(editor);
    if (finalPrompt) formData.append("prompt", finalPrompt);
    if (negativePrompt) formData.append("negative_prompt", negativePrompt);
    
    // Type-safe parameter appending
    // Strictly typed parameter appending
    [
      [temperature, "temperature"],
      [guidanceScale, "guidance_scale"],
      [numImages, "num_images"],
      [steps, "steps"],
      [seed, "seed"]
    ].forEach(([value, key]) => {
      // Explicit null check - this ensures TypeScript knows value isn't null
      if (value !== null && value !== undefined && typeof key === 'string') {
        formData.append(key, String(value));
      }      
    });
    


    eventBus.publish("enhance:started", { jobId: null });
    
    // Execute enhanced fetch
    const response = await fetchWithRetry(`${backendUrl}/api/generate`, {
      method: "POST",
      body: formData,
      headers: new Headers({ "Accept": "application/json" })
    });

    const { job_id } = await response.json();
    eventBus.publish("enhance:started", { jobId: job_id });

    // Image placement with proper asset creation
    try {
      const result = await waitForImageGeneration(job_id);
      if (result) {
        const { image, width: w, height: h } = result;
        const bounds = editor.getSelectionPageBounds();
        
        if (bounds) {
          const assetId = AssetRecordType.createId();
          
          // Create asset with required meta field
          editor.createAssets([{
            id: assetId,
            type: "image",
            typeName: "asset",
            props: {
              name: "enhanced.png",
              src: `data:image/png;base64,${image}`,
              w, 
              h,
              mimeType: "image/png",
              isAnimated: false
            },
            meta: {} // Required by TLAsset type
          }]);
          
          // Create image shape
          editor.createShape<TLImageShape>({
            id: createShapeId(),
            type: "image",
            x: bounds.maxX + 60,
            y: bounds.maxY - h/2,
            props: { 
              assetId, 
              w, 
              h 
            }
          });
        }
      }
    } catch (placementError) {
      console.error("Image placement failed:", placementError);
    }

    return job_id;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    eventBus.publish("enhance:failed", { error: message });
    throw error;
  }
}

async function waitForImageGeneration(jobId: string) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backendUrl?.startsWith('http')) throw new Error("Invalid backend URL");

  const start = Date.now();
  let pollInterval = 2000;

  while (Date.now() - start < 120000) {
    try {
      const response = await fetchWithRetry(`${backendUrl}/api/status/${jobId}`);
      const data: GenerationStatusResponse = await response.json();

      if (data.status === "completed" && data.images?.[0]) {
        const imageUrl = `${backendUrl}/generated/${data.images[0]}?_t=${Date.now()}`;
        const imageRes = await fetchWithRetry(imageUrl);
        const blob = await imageRes.blob();
        
        return {
          image: await convertBlobToBase64(blob),
          width: data.width || 512,
          height: data.height || 512
        };
      }

      if (data.status === "failed") {
        throw new Error(data.error || "Generation failed");
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      pollInterval = Math.min(pollInterval * 1.5, 10000);
    } catch (error) {
      if (Date.now() - start >= 120000) {
        throw new Error("Generation timed out");
      }
    }
  }
  throw new Error("Processing timeout");
}
