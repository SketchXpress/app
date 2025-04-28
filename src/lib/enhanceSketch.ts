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

export async function enhanceSketch(editor: Editor) {
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

    // Send image to backend
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/generate`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || "API error during enhancement.");
    }

    const { job_id } = await res.json();

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

// Keep the existing waitForImageGeneration function which works well
async function waitForImageGeneration(
  jobId: string
): Promise<{ image: string; width: number; height: number } | null> {
  const startTime = Date.now();
  const maxWaitTime = 120000; // 2 minutes
  const pollInterval = 1000; // 1 second between polls

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/status/${jobId}`
      );

      if (!res.ok) {
        throw new Error("Failed to check job status");
      }

      const data = await res.json();

      if (
        data.status === "completed" &&
        data.images &&
        data.images.length > 0
      ) {
        // Get the first generated image filename
        const imageFilename = data.images[0];

        // Correctly extract filename
        const filename = imageFilename.split("/").pop() || "";

        // Fetch the actual image
        const imageRes = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/generated/${filename}`
        );

        const blob = await imageRes.blob();
        const base64 = await convertBlobToBase64(blob);

        // Publish event for all generated images
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

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch (err) {
      console.error("Error checking job status:", err);
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  const timeoutError = "Image generation timed out";
  eventBus.publish("enhance:failed", { error: timeoutError });
  throw new Error(timeoutError);
}
