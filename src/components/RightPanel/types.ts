// types.ts
import { EnhanceCompletedEvent } from "@/lib/events";

// Extend event type to include base64 data
export interface EnhanceCompletedEventWithBase64 extends EnhanceCompletedEvent {
  images_base64?: string[];
}

// Image type definition
export interface GeneratedImage {
  id: number;
  title: string;
  src: string; // Can be blob URL or base64 data URI
  url: string; // Full URL for the original image from the backend (for download)
  customName: string;
}

// Pool type
export interface Pool {
  address: string;
  name: string;
}

// Default pools type
export interface DefaultPools {
  kids: Pool;
  pro: Pool;
}
