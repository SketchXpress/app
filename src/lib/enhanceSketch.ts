import {
  Editor,
  AssetRecordType,
  getSvgAsImage,
  createShapeId,
  TLImageShape,
} from "@tldraw/tldraw";
import { extractPromptFromSelection } from "./extractPromptFromSelection";
import { convertBlobToBase64 } from "./convertBlobToBase64";

export async function enhanceSketch(editor: Editor) {
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

  // Optional text from shapes as prompt
  const prompt = extractPromptFromSelection(editor);

  // Convert base64 to blob for FormData
  const binaryString = atob(image_base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const imageBlob = new Blob([bytes], { type: "image/png" });

  // Create FormData and append sketch and prompt
  const formData = new FormData();
  formData.append("sketch", imageBlob, "sketch.png"); // ✅ Correct field name
  if (prompt) {
    formData.append("prompt", prompt);
  }

  // Send image to backend
  const res = await fetch("http://localhost:8000/api/generate", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "API error during enhancement.");
  }

  const { job_id } = await res.json();

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
        src: `data:image/png;base64,${image}`, // ✅
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
}

async function waitForImageGeneration(
  jobId: string
): Promise<{ image: string; width: number; height: number } | null> {
  const startTime = Date.now();
  const maxWaitTime = 120000; // 2 minutes
  const pollInterval = 1000; // 1 second between polls

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const res = await fetch(`http://localhost:8000/api/status/${jobId}`);

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

        // ✅ Correctly extract filename
        const filename = imageFilename.split("/").pop() || "";

        // Fetch the actual image
        const imageRes = await fetch(
          `http://localhost:8000/generated/${filename}`
        );
        const blob = await imageRes.blob();
        const base64 = await convertBlobToBase64(blob);

        return {
          image: base64,
          width: data.width || 512,
          height: data.height || 512,
        };
      }

      if (data.status === "failed") {
        throw new Error(data.error || "Image generation failed");
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch (err) {
      console.error("Error checking job status:", err);
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  throw new Error("Image generation timed out");
}
