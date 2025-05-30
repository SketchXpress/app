"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import enhancedImageStorage from "@/lib/enhancedImageStorage";

export const useResponsiveBehavior = () => {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isTablet, setIsTablet] = useState<boolean>(false);
  const sidebarRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const checkWidth = () => {
      const width = window.innerWidth;
      const isMobileView = width < 640;
      const isTabletView = width >= 640 && width < 1024;

      setIsMobile(isMobileView);
      setIsTablet(isTabletView);

      if (isMobileView || isTabletView) {
        setSidebarOpen(false);
      }
    };

    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

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

export const useEnhanceEvents = (
  sidebarOpen: boolean,
  setSidebarOpen: (open: boolean) => void
) => {
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [imagesLoaded, setImagesLoaded] = useState<boolean>(false);

  useEffect(() => {
    const loadSavedImages = async () => {
      try {
        const savedSession = await enhancedImageStorage.loadImages();

        if (
          savedSession &&
          savedSession.images &&
          savedSession.images.length > 0
        ) {
          // Process saved images to convert blob URLs if needed
          const processedImages = await Promise.all(
            savedSession.images.map(async (img) => {
              // If it's a base64 image, we can use it directly
              if (img.src.startsWith("data:")) {
                return img;
              }

              if (img.src.startsWith("blob:")) {
                try {
                  const response = await fetch(img.url);
                  if (!response.ok) return img;

                  const blob = await response.blob();
                  return {
                    ...img,
                    src: URL.createObjectURL(blob),
                  };
                } catch (err) {
                  console.warn(
                    "Could not refresh blob URL, using original URL:",
                    err
                  );
                  return img;
                }
              }

              return img;
            })
          );

          setGeneratedImages(processedImages);
          setSelectedImageId(savedSession.selectedId);
        }

        setImagesLoaded(true);
      } catch (err) {
        console.error("Error loading saved images:", err);
        setImagesLoaded(true);
      }
    };

    loadSavedImages();
  }, [sidebarOpen, setSidebarOpen]);

  // Save images when they change
  const saveCurrentImages = useCallback(
    async (images: GeneratedImage[], selected: number | null) => {
      if (images.length > 0) {
        await enhancedImageStorage.saveImages(images, selected);
      }
    },
    []
  );

  // Save when images or selection changes
  useEffect(() => {
    if (imagesLoaded && generatedImages.length > 0) {
      saveCurrentImages(generatedImages, selectedImageId);
    }
  }, [generatedImages, selectedImageId, imagesLoaded, saveCurrentImages]);

  // Subscribe to enhance events
  useEffect(() => {
    const unsubscribeStarted = subscribeToEnhanceStarted(
      (data: EnhanceStartedEvent) => {
        setIsProcessing(true);
        setError(null);
        setCurrentJobId(data.jobId);

        if (sidebarOpen) {
          setSidebarOpen(false);
        }
      }
    );

    // Handle enhance completed event with base64 images
    const unsubscribeCompleted = subscribeToEnhanceCompleted(
      async (data: EnhanceCompletedEvent & { images_base64?: string[] }) => {
        setIsProcessing(false);
        setCurrentJobId(null);

        try {
          let images: GeneratedImage[] = [];

          if (data.images_base64 && data.images_base64.length > 0) {
            images = data.images_base64.map((base64String, index) => {
              const filename =
                data.images[index]?.split("/").pop() ||
                `generated_${index}.png`;
              const originalUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/generated/${filename}`;
              return {
                id: index + 1,
                title: `Generated Image ${index + 1}`,
                src: `data:image/png;base64,${base64String}`,
                url: originalUrl,
                customName: "",
              };
            });
          } else if (data.images && data.images.length > 0) {
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
            );
          } else {
            console.warn(
              "[RightPanel] No image data found in completed event."
            );
          }

          if (images.length > 0) {
            setGeneratedImages(images);

            const defaultSelectedId = images[0]?.id || null;
            setSelectedImageId(defaultSelectedId);

            // Save the new images to storage
            await saveCurrentImages(images, defaultSelectedId);
            setSidebarOpen(true);
          } else {
            setError("Failed to load generated images from event.");

            toast.error("Failed to load generated images", {
              position: "bottom-left",
              autoClose: 4000,
            });
          }
        } catch (err) {
          console.error("Error processing generated images:", err);
          setError("Failed to process generated images");

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
        setCurrentJobId(null);
        setError(data.error || "Image generation failed");
      }
    );

    // Clean up subscriptions
    return () => {
      unsubscribeStarted();
      unsubscribeCompleted();
      unsubscribeFailed();
    };
  }, [sidebarOpen, setSidebarOpen, saveCurrentImages]);

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
          return;
        }

        if (!response.ok) {
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
          if (pollInterval) clearInterval(pollInterval);
          setIsProcessing(false);
          setCurrentJobId(null);

          let images: GeneratedImage[] = [];
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
          } else if (data.images && data.images.length > 0) {
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
            );
          } else {
            console.warn(
              "[Polling] No image data found in completed status response."
            );
          }

          if (images.length > 0) {
            setGeneratedImages(images);

            // Set first image as selected by default
            const defaultSelectedId = images[0]?.id || null;
            setSelectedImageId(defaultSelectedId);

            // Save images to storage
            await saveCurrentImages(images, defaultSelectedId);

            setError(null);
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
        } else {
          console.warn("[Polling] Unknown job status:", data.status);
        }
      } catch {}
    };

    // Start polling immediately and then set interval
    pollStatus();
    pollInterval = setInterval(pollStatus, 5000);

    // Cleanup function
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [currentJobId, isProcessing, setSidebarOpen, saveCurrentImages]);

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

export const useImageGallery = (
  setSelectedImageId: (id: number | null) => void
) => {
  const [showGallery, setShowGallery] = useState<boolean>(true);

  const handleImageSelect = (id: number, currentSelectedId: number | null) => {
    setSelectedImageId(id === currentSelectedId ? null : id);
  };

  return {
    showGallery,
    setShowGallery,
    handleImageSelect,
  };
};

// Parental control
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

// Advanced parameter
export const useAdvancedParameters = () => {
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  return {
    showAdvanced,
    setShowAdvanced,
  };
};
