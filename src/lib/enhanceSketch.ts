import { Editor, getSvgAsImage } from "@tldraw/tldraw";
import { extractPromptFromSelection } from "./extractPromptFromSelection";
import { convertBlobToBase64 } from "./convertBlobToBase64";
import { useEnhanceStore } from "@/stores/enhanceStore";
import { eventBus } from "./events";

type SvgResult = {
  svg: string;
  width: number;
  height: number;
} | null | undefined;

const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  maxRetries = 3
): Promise<Response> => {
  const tcpUrl = `${url}${url.includes('?') ? '&' : '?'}_tcp=1&_t=${Date.now()}`;
  const headers = new Headers({
    ...options.headers,
    'Cache-Control': 'no-store',
    'Connection': 'keep-alive'
  });

  console.debug("[Network] Initiating request to:", tcpUrl);
  console.debug("[Network] Request options:", {
    method: options.method,
    headers: Object.fromEntries(headers.entries()),
    body: options.body instanceof FormData ? 
      Array.from(options.body.entries()) : options.body
  });

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      const response = await fetch(tcpUrl, {
        ...options,
        headers,
        keepalive: true,
        cache: 'no-store'
      });
      
      console.debug(`[Network] Attempt ${attempt + 1}/${maxRetries}:`);
      console.debug(`  Status: ${response.status} ${response.statusText}`);
      console.debug(`  Time: ${Date.now() - startTime}ms`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Failed to read error body');
        console.error("[Network] Server error response:", errorText);
        throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 100)}`);
      }

      return response;

    } catch (error) {
      console.error(`[Network] Attempt ${attempt + 1} failed:`, error);
      
      if (attempt >= maxRetries - 1) {
        console.error("[Network] All retries exhausted");
        throw error;
      }
      
      const delay = 1000 * Math.pow(2, attempt);
      console.debug(`[Network] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Max retries exceeded");
};

async function base64ToBlob(base64: string, mimeType: string): Promise<Blob> {
  console.debug("[Conversion] Starting base64 to blob conversion");
  const response = await fetch(`data:${mimeType};base64,${base64}`);
  if (!response.ok) throw new Error("Base64 conversion failed");
  return response.blob();
}

export async function enhanceSketch(editor: Editor): Promise<string> {
  console.debug("[Enhance] Starting enhancement process");
  
  try {
    const shapes = editor.getSelectedShapes();
    if (!shapes.length) throw new Error("No shapes selected");
    console.debug("[Enhance] Selected shapes:", shapes.length);

    // SVG Generation
    const svgData = await editor.getSvgString(shapes, { 
      background: true,
      scale: 1
    });
    console.debug("[Enhance] SVG Data:", svgData ? "Received" : "Missing");

    if (!svgData?.svg || !svgData.width || !svgData.height) {
      throw new Error("SVG generation failed - invalid dimensions");
    }
    console.debug("[Enhance] SVG Dimensions:", 
      `${svgData.width}x${svgData.height}`);

    // PNG Conversion
    let blob = await getSvgAsImage(svgData.svg, {
      width: svgData.width,
      height: svgData.height,
      type: "png"
    });
    
    if (!blob) {
      console.warn("[Enhance] Primary PNG conversion failed, trying fallback");
      blob = await getSvgAsImage(svgData.svg, {
        type: "png",
        width: 512,
        height: 512
      });
    }
    
    if (!blob) throw new Error("PNG conversion failed");
    console.debug("[Enhance] PNG Blob:", blob.size + " bytes");

    // File Preparation
    const storeParams = useEnhanceStore.getState();
    const formData = new FormData();
    
    try {
      const base64 = await convertBlobToBase64(blob);
      console.debug("[Conversion] Base64 length:", base64.length);
      
      const sketchBlob = await base64ToBlob(base64, "image/png");
      formData.append("sketch", sketchBlob, "sketch.png");
      console.debug("[FormData] Sketch image added");
    } catch (error) {
      console.error("[Conversion] File conversion failed:", error);
      throw new Error(`File conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Parameters handling
    const params = {
      prompt: storeParams.prompt || extractPromptFromSelection(editor) || "enhance sketch",
      negative_prompt: storeParams.negativePrompt || "",
      temperature: storeParams.temperature ?? 0.7,
      guidance_scale: storeParams.guidanceScale ?? 7.5,
      num_images: storeParams.numImages ?? 1,
      steps: storeParams.steps ?? 20,
      seed: storeParams.seed ?? Date.now()
    };

    Object.entries(params).forEach(([key, val]) => {
      formData.append(key, val.toString());
    });
    console.debug("[FormData] Parameters:", Object.entries(params));

    // API Request
    console.debug("[API] Sending request to backend");
    const apiUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/generate`;
    const response = await fetchWithRetry(apiUrl, { 
      method: "POST", 
      body: formData 
    });

    const responseData = await response.json();
    console.debug("[API] Response received:", responseData);
    
    if (!responseData?.job_id) {
      throw new Error("Invalid API response format - missing job_id");
    }

    console.debug("[Enhance] Job started successfully:", responseData.job_id);
    eventBus.publish("enhance:started", { jobId: responseData.job_id });
    return responseData.job_id;

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Enhance] Critical error:", message, error);
    eventBus.publish("enhance:failed", { error: message });
    throw new Error(`Enhancement failed: ${message}`);
  }
}
