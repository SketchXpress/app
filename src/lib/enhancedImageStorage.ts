// src/lib/enhancedImageStorage.ts
import { GeneratedImage } from "@/components/RightPanel/types";
import localforage from "localforage";

// Define types for the stored images
export interface StoredImageSession {
  images: GeneratedImage[];
  selectedId: number | null;
  timestamp: number;
}

// Initialize localForage instance
const imageStore = localforage.createInstance({
  name: "SketchXpress",
  storeName: "enhanced_images",
  description: "Enhanced images from AI processing",
});

// Create storage API
export const enhancedImageStorage = {
  // Save current images
  saveImages: async (
    images: GeneratedImage[],
    selectedId: number | null
  ): Promise<boolean> => {
    try {
      await imageStore.setItem("current-images", {
        images,
        selectedId,
        timestamp: Date.now(),
      });
      return true;
    } catch (err) {
      console.error("Failed to save enhanced images:", err);
      return false;
    }
  },

  // Load saved images
  loadImages: async (): Promise<StoredImageSession | null> => {
    try {
      return (await imageStore.getItem("current-images")) as StoredImageSession;
    } catch (err) {
      console.error("Failed to load enhanced images:", err);
      return null;
    }
  },
};

export default enhancedImageStorage;
