import { EnhanceCompletedEvent } from "@/lib/events";

export interface EnhanceCompletedEventWithBase64 extends EnhanceCompletedEvent {
  images_base64?: string[];
}

export interface GeneratedImage {
  id: number;
  title: string;
  src: string;
  url: string;
  customName: string;
}

export interface Pool {
  address: string;
  name: string;
}

export interface DefaultPools {
  kids: Pool;
  pro: Pool;
}

export interface MintResult {
  success: boolean;
  nftAddress?: string;
  poolInfo?: {
    address: string;
    name: string;
  };
  cancelled?: boolean;
  error?: string;
}
