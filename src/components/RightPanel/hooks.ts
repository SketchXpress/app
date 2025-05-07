// hooks.ts
"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import {
  subscribeToEnhanceStarted,
  subscribeToEnhanceCompleted,
  subscribeToEnhanceFailed,
  EnhanceStartedEvent,
  EnhanceCompletedEvent,
  EnhanceFailedEvent,
} from "@/lib/events";
import { GeneratedImage } from "./types";

// Custom hook for responsive behavior
export const useResponsiveBehavior = () => {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isTablet, setIsTablet] = useState<boolean>(false);
  const sidebarRef = useRef<HTMLElement | null>(null);

  // Handle responsive behavior
  useEffect(() => {
    const checkWidth = () => {
      const width = window.innerWidth;
      const isMobileView = width < 640;
      const isTabletView = width >= 640 && width < 1024;

      setIsMobile(isMobileView);
      setIsTablet(isTabletView);

      // Auto-close sidebar on mobile and tablet initial load
      if (isMobileView || isTabletView) {
        setSidebarOpen(false);
      }
    };

    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  // Handle click outside to close sidebar on mobile
  useEffect(() => {
    if (!isMobile && !isTablet) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setSidebarOpen(false);
      }
    };

    if (sidebarOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMobile, isTablet, sidebarOpen]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return {
    sidebarOpen,
    setSidebarOpen,
    isMobile,
    isTablet,
    sidebarRef,
    toggleSidebar,
  };
};

// Custom hook for enhance events
export const useEnhanceEvents = (
  sidebarOpen: boolean,
  setSidebarOpen: (open: boolean) => void
) => {
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  // Subscribe to enhance events
  useEffect(() => {
    // Handle enhance started event
    const unsubscribeStarted = subscribeToEnhanceStarted(
      (data: EnhanceStartedEvent) => {
        setIsProcessing(true);
        setGeneratedImages([]); // Clear previous images
        setError(null);
        setCurrentJobId(data.jobId);

        // Important: Close the sidebar during processing
        if (sidebarOpen) {
          setSidebarOpen(false);
        }
      }
    );

    // Handle enhance completed event with base64 images
    const unsubscribeCompleted = subscribeToEnhanceCompleted(
      async (data: EnhanceCompletedEvent & { images_base64?: string[] }) => {
        setIsProcessing(false);
        setCurrentJobId(null); // Clear job ID once completed

        try {
          let images: GeneratedImage[] = [];

          // *** USE BASE64 DATA IF AVAILABLE ***
          if (data.images_base64 && data.images_base64.length > 0) {
            images = data.images_base64.map((base64String, index) => {
              const filename =
                data.images[index]?.split("/").pop() ||
                `generated_${index}.png`;
              const originalUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/generated/${filename}`;
              return {
                id: index + 1,
                title: `Generated Image ${index + 1}`,
                src: `data:image/png;base64,${base64String}`, // Use base64 data URI
                url: originalUrl, // Store original URL for downloads
              };
            });
          }
          // *** FALLBACK TO FETCHING FROM URL (OLD METHOD) ***
          else if (data.images && data.images.length > 0) {
            console.warn(
              "[RightPanel] Base64 data not found in event, falling back to fetching URLs."
            );
            images = await Promise.all(
              data.images.map(async (imagePath, index) => {
                const pathParts = imagePath.split("/");
                const filename = pathParts[pathParts.length - 1];
                const fullUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/generated/${filename}`;

                try {
                  const response = await fetch(fullUrl);
                  if (!response.ok)
                    throw new Error(
                      `Failed to fetch image: ${response.status}`
                    );
                  const blob = await response.blob();
                  return {
                    id: index + 1,
                    title: `Generated Image ${index + 1}`,
                    src: URL.createObjectURL(blob), // Create local URL for the Image component
                    url: fullUrl, // Store original URL for downloads
                  };
                } catch {
                  return null;
                }
              })
            ).then(
              (results) =>
                results.filter((img) => img !== null) as GeneratedImage[]
            ); // Filter out nulls
          } else {
            console.warn(
              "[RightPanel] No image data found in completed event."
            );
          }

          if (images.length > 0) {
            setGeneratedImages(images);

            // NOW open the sidebar since enhancement is complete
            setSidebarOpen(true);
          } else {
            setError("Failed to load generated images from event.");

            // Show error toast
            toast.error("Failed to load generated images", {
              position: "bottom-left",
              autoClose: 4000,
            });
          }
        } catch {
          setError("Failed to process generated images");

          // Show error toast
          toast.error("Failed to process generated images", {
            position: "bottom-left",
            autoClose: 4000,
          });
        }
      }
    );

    // Handle enhance failed event
    const unsubscribeFailed = subscribeToEnhanceFailed(
      (data: EnhanceFailedEvent) => {
        setIsProcessing(false);
        setCurrentJobId(null); // Clear job ID on failure
        setError(data.error || "Image generation failed");

        // Show error toast but don't open the panel
        toast.error(data.error || "Image generation failed", {
          position: "bottom-left",
          autoClose: 5000,
        });
      }
    );

    // Clean up subscriptions
    return () => {
      unsubscribeStarted();
      unsubscribeCompleted();
      unsubscribeFailed();
    };
  }, [sidebarOpen, setSidebarOpen]); // Rerun if sidebarOpen changes (might affect auto-expand logic)

  // Polling for job status (as a backup, primarily rely on events)
  useEffect(() => {
    if (!currentJobId || !isProcessing) return;

    let pollInterval: NodeJS.Timeout | null = null;

    const pollStatus = async () => {
      if (!currentJobId) {
        if (pollInterval) clearInterval(pollInterval);
        return;
      }
      try {
        const statusUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/status/${currentJobId}`;

        const response = await fetch(statusUrl);

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
          return; // Try polling again
        }

        if (!response.ok) {
          // Keep polling unless it's a 404 (job not found)
          if (response.status === 404) {
            setError("Job not found. Please try again.");
            if (pollInterval) clearInterval(pollInterval);
            setIsProcessing(false);
            setCurrentJobId(null);

            toast.error("Job not found. Please try again.", {
              position: "bottom-left",
              autoClose: 4000,
            });
          }
          return;
        }

        const data = await response.json();

        if (data.status === "completed") {
          if (pollInterval) clearInterval(pollInterval); // Stop polling
          setIsProcessing(false);
          setCurrentJobId(null); // Clear job ID

          let images: GeneratedImage[] = [];
          // *** USE BASE64 DATA IF AVAILABLE ***
          if (data.images_base64 && data.images_base64.length > 0) {
            images = data.images_base64.map(
              (base64String: string, index: number) => {
                const filename =
                  data.images[index]?.split("/").pop() ||
                  `generated_${index}.png`;
                const originalUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/generated/${filename}`;
                return {
                  id: index + 1,
                  title: `Generated Image ${index + 1}`,
                  src: `data:image/png;base64,${base64String}`,
                  url: originalUrl,
                };
              }
            );
          }
          // *** FALLBACK TO FETCHING FROM URL (OLD METHOD) ***
          else if (data.images && data.images.length > 0) {
            console.warn(
              "[Polling] Base64 data not found in status, falling back to fetching URLs."
            );
            images = await Promise.all(
              data.images.map(async (imagePath: string, index: number) => {
                const pathParts = imagePath.split("/");
                const filename = pathParts[pathParts.length - 1];
                const fullUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/generated/${filename}`;

                try {
                  const response = await fetch(fullUrl);
                  if (!response.ok)
                    throw new Error(
                      `Failed to fetch image: ${response.status}`
                    );
                  const blob = await response.blob();
                  return {
                    id: index + 1,
                    title: `Generated Image ${index + 1}`,
                    src: URL.createObjectURL(blob),
                    url: fullUrl,
                  };
                } catch {
                  return null;
                }
              })
            ).then(
              (results) =>
                results.filter((img) => img !== null) as GeneratedImage[]
            ); // Filter out nulls
          } else {
            console.warn(
              "[Polling] No image data found in completed status response."
            );
          }

          if (images.length > 0) {
            setGeneratedImages(images);
            setError(null); // Clear any previous error

            // Now that processing is complete and we have images, open the sidebar
            setSidebarOpen(true);
          } else {
            setError("Failed to load generated images from status poll.");

            // Show error toast
            toast.error("Failed to load generated images", {
              position: "bottom-left",
              autoClose: 4000,
            });
          }
        } else if (data.status === "failed") {
          if (pollInterval) clearInterval(pollInterval);
          setIsProcessing(false);
          setCurrentJobId(null);
          setError(data.error || "Generation failed");

          // Show error toast
          toast.error(data.error || "Generation failed", {
            position: "bottom-left",
            autoClose: 5000,
          });
        } else if (data.status === "processing") {
          // Continue polling
        } else {
          console.warn("[Polling] Unknown job status:", data.status);
          // Continue polling for a while
        }
      } catch {
        // Don't stop polling immediately on generic error, could be temporary network issue
      }
    };

    // Start polling immediately and then set interval
    pollStatus();
    pollInterval = setInterval(pollStatus, 5000); // Poll every 5 seconds

    // Cleanup function
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [currentJobId, isProcessing, setSidebarOpen]); // Only restart polling if jobId changes or processing state changes

  // Clean up object URLs on unmount or when images change
  useEffect(() => {
    const currentImageSrcs = generatedImages.map((img) => img.src);
    return () => {
      currentImageSrcs.forEach((src) => {
        if (src.startsWith("blob:")) {
          URL.revokeObjectURL(src);
        }
      });
    };
  }, [generatedImages]);

  return {
    generatedImages,
    setGeneratedImages,
    selectedImageId,
    setSelectedImageId,
    isProcessing,
    error,
    currentJobId,
  };
};

// Custom hook for image gallery
export const useImageGallery = (
  setSelectedImageId: (id: number | null) => void
) => {
  const [showGallery, setShowGallery] = useState<boolean>(true);

  const handleImageSelect = (id: number, currentSelectedId: number | null) => {
    setSelectedImageId(id === currentSelectedId ? null : id);

    // Optional: Show toast when selecting image
    if (id !== currentSelectedId) {
      toast.info(`Image ${id} selected`, {
        position: "bottom-left",
        autoClose: 1500,
        hideProgressBar: true,
      });
    }
  };

  return {
    showGallery,
    setShowGallery,
    handleImageSelect,
  };
};

// Custom hook for parental control
export const useParentalControl = () => {
  const [showParentalDialog, setShowParentalDialog] = useState<boolean>(false);
  const [mintingImage, setMintingImage] = useState<GeneratedImage | null>(null);

  const handleCloseParentalDialog = () => {
    setShowParentalDialog(false);
    setMintingImage(null);
  };

  return {
    showParentalDialog,
    setShowParentalDialog,
    mintingImage,
    setMintingImage,
    handleCloseParentalDialog,
  };
};

// Custom hook for advanced parameters
export const useAdvancedParameters = () => {
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  return {
    showAdvanced,
    setShowAdvanced,
  };
};
