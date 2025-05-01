"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import {
  Download,
  Coins,
  ChevronsRight,
  ChevronsLeft,
  X,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Settings,
  RefreshCw,
  AlertOctagon,
  Wand2,
  Eye,
  Share2,
  Info
} from "lucide-react";

import styles from "./RightPanel.module.scss";
import { useModeStore } from "@/stores/modeStore";
import { useEnhanceStore } from "@/stores/enhanceStore";
import {
  subscribeToEnhanceStarted,
  subscribeToEnhanceCompleted,
  subscribeToEnhanceFailed,
  EnhanceStartedEvent,
  EnhanceCompletedEvent,
  EnhanceFailedEvent
} from "@/lib/events";
import { uploadMetadataToIPFS } from "@/lib/uploadMetadataToIPFS";
import { mintNFT } from "@/lib/mintNFT";
import { uploadToIPFSUsingPinata } from "@/lib/uploadToIPFSUsingPinata";

// Extend event type to include base64 data
interface EnhanceCompletedEventWithBase64 extends EnhanceCompletedEvent {
  images_base64?: string[];
}

// Image type definition
interface GeneratedImage {
  id: number;
  title: string;
  src: string; // Can be blob URL or base64 data URI
  url: string; // Full URL for the original image from the backend (for download)
}

const RightPanel: React.FC = () => {
  const mode = useModeStore((s) => s.mode);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isTablet, setIsTablet] = useState<boolean>(false);
  const [showGallery, setShowGallery] = useState<boolean>(true);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const walletContext = useWallet();

  // Get enhance store values
  const {
    prompt, setPrompt,
    negativePrompt, setNegativePrompt,
    temperature, setTemperature,
    guidanceScale, setGuidanceScale,
    numImages, setNumImages,
    resetToDefaults
  } = useEnhanceStore();

  // Simulated processing progress
  useEffect(() => {
    if (isProcessing) {
      const interval = setInterval(() => {
        setProcessingProgress(prev => {
          const increment = Math.random() * 5;
          const newValue = prev + increment;
          return newValue >= 100 ? 99 : newValue; // Cap at 99% until complete
        });
      }, 500);

      return () => {
        clearInterval(interval);
        setProcessingProgress(0);
      };
    }
  }, [isProcessing]);

  // Handle responsive behavior
  useEffect(() => {
    const checkWidth = () => {
      const width = window.innerWidth;
      const isMobileView = width < 640;
      const isTabletView = width >= 640 && width < 1024;

      setIsMobile(isMobileView);
      setIsTablet(isTabletView);

      // Auto-close sidebar on mobile initial load
      if (isMobileView) {
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
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
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

  // Subscribe to enhance events
  useEffect(() => {
    // Handle enhance started event
    const unsubscribeStarted = subscribeToEnhanceStarted((data: EnhanceStartedEvent) => {
      console.log("[RightPanel] Enhance started event received, Job ID:", data.jobId);
      setIsProcessing(true);
      setGeneratedImages([]); // Clear previous images
      setError(null);
      setCurrentJobId(data.jobId);
      setProcessingProgress(0);

      // Auto-expand the panel when processing starts
      if (!sidebarOpen) {
        setSidebarOpen(true);
      }
    });

    // Handle enhance completed event
    const unsubscribeCompleted = subscribeToEnhanceCompleted(async (data: EnhanceCompletedEventWithBase64) => {
      console.log("[RightPanel] Enhance completed event received:", data);
      setIsProcessing(false);
      setCurrentJobId(null); // Clear job ID once completed
      setProcessingProgress(100);

      try {
        let images: GeneratedImage[] = [];

        // *** USE BASE64 DATA IF AVAILABLE ***
        if (data.images_base64 && data.images_base64.length > 0) {
          console.log("[RightPanel] Using base64 data from event.");
          images = data.images_base64.map((base64String, index) => {
            const filename = data.images[index]?.split("/").pop() || `generated_${index}.png`;
            const originalUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/generated/${filename}`;
            return {
              id: index + 1,
              title: `Generated Image ${index + 1}`,
              src: `data:image/png;base64,${base64String}`, // Use base64 data URI
              url: originalUrl // Store original URL for downloads
            };
          });
        }
        // *** FALLBACK TO FETCHING FROM URL (OLD METHOD) ***
        else if (data.images && data.images.length > 0) {
          console.warn("[RightPanel] Base64 data not found in event, falling back to fetching URLs.");
          images = await Promise.all(
            data.images.map(async (imagePath, index) => {
              const pathParts = imagePath.split("/");
              const filename = pathParts[pathParts.length - 1];
              const fullUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/generated/${filename}`;
              console.log(`[Fallback] Fetching image ${index + 1} from: ${fullUrl}`);
              try {
                const response = await fetch(fullUrl);
                if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
                const blob = await response.blob();
                return {
                  id: index + 1,
                  title: `Generated Image ${index + 1}`,
                  src: URL.createObjectURL(blob), // Create local URL for the Image component
                  url: fullUrl // Store original URL for downloads
                };
              } catch (error) {
                console.error(`[Fallback] Error fetching image ${index + 1}:`, error);
                // Return a placeholder or skip
                return null;
              }
            })
          ).then(results => results.filter(img => img !== null) as GeneratedImage[]); // Filter out nulls
        } else {
          console.warn("[RightPanel] No image data found in completed event.");
        }

        if (images.length > 0) {
          console.log("[RightPanel] Setting generated images:", images);
          setGeneratedImages(images);
          setShowGallery(true);
        } else {
          setError("Failed to load generated images from event.");
        }

      } catch (err) {
        console.error("[RightPanel] Error processing completed event:", err);
        setError("Failed to process generated images");
      }
    });

    // Handle enhance failed event
    const unsubscribeFailed = subscribeToEnhanceFailed((data: EnhanceFailedEvent) => {
      console.error("[RightPanel] Enhance failed event received:", data);
      setIsProcessing(false);
      setCurrentJobId(null); // Clear job ID on failure
      setError(data.error || "Image generation failed");
      setProcessingProgress(0);
    });

    // Clean up subscriptions
    return () => {
      console.log("[RightPanel] Cleaning up event subscriptions.");
      unsubscribeStarted();
      unsubscribeCompleted();
      unsubscribeFailed();
    };
  }, [sidebarOpen]); // Rerun if sidebarOpen changes (might affect auto-expand logic)

  // Polling for job status (as a backup, primarily rely on events)
  useEffect(() => {
    if (!currentJobId || !isProcessing) return;

    console.log(`[RightPanel] Starting polling for Job ID: ${currentJobId}`);
    let pollInterval: NodeJS.Timeout | null = null;

    const pollStatus = async () => {
      if (!currentJobId) {
        if (pollInterval) clearInterval(pollInterval);
        return;
      }
      try {
        const statusUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/status/${currentJobId}`;
        console.log(`[Polling] Fetching status: ${statusUrl}`);
        const response = await fetch(statusUrl);

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
          console.error("[Polling] Received HTML instead of JSON - ngrok issue?");
          return; // Try polling again
        }

        if (!response.ok) {
          console.error("[Polling] Error polling job status:", response.status, await response.text());
          // Keep polling unless it's a 404 (job not found)
          if (response.status === 404) {
            setError("Job not found. Please try again.");
            if (pollInterval) clearInterval(pollInterval);
            setIsProcessing(false);
            setCurrentJobId(null);
          }
          return;
        }

        const data = await response.json();
        console.log("[Polling] Received status:", data.status);

        if (data.status === "completed") {
          console.log("[Polling] Job completed. Processing images...");
          if (pollInterval) clearInterval(pollInterval); // Stop polling
          setIsProcessing(false);
          setCurrentJobId(null); // Clear job ID
          setProcessingProgress(100);

          let images: GeneratedImage[] = [];
          // *** USE BASE64 DATA IF AVAILABLE ***
          if (data.images_base64 && data.images_base64.length > 0) {
            console.log("[Polling] Using base64 data from status response.");
            images = data.images_base64.map((base64String: string, index: number) => {
              const filename = data.images[index]?.split("/").pop() || `generated_${index}.png`;
              const originalUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/generated/${filename}`;
              return {
                id: index + 1,
                title: `Generated Image ${index + 1}`,
                src: `data:image/png;base64,${base64String}`,
                url: originalUrl
              };
            });
          }
          // *** FALLBACK TO FETCHING FROM URL (OLD METHOD) ***
          else if (data.images && data.images.length > 0) {
            console.warn("[Polling] Base64 data not found in status, falling back to fetching URLs.");
            images = await Promise.all(
              data.images.map(async (imagePath: string, index: number) => {
                const pathParts = imagePath.split("/");
                const filename = pathParts[pathParts.length - 1];
                const fullUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/generated/${filename}`;
                console.log(`[Polling Fallback] Fetching image ${index + 1} from: ${fullUrl}`);
                try {
                  const response = await fetch(fullUrl);
                  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
                  const blob = await response.blob();
                  return {
                    id: index + 1,
                    title: `Generated Image ${index + 1}`,
                    src: URL.createObjectURL(blob),
                    url: fullUrl
                  };
                } catch (error) {
                  console.error(`[Polling Fallback] Error fetching image ${index + 1}:`, error);
                  return null;
                }
              })
            ).then(results => results.filter(img => img !== null) as GeneratedImage[]); // Filter out nulls
          } else {
            console.warn("[Polling] No image data found in completed status response.");
          }

          if (images.length > 0) {
            console.log("[Polling] Setting generated images:", images);
            setGeneratedImages(images);
            setShowGallery(true);
            setError(null); // Clear any previous error
          } else {
            setError("Failed to load generated images from status poll.");
          }

        } else if (data.status === "failed") {
          console.error("[Polling] Job failed:", data.error);
          if (pollInterval) clearInterval(pollInterval);
          setIsProcessing(false);
          setCurrentJobId(null);
          setError(data.error || "Generation failed");
          setProcessingProgress(0);
        } else if (data.status === "processing") {
          // Continue polling
        } else {
          console.warn("[Polling] Unknown job status:", data.status);
          // Continue polling for a while
        }
      } catch (err) {
        console.error("[Polling] Error during poll:", err);
        // Don't stop polling immediately on generic error, could be temporary network issue
      }
    };

    // Start polling immediately and then set interval
    pollStatus();
    pollInterval = setInterval(pollStatus, 5000); // Poll every 5 seconds

    // Cleanup function
    return () => {
      console.log(`[RightPanel] Cleaning up polling for Job ID: ${currentJobId}`);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [currentJobId, isProcessing]); // Only restart polling if jobId changes or processing state changes

  // Clean up object URLs on unmount or when images change
  useEffect(() => {
    const currentImageSrcs = generatedImages.map(img => img.src);
    return () => {
      console.log("[RightPanel] Cleaning up object URLs.");
      currentImageSrcs.forEach(src => {
        if (src.startsWith("blob:")) {
          console.log(`Revoking blob URL: ${src}`);
          URL.revokeObjectURL(src);
        }
      });
    };
  }, [generatedImages]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Download/Export uses the original URL
  const handleExport = () => {
    if (!selectedImageId) {
      alert("Please select an image to export");
      return;
    }
    const selectedImage = generatedImages.find(img => img.id === selectedImageId);
    if (!selectedImage) return;

    console.log(`Exporting image: ${selectedImage.url}`);
    const link = document.createElement("a");
    link.href = selectedImage.url; // Use the original URL for download
    link.target = "_blank"; // Open in new tab might be better for ngrok links
    link.download = `generated-image-${selectedImageId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Share function (new)
  const handleShare = () => {
    if (!selectedImageId) {
      alert("Please select an image to share");
      return;
    }

    // This is a placeholder. In a real implementation, you might:
    // 1. Upload the image to a sharing service
    // 2. Generate a shareable link
    // 3. Use the Web Share API if available

    if (navigator.share) {
      navigator.share({
        title: 'My SketchXpress Creation',
        text: 'Check out this AI-enhanced image I created with SketchXpress!',
        url: window.location.href,
      })
        .then(() => console.log('Successful share'))
        .catch((error) => console.log('Error sharing:', error));
    } else {
      // Fallback for browsers that don't support the Web Share API
      alert("Sharing link copied to clipboard!");
    }
  };

  // Minting requires fetching the blob again from the original URL
  const handleMintNFT = async () => {
    if (!walletContext.connected || !walletContext.publicKey) {
      alert("Please connect your wallet first!");
      return;
    }
    if (!selectedImageId) {
      alert("Please select an image to mint!");
      return;
    }
    const selectedImage = generatedImages.find(img => img.id === selectedImageId);
    if (!selectedImage) {
      alert("Selected image not found.");
      return;
    }

    // Show minting status
    setIsProcessing(true);
    setError(null);

    try {
      // Fetch the image blob from the original URL
      const response = await fetch(selectedImage.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image for minting: ${response.status}`);
      }
      const blob = await response.blob();

      // Upload image to IPFS
      console.log("Uploading image to IPFS...");
      const imageIpfsUrl = await uploadToIPFSUsingPinata(blob);
      console.log("Image uploaded to IPFS:", imageIpfsUrl);

      // Upload metadata to IPFS
      console.log("Uploading metadata to IPFS...");
      const metadataIpfsUrl = await uploadMetadataToIPFS(
        "SketchXpress Artwork",
        "AI-enhanced artwork created with SketchXpress.",
        imageIpfsUrl
      );
      console.log("Metadata uploaded to IPFS:", metadataIpfsUrl);

      // Mint the NFT
      console.log("Minting NFT...");
      const nftAddress = await mintNFT(metadataIpfsUrl, walletContext);
      console.log("NFT minted successfully:", nftAddress);

      // Hide the processing state
      setIsProcessing(false);

      // Show success message
      alert(`🎉 NFT minted successfully!\nAddress: ${nftAddress}`);
    } catch (error) {
      console.error("Error minting NFT:", error);
      setIsProcessing(false);
      setError(`Minting failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleImageSelect = (id: number) => {
    setSelectedImageId(id === selectedImageId ? null : id);
  };

  // Individual image download button
  const handleDownloadImage = (e: React.MouseEvent, image: GeneratedImage) => {
    e.stopPropagation();
    console.log(`Downloading image: ${image.url}`);
    const link = document.createElement("a");
    link.href = image.url;
    link.download = `generated-image-${image.id}.png`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Individual image mint button
  const handleMintClick = (e: React.MouseEvent, imageId: number) => {
    e.stopPropagation();
    setSelectedImageId(imageId); // Select the image first
    // Use setTimeout to allow state update before calling mint
    setTimeout(() => handleMintNFT(), 0);
  };

  // New preview function
  const handlePreview = (e: React.MouseEvent, image: GeneratedImage) => {
    e.stopPropagation();
    // Select the image and show full screen preview
    setSelectedImageId(image.id);
    // Here you would implement a full-screen preview modal
    // For now, we're just selecting the image
  };

  return (
    <>
      {/* Mobile/tablet toggle button */}
      {(isMobile || isTablet) && (
        <button
          className={styles.mobileToggle}
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Close panel" : "Open panel"}
        >
          {sidebarOpen ? <X size={18} /> : <ChevronsLeft size={18} />}
        </button>
      )}

      {/* Desktop collapse toggle */}
      {!isMobile && !isTablet && (
        <button
          className={`${styles.collapseToggle} ${!sidebarOpen ? styles.collapsed : ""}`}
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Collapse panel" : "Expand panel"}
        >
          {sidebarOpen ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </button>
      )}

      {/* Panel content */}
      <aside
        ref={sidebarRef}
        className={`${styles.panel} ${!sidebarOpen ? styles.collapsed : ""} ${isMobile ? styles.mobile : ""} ${isTablet ? styles.tablet : ""}`}
      >
        <div className={styles.panelContent}>
          {/* Collapsed view buttons */}
          {!sidebarOpen && (
            <div className={styles.collapsedButtons}>
              {mode === "pro" && (
                <motion.button
                  className={styles.iconButton}
                  onClick={() => setSidebarOpen(true)}
                  title="AI Parameters"
                  whileHover={{ y: -2, boxShadow: "0 4px 8px rgba(0,0,0,0.1)" }}
                >
                  <Settings size={20} />
                </motion.button>
              )}
              <motion.button
                className={styles.iconButton}
                onClick={() => setSidebarOpen(true)}
                title="Generated Images"
                whileHover={{ y: -2, boxShadow: "0 4px 8px rgba(0,0,0,0.1)" }}
              >
                <ImageIcon size={20} />
              </motion.button>
            </div>
          )}

          {/* Expanded view content */}
          {sidebarOpen && (
            <div>
              {/* Pro mode parameters */}
              {mode === "pro" && !isProcessing && (
                <motion.div
                  className={styles.section}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className={styles.sectionTitle}>
                    <Settings size={14} className={styles.sectionIcon} />
                    <span>AI Configuration</span>
                  </div>

                  {/* Text Prompt Input */}
                  <div className={styles.promptInputGroup}>
                    <label htmlFor="prompt-input" className={styles.inputLabel}>Text Prompt</label>
                    <textarea
                      id="prompt-input"
                      className={styles.promptInput}
                      placeholder="Describe what you want to create..."
                      rows={3}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                  </div>

                  {/* Negative Prompt Input */}
                  <div className={styles.promptInputGroup}>
                    <label htmlFor="negative-prompt-input" className={styles.inputLabel}>
                      Negative Prompt (Optional)
                    </label>
                    <textarea
                      id="negative-prompt-input"
                      className={styles.promptInput}
                      placeholder="Describe what to avoid..."
                      rows={2}
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                    />
                  </div>

                  {/* Advanced Parameters Toggle */}
                  <div className={styles.parametersToggle}>
                    <motion.button
                      className={styles.toggleButton}
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      type="button"
                      whileHover={{ backgroundColor: "rgba(0, 0, 0, 0.05)" }}
                    >
                      <Settings size={14} className={styles.settingsIcon} />
                      <span>Advanced Parameters</span>
                      {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </motion.button>
                  </div>

                  {/* Advanced Parameters Panel */}
                  <div>
                    {showAdvanced && (
                      <motion.div
                        className={styles.advancedParams}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        {/* Temperature Slider */}
                        <div className={styles.paramSlider}>
                          <div className={styles.paramHeader}>
                            <label htmlFor="temperature-slider">Temperature: {temperature.toFixed(2)}</label>
                            <div className={styles.paramLabels}>
                              <span>Precise</span>
                              <span>Creative</span>
                            </div>
                          </div>
                          <input
                            id="temperature-slider"
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={temperature}
                            onChange={(e) => setTemperature(parseFloat(e.target.value))}
                            className={styles.slider}
                          />
                        </div>

                        {/* Guidance Scale Slider */}
                        <div className={styles.paramSlider}>
                          <div className={styles.paramHeader}>
                            <label htmlFor="guidance-slider">Guidance Scale: {guidanceScale.toFixed(2)}</label>
                            <div className={styles.paramLabels}>
                              <span>Creative</span>
                              <span>Precise</span>
                            </div>
                          </div>
                          <input
                            id="guidance-slider"
                            type="range"
                            min="1"
                            max="15"
                            step="0.5"
                            value={guidanceScale}
                            onChange={(e) => setGuidanceScale(parseFloat(e.target.value))}
                            className={styles.slider}
                          />
                        </div>

                        {/* Number of Images Slider */}
                        <div className={styles.paramSlider}>
                          <div className={styles.paramHeader}>
                            <label htmlFor="num-images-slider">Number of Images: {numImages}</label>
                          </div>
                          <input
                            id="num-images-slider"
                            type="range"
                            min="1"
                            max="4"
                            step="1"
                            value={numImages}
                            onChange={(e) => setNumImages(parseInt(e.target.value, 10))}
                            className={styles.slider}
                          />
                          <div className={styles.numImagesIndicator}>
                            {Array.from({ length: 4 }).map((_, idx) => (
                              <motion.div
                                key={idx}
                                className={`${styles.numBox} ${idx < numImages ? styles.active : ""}`}
                                animate={{
                                  backgroundColor: idx < numImages ? 'var(--accent-cyan)' : 'var(--border)',
                                  scale: idx < numImages ? 1.1 : 1
                                }}
                                transition={{ duration: 0.2 }}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Reset Button */}
                        <motion.button
                          className={styles.resetButton}
                          onClick={resetToDefaults}
                          type="button"
                          whileHover={{
                            backgroundColor: "rgba(0, 0, 0, 0.05)",
                            scale: 1.02,
                            opacity: 0.9
                          }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <RefreshCw size={14} />
                          <span>Reset to Defaults</span>
                        </motion.button>

                        {/* Help tooltip */}
                        <div className={styles.parameterHelp}>
                          <Info size={14} />
                          <span>Higher temperature and lower guidance produces more creative, varied results.</span>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Loading indicator */}
              {isProcessing && (
                <motion.div
                  className={styles.processingSection}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className={styles.progressContainer}>
                    <motion.div
                      className={styles.progressBar}
                      initial={{ width: 0 }}
                      animate={{ width: `${processingProgress}%` }}
                      transition={{ ease: "easeInOut" }}
                    />
                  </div>

                  <div className={styles.spinnerContainer}>
                    <div className={styles.spinner}></div>
                    <Wand2 className={styles.magicWandIcon} size={20} />
                  </div>

                  <motion.p
                    className={styles.processingText}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    {processingProgress < 30 && "Analyzing your sketch..."}
                    {processingProgress >= 30 && processingProgress < 65 && "Enhancing details..."}
                    {processingProgress >= 65 && processingProgress < 95 && "Adding final touches..."}
                    {processingProgress >= 95 && "Almost done!"}
                  </motion.p>

                  <motion.p
                    className={styles.processingSubtext}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.7 }}
                    transition={{ delay: 0.5 }}
                  >
                    Creating high-quality artwork just for you
                  </motion.p>
                </motion.div>
              )}

              {/* Error display */}
              {error && !isProcessing && (
                <motion.div
                  className={styles.errorSection}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <AlertOctagon size={24} className={styles.errorIcon} />
                  <p className={styles.errorText}>{error}</p>
                  <motion.button
                    className={styles.retryButton}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <RefreshCw size={16} />
                    <span>Try Again</span>
                  </motion.button>
                </motion.div>
              )}

              {/* Generated Images Section */}
              {generatedImages.length > 0 && (
                <motion.div
                  className={styles.section}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <div className={styles.galleryHeader}>
                    <h3 className={styles.sectionTitle}>
                      <ImageIcon size={16} className={styles.sectionIcon} />
                      <span>Your Creations</span>
                      <div className={styles.imageCount}>{generatedImages.length}</div>
                    </h3>
                    <motion.button
                      className={styles.toggleGallery}
                      onClick={() => setShowGallery(!showGallery)}
                      type="button"
                      aria-label={showGallery ? "Hide gallery" : "Show gallery"}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      {showGallery ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </motion.button>
                  </div>

                  <div>
                    {showGallery && (
                      <motion.div
                        className={styles.generatedImagesGrid}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        {generatedImages.map((image) => (
                          <motion.div
                            key={image.id}
                            className={`${styles.generatedImageCard} ${selectedImageId === image.id ? styles.selected : ""}`}
                            onClick={() => handleImageSelect(image.id)}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            whileHover={{ y: -4, boxShadow: "0 8px 20px rgba(0,0,0,0.1)" }}
                          >
                            <div className={styles.imageContainer}>
                              <Image
                                src={image.src}
                                alt={image.title}
                                width={150}
                                height={150}
                                className={styles.generatedImage}
                                unoptimized={image.src.startsWith("blob:")}
                              />
                              <div className={styles.imageActions}>
                                <motion.button
                                  className={styles.imageActionButton}
                                  title="Preview"
                                  onClick={(e) => handlePreview(e, image)}
                                  type="button"
                                  whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.4)" }}
                                >
                                  <Eye size={14} />
                                </motion.button>
                                <motion.button
                                  className={styles.imageActionButton}
                                  title="Download"
                                  onClick={(e) => handleDownloadImage(e, image)}
                                  type="button"
                                  whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.4)" }}
                                >
                                  <Download size={14} />
                                </motion.button>
                                {mode === "pro" && (
                                  <motion.button
                                    className={styles.imageActionButton}
                                    title="Mint as NFT"
                                    onClick={(e) => handleMintClick(e, image.id)}
                                    type="button"
                                    whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.4)" }}
                                  >
                                    <Coins size={14} />
                                  </motion.button>
                                )}
                              </div>
                              {selectedImageId === image.id && (
                                <motion.div
                                  className={styles.selectedIndicator}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                />
                              )}
                            </div>
                            <div className={styles.imageDetails}>
                              <div className={styles.imageTitle}>{image.title}</div>
                              {selectedImageId === image.id && (
                                <div className={styles.selectedBadge}>Selected</div>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Action Buttons */}
              {generatedImages.length > 0 && (
                <motion.div
                  className={styles.section}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  <div className={styles.actionButtons}>
                    <motion.button
                      className={`${styles.actionButton} ${!selectedImageId ? styles.disabled : ""}`}
                      onClick={handleExport}
                      disabled={!selectedImageId}
                      type="button"
                      whileHover={selectedImageId ? { y: -3, boxShadow: "0 6px 10px rgba(0,0,0,0.1)" } : {}}
                      whileTap={selectedImageId ? { y: -1, boxShadow: "0 2px 5px rgba(0,0,0,0.1)" } : {}}
                    >
                      <Download size={18} />
                      <span>Download</span>
                    </motion.button>

                    <motion.button
                      className={`${styles.actionButton} ${!selectedImageId ? styles.disabled : ""}`}
                      onClick={handleShare}
                      disabled={!selectedImageId}
                      type="button"
                      whileHover={selectedImageId ? { y: -3, boxShadow: "0 6px 10px rgba(0,0,0,0.1)" } : {}}
                      whileTap={selectedImageId ? { y: -1, boxShadow: "0 2px 5px rgba(0,0,0,0.1)" } : {}}
                    >
                      <Share2 size={18} />
                      <span>Share</span>
                    </motion.button>

                    {mode === "pro" && (
                      <motion.button
                        className={`${styles.actionButton} ${styles.mintButton} ${!selectedImageId ? styles.disabled : ""}`}
                        onClick={handleMintNFT}
                        disabled={!selectedImageId}
                        type="button"
                        whileHover={selectedImageId ? { y: -3, boxShadow: "0 6px 12px rgba(0,0,0,0.15)" } : {}}
                        whileTap={selectedImageId ? { y: -1, boxShadow: "0 2px 5px rgba(0,0,0,0.15)" } : {}}
                      >
                        <Coins size={18} />
                        <span>Mint NFT</span>
                      </motion.button>
                    )}
                  </div>

                  {selectedImageId && (
                    <div className={styles.previewFrame}>
                      {generatedImages
                        .filter(img => img.id === selectedImageId)
                        .map(image => (
                          <div key={image.id} className={styles.selectedPreview}>
                            <Image
                              src={image.src}
                              alt={image.title}
                              width={280}
                              height={280}
                              className={styles.previewImage}
                              unoptimized={image.src.startsWith("blob:")}
                            />
                            <p className={styles.previewTitle}>{image.title}</p>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </motion.div>
              )}

              {/* Empty state */}
              {!isProcessing && !error && generatedImages.length === 0 && (
                <motion.div
                  className={styles.emptyState}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className={styles.emptyStateIconWrapper}>
                    <motion.div
                      animate={{
                        scale: [1, 1.05, 1],
                        rotate: [0, 5, 0, -5, 0]
                      }}
                      transition={{
                        duration: 4,
                        repeat: Infinity
                      }}
                    >
                      <Wand2 size={40} className={styles.emptyStateIcon} />
                    </motion.div>
                  </div>
                  <motion.p
                    className={styles.emptyStateText}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    Click &quot;{mode === "kids" ? "Magic Enhance" : "AI Enhance"}&quot; to transform your artwork
                  </motion.p>
                  <motion.p
                    className={styles.emptyStateSubtext}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.7 }}
                    transition={{ delay: 0.5 }}
                  >
                    Draw something first, then let AI do the magic
                  </motion.p>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          className={styles.sidebarOverlay}
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
};

export default RightPanel;