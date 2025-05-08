import localforage from "localforage";

// Initialize once
const initStorage = () => {
  localforage.config({
    name: "SketchXpress",
    storeName: "canvas",
    description: "SketchXpress Canvas Storage",
  });
};

// Run initialization
initStorage();

export interface CanvasMetadata {
  timestamp: number;
  preview?: string;
  name: string;
}

export const canvasStorage = {
  /**
   * Save the current canvas state
   */
  saveCanvas: async (
    snapshot: unknown,
    name: string = "current"
  ): Promise<boolean> => {
    try {
      const metadata: CanvasMetadata = {
        timestamp: Date.now(),
        name,
      };

      // First save the metadata separately (fast)
      await localforage.setItem(`canvas-meta:${name}`, metadata);

      // Then save the actual canvas data (potentially larger/slower)
      await localforage.setItem(`canvas:${name}`, snapshot);

      return true;
    } catch (err) {
      console.error("Failed to save canvas:", err);
      return false;
    }
  },

  /**
   * Load canvas by name
   */
  loadCanvas: async (name: string = "current"): Promise<unknown> => {
    try {
      const snapshot = await localforage.getItem(`canvas:${name}`);
      return snapshot;
    } catch (err) {
      console.error("Failed to load canvas:", err);
      return null;
    }
  },

  /**
   * Get list of saved canvases with metadata
   */
  getSavedCanvases: async (): Promise<CanvasMetadata[]> => {
    try {
      const keys = await localforage.keys();
      const metaKeys = keys.filter((key) => key.startsWith("canvas-meta:"));

      const canvases: CanvasMetadata[] = [];
      for (const key of metaKeys) {
        const metadata = await localforage.getItem(key);
        if (metadata) {
          canvases.push(metadata as CanvasMetadata);
        }
      }

      // Sort by most recent first
      return canvases.sort((a, b) => b.timestamp - a.timestamp);
    } catch (err) {
      console.error("Failed to get saved canvases:", err);
      return [];
    }
  },

  /**
   * Delete a saved canvas
   */
  deleteCanvas: async (name: string): Promise<boolean> => {
    try {
      await localforage.removeItem(`canvas:${name}`);
      await localforage.removeItem(`canvas-meta:${name}`);
      return true;
    } catch (err) {
      console.error("Failed to delete canvas:", err);
      return false;
    }
  },

  /**
   * Add a thumbnail preview to a canvas
   */
  saveCanvasPreview: async (
    name: string,
    previewBase64: string
  ): Promise<boolean> => {
    try {
      const metadata = await localforage.getItem(`canvas-meta:${name}`);
      if (metadata) {
        const updatedMetadata = {
          ...(metadata as CanvasMetadata),
          preview: previewBase64,
        };
        await localforage.setItem(`canvas-meta:${name}`, updatedMetadata);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to save canvas preview:", err);
      return false;
    }
  },
};

export default canvasStorage;
