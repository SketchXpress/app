"use client";

import Image from "next/image";
import { toast } from "react-toastify";
import { useState, useRef, useEffect } from "react";
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
  Star
} from "lucide-react";
import {
  subscribeToEnhanceStarted,
  subscribeToEnhanceCompleted,
  subscribeToEnhanceFailed,
  EnhanceStartedEvent,
  EnhanceCompletedEvent,
  EnhanceFailedEvent
} from "@/lib/events";
import { useMintNFT } from "@/lib/mintNFT";
import { usePoolStore } from "@/stores/poolStore";
import { useModeStore } from "@/stores/modeStore";
import { useEnhanceStore } from "@/stores/enhanceStore";
import { useWallet } from "@solana/wallet-adapter-react";
import { uploadMetadataToIPFS } from "@/lib/uploadMetadataToIPFS";
import { uploadToIPFSUsingPinata } from "@/lib/uploadToIPFSUsingPinata";

import styles from "./RightPanel.module.scss";
import ParentalControl from "../ParentalControl/ParentalContrl";

// Extend event type to include base64 data (optional chaining used in code)
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
  // Parental control state
  const [showParentalDialog, setShowParentalDialog] = useState<boolean>(false);
  const [mintingImage, setMintingImage] = useState<GeneratedImage | null>(null);

  const sidebarRef = useRef<HTMLElement | null>(null);
  const walletContext = useWallet();
  const mode = useModeStore((s) => s.mode);
  const { selectedPool } = usePoolStore();

  const isKidsMode = () => mode === "kids";

  const { mintNft } = useMintNFT();

  // Get enhance store values
  const {
    prompt, setPrompt,
    negativePrompt, setNegativePrompt,
    temperature, setTemperature,
    guidanceScale, setGuidanceScale,
    numImages, setNumImages,
    resetToDefaults
  } = useEnhanceStore();

  // Defining default pools for Kids and Pro modes
  const DEFAULT_POOLS = {
    kids: {
      address: "2c1U9TKFcw5LVLRkEopaeVyxaj5aAefhA9syX9d2pUmL", // Replace with actual address
      name: "Kids Collection"
    },
    pro: {
      address: "2c1U9TKFcw5LVLRkEopaeVyxaj5aAefhA9syX9d2pUmL", // Replace with actual address
      name: "Pro Collection"
    }
  };

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
      setIsProcessing(true);
      setGeneratedImages([]); // Clear previous images
      setError(null);
      setCurrentJobId(data.jobId);

      // Auto-expand the panel when processing starts
      if (!sidebarOpen) {
        setSidebarOpen(true);
      }

      // Show toast notification for processing
      toast.info("Starting to enhance your artwork...", {
        position: "bottom-left",
        autoClose: 3000,
        icon: () => <span>🎨</span>
      });
    });

    // Handle enhance completed event
    const unsubscribeCompleted = subscribeToEnhanceCompleted(async (data: EnhanceCompletedEventWithBase64) => {
      setIsProcessing(false);
      setCurrentJobId(null); // Clear job ID once completed

      try {
        let images: GeneratedImage[] = [];

        // *** USE BASE64 DATA IF AVAILABLE ***
        if (data.images_base64 && data.images_base64.length > 0) {
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
              } catch {
                return null;
              }
            })
          ).then(results => results.filter(img => img !== null) as GeneratedImage[]); // Filter out nulls
        } else {
          console.warn("[RightPanel] No image data found in completed event.");
        }

        if (images.length > 0) {
          setGeneratedImages(images);
          setShowGallery(true);

          // Show success toast
          toast.success(`${images.length} image${images.length > 1 ? 's' : ''} generated successfully!`, {
            position: "bottom-left",
            autoClose: 4000,
            icon: () => <span>✨</span>
          });
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
    });

    // Handle enhance failed event
    const unsubscribeFailed = subscribeToEnhanceFailed((data: EnhanceFailedEvent) => {
      setIsProcessing(false);
      setCurrentJobId(null); // Clear job ID on failure
      setError(data.error || "Image generation failed");

      // Show error toast
      toast.error(data.error || "Image generation failed", {
        position: "bottom-left",
        autoClose: 5000,
      });
    });

    // Clean up subscriptions
    return () => {
      unsubscribeStarted();
      unsubscribeCompleted();
      unsubscribeFailed();
    };
  }, [sidebarOpen]); // Rerun if sidebarOpen changes (might affect auto-expand logic)

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

          // Don't immediately fail, maybe it's temporary
          // setError("Connection issue with backend - ngrok limitation?");
          // if (pollInterval) clearInterval(pollInterval);
          // setIsProcessing(false);
          return; // Try polling again
        }

        if (!response.ok) {

          // Keep polling unless it's a 404 (job not found)
          if (response.status === 404) {
            setError("Job not found. Please try again.");
            if (pollInterval) clearInterval(pollInterval);
            setIsProcessing(false);
            setCurrentJobId(null);

            // Show error toast
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
                } catch {

                  return null;
                }
              })
            ).then(results => results.filter(img => img !== null) as GeneratedImage[]); // Filter out nulls
          } else {
            console.warn("[Polling] No image data found in completed status response.");
          }

          if (images.length > 0) {

            setGeneratedImages(images);
            setShowGallery(true);
            setError(null); // Clear any previous error

            // Show success toast
            toast.success(`${images.length} image${images.length > 1 ? 's' : ''} generated successfully!`, {
              position: "bottom-left",
              autoClose: 4000,
              icon: () => <span>✨</span>
            });
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
  }, [currentJobId, isProcessing]); // Only restart polling if jobId changes or processing state changes

  // Clean up object URLs on unmount or when images change
  useEffect(() => {
    const currentImageSrcs = generatedImages.map(img => img.src);
    return () => {

      currentImageSrcs.forEach(src => {
        if (src.startsWith("blob:")) {

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
      toast.warning("Please select an image to export", {
        position: "bottom-left",
        autoClose: 3000,
      });
      return;
    }
    const selectedImage = generatedImages.find(img => img.id === selectedImageId);
    if (!selectedImage) return;


    // Show a toast notification that download is starting
    toast.info("Starting download...", {
      position: "bottom-left",
      autoClose: 2000,
      icon: () => <span>📥</span>
    });

    const link = document.createElement("a");
    link.href = selectedImage.url; // Use the original URL for download
    link.target = "_blank"; // Open in new tab might be better for ngrok links
    link.download = `generated-image-${selectedImageId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Show a success toast
    setTimeout(() => {
      toast.success("Image downloaded successfully!", {
        position: "bottom-left",
        autoClose: 3000,
        icon: () => <span>✅</span>
      });
    }, 1000); // Slight delay to avoid toast overlap
  };

  const handleMintNFT = async () => {
    if (!walletContext.connected || !walletContext.publicKey) {
      toast.error("Please connect your wallet first!", {
        position: "bottom-left",
        autoClose: 3000,
      });
      return;
    }

    if (!selectedImageId) {
      toast.warning("Please select an image to mint!", {
        position: "bottom-left",
        autoClose: 3000,
      });
      return;
    }

    const selectedImage = generatedImages.find(img => img.id === selectedImageId);
    if (!selectedImage) {
      toast.error("Selected image not found.", {
        position: "bottom-left",
        autoClose: 3000,
      });
      return;
    }

    try {
      // Determine which pool to use
      const defaultPool = isKidsMode() ?
        DEFAULT_POOLS.kids : DEFAULT_POOLS.pro;

      const poolInfo = selectedPool ?
        { address: selectedPool.address, name: selectedPool.name } :
        defaultPool;

      // Validate pool address format
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(poolInfo.address)) {
        console.log("Invalid pool address format:", poolInfo.address);
        throw new Error("Invalid pool address format");
      }

      // Show a loading toast that includes pool information
      const mintingToastId = toast.loading(`Starting NFT minting process on ${poolInfo.name}...`, {
        position: "bottom-right",
      });

      // Show a loading toast that includes pool information
      toast.loading(`Starting NFT minting process on ${poolInfo.name}...`, {
        position: "bottom-left",
      });

      // Fetch the image blob from the original URL
      const response = await fetch(selectedImage.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image for minting: ${response.status}`);
      }
      const blob = await response.blob();

      // Upload image to IPFS
      toast.update(mintingToastId, {
        render: "Uploading image to IPFS...",
        type: "info",
        isLoading: true
      });
      const imageIpfsUrl = await uploadToIPFSUsingPinata(blob);

      // Upload metadata to IPFS
      toast.update(mintingToastId, {
        render: "Uploading metadata to IPFS...",
        type: "info",
        isLoading: true
      });
      const metadataIpfsUrl = await uploadMetadataToIPFS(
        poolInfo.name + " Artwork",  // Use pool name in metadata
        "AI-enhanced artwork created with SketchXpress.",
        imageIpfsUrl
      );

      // Mint the NFT with pool info
      toast.update(mintingToastId, {
        render: `Creating your NFT on the ${poolInfo.name}...`,
        type: "info",
        isLoading: true
      });

      const result = await mintNft(
        poolInfo.address,
        poolInfo.name + " Artwork",
        "SXP",
        metadataIpfsUrl,
        500, // sellerFeeBasisPoints (5%)
        walletContext
      );

      const nftAddress = result?.nftMint;

      // Success toast with pool information
      toast.update(mintingToastId, {
        render: `🎉 NFT minted successfully on ${poolInfo.name}!\nAddress: ${nftAddress}`,
        type: 'success',
        isLoading: false,
        autoClose: 5000,
        closeButton: true,
        draggable: true,
        icon: () => <span>🖼️</span>
      });
    } catch (error) {
      toast.error(`Minting failed: ${error instanceof Error ? error.message : String(error)}`, {
        position: "bottom-left",
        autoClose: 5000,
      });
    }
  };

  // Handle Kids Mode mint button click with parental control
  const handleKidsMintClick = (imageId: number) => {
    const selectedImage = generatedImages.find(img => img.id === imageId);
    if (!selectedImage) return;

    setSelectedImageId(imageId);
    setMintingImage(selectedImage);
    setShowParentalDialog(true);
  };

  // Handle parental approval
  const handleParentalApproval = () => {
    // Close dialog first
    setShowParentalDialog(false);

    // Then proceed with minting
    setTimeout(() => handleMintNFT(), 100);
  };

  // Handle parental dialog close
  const handleCloseParentalDialog = () => {
    setShowParentalDialog(false);
    setMintingImage(null);
  };

  const handleImageSelect = (id: number) => {
    setSelectedImageId(id === selectedImageId ? null : id);

    // Optional: Show toast when selecting image
    if (id !== selectedImageId) {
      toast.info(`Image ${id} selected`, {
        position: "bottom-left",
        autoClose: 1500,
        hideProgressBar: true
      });
    }
  };

  // Individual image download button
  const handleDownloadImage = (e: React.MouseEvent, image: GeneratedImage) => {
    e.stopPropagation();


    // Show downloading toast
    toast.info("Starting download...", {
      position: "bottom-left",
      autoClose: 2000,
      icon: () => <span>📥</span>
    });

    const link = document.createElement("a");
    link.href = image.url;
    link.download = `generated-image-${image.id}.png`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Show success toast
    setTimeout(() => {
      toast.success("Image downloaded successfully!", {
        position: "bottom-left",
        autoClose: 3000,
        icon: () => <span>✅</span>
      });
    }, 1000); // Slight delay to avoid toast overlap
  };

  // Individual image mint button
  const handleMintClick = (e: React.MouseEvent, imageId: number) => {
    e.stopPropagation();
    setSelectedImageId(imageId); // Select the image first

    if (mode === "pro") {
      // Pro mode: Direct minting
      toast.info("Preparing to mint image...", {
        position: "bottom-left",
        autoClose: 2000,
        icon: () => <RefreshCw size={16} />
      });

      // Use setTimeout to allow state update before calling mint
      setTimeout(() => handleMintNFT(), 0);
    } else {
      // Kids mode: Show parental control dialog
      handleKidsMintClick(imageId);
    }
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
                <button
                  className={styles.iconButton}
                  onClick={() => setSidebarOpen(true)}
                  title="AI Parameters"
                >
                  <Settings size={20} />
                </button>
              )}
              <button
                className={styles.iconButton}
                onClick={() => setSidebarOpen(true)}
                title="Generated Images"
              >
                <ImageIcon size={20} />
              </button>
            </div>
          )}

          {/* Expanded view content */}
          {sidebarOpen && (
            <>
              {/* Pro mode parameters */}
              {mode === "pro" && !isProcessing && (
                <div className={styles.section}>
                  {/* Text Prompt Input */}
                  <div className={styles.promptInputGroup}>
                    <label htmlFor="prompt-input" className={styles.inputLabel}>Describe Your Art 🎨</label>
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
                    <button
                      className={styles.toggleButton}
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      type="button"
                    >
                      <Settings size={14} className={styles.settingsIcon} />
                      <span>Advanced Parameters</span>
                      {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {/* Advanced Parameters Panel */}
                  {showAdvanced && (
                    <div className={styles.advancedParams}>
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
                            <div
                              key={idx}
                              className={`${styles.numBox} ${idx < numImages ? styles.active : ""}`}
                            />
                          ))}
                        </div>
                      </div>
                      {/* Reset Button */}
                      <button
                        className={styles.resetButton}
                        onClick={() => {
                          resetToDefaults();
                          toast.info("Parameters reset to defaults", {
                            position: "bottom-left",
                            autoClose: 2000,
                            icon: () => <RefreshCw size={16} />
                          });
                        }}
                        type="button"
                      >
                        <RefreshCw size={14} />
                        <span>Reset to Defaults</span>
                      </button>
                    </div>
                  )}

                  {/* Pool Selection Indicator */}
                  {sidebarOpen && (
                    <div className={styles.poolIndicator}>
                      <div className={styles.poolBadge}>
                        <div className={styles.poolIcon}>
                          {selectedPool ? <Coins size={16} /> : (
                            isKidsMode() ? <Star size={16} /> : <Coins size={16} />
                          )}
                        </div>
                        <span className={styles.poolName}>
                          {selectedPool
                            ? `Minting to: ${selectedPool.name}`
                            : `Minting to: ${isKidsMode() ? 'Kids' : 'Pro'} Collection`}
                        </span>
                        {selectedPool && (
                          <button
                            className={styles.clearPoolButton}
                            onClick={() => usePoolStore.getState().clearSelectedPool()}
                            title="Clear pool selection"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Loading indicator */}
              {isProcessing && (
                <div className={styles.processingOverlay}>
                  <div className={styles.processingContent}>
                    <div className={styles.spinnerContainer}>
                      <div className={styles.spinner}></div>
                      <div className={styles.spinnerInner}></div>
                    </div>
                    <div>
                      <h3 className={styles.processingTitle}>
                        {useModeStore.getState().mode === "kids" ? "Magic Happening!" : "AI Enhancement"}
                      </h3>
                      <p className={styles.processingText}>
                        {useModeStore.getState().mode === "kids"
                          ? "Your sketch is being transformed into something amazing..."
                          : "Applying AI enhancement to your artwork..."}
                      </p>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error display */}
              {error && !isProcessing && (
                <div className={styles.errorSection}>
                  <AlertOctagon size={24} className={styles.errorIcon} />
                  <p className={styles.errorText}>{error}</p>
                </div>
              )}

              {/* Generated Images Section */}
              {generatedImages.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.galleryHeader}>
                    <h3 className={styles.sectionTitle}>
                      <ImageIcon size={16} className={styles.sectionIcon} />
                      <span>Generated Images</span>
                    </h3>
                    <button
                      className={styles.toggleGallery}
                      onClick={() => setShowGallery(!showGallery)}
                      type="button"
                      aria-label={showGallery ? "Hide gallery" : "Show gallery"}
                    >
                      {showGallery ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {showGallery && (
                    <div className={styles.generatedImagesGrid}>
                      {generatedImages.map((image) => (
                        <div
                          key={image.id}
                          className={`${styles.generatedImageCard} ${selectedImageId === image.id ? styles.selected : ""}`}
                          onClick={() => handleImageSelect(image.id)}
                        >
                          <div className={styles.imageContainer}>
                            <Image
                              src={image.src} // Use the src (base64 or blob URL)
                              alt={image.title}
                              width={150} // Adjust size as needed
                              height={150}
                              className={styles.generatedImage}
                              unoptimized={image.src.startsWith("blob:")} // Avoid Next.js optimization for blob URLs
                            />
                            <div className={styles.imageActions}>
                              <button
                                className={styles.imageActionButton}
                                title="Download"
                                onClick={(e) => handleDownloadImage(e, image)}
                                type="button"
                              >
                                <Download size={14} />
                              </button>
                              {/* Display mint button for both modes, but with different behaviors */}
                              <button
                                className={styles.imageActionButton}
                                title={mode === "pro" ? "Mint as NFT" : "Mint as NFT (Parent Approval Required)"}
                                onClick={(e) => handleMintClick(e, image.id)}
                                type="button"
                              >
                                <Coins size={14} />
                                {mode === "kids" && <span className={styles.parentalStar}><Star size={8} /></span>}
                              </button>
                            </div>
                          </div>
                          <div className={styles.imageTitle}>{image.title}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              {generatedImages.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.actionButtons}>
                    <button
                      className={`${styles.actionButton} ${!selectedImageId ? styles.disabled : ""}`}
                      onClick={handleExport}
                      disabled={!selectedImageId}
                      type="button"
                    >
                      <Download size={18} />
                      <span>Export</span>
                    </button>

                    {/* Modify the mint button to work with both modes */}
                    {mode === "pro" ? (
                      <button
                        className={`${styles.actionButton} ${styles.mintButton} ${!selectedImageId ? styles.disabled : ""}`}
                        onClick={handleMintNFT}
                        disabled={!selectedImageId}
                        type="button"
                      >
                        <Coins size={18} />
                        <span>Mint NFT</span>
                      </button>
                    ) : (
                      <button
                        className={`${styles.actionButton} ${styles.kidsMintButton} ${!selectedImageId ? styles.disabled : ""}`}
                        onClick={() => selectedImageId && handleKidsMintClick(selectedImageId)}
                        disabled={!selectedImageId}
                        type="button"
                      >
                        <Coins size={18} />
                        <span>Mint NFT</span>
                        <span className={styles.parentalStar}><Star size={10} /></span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!isProcessing && !error && generatedImages.length === 0 && (
                <div className={styles.emptyState}>
                  <ImageIcon size={40} className={styles.emptyStateIcon} />
                  <p className={styles.emptyStateText}>
                    Click &quot;AI Enhance&quot; to see results here.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Parental Control Dialog Component */}
      <ParentalControl
        isOpen={showParentalDialog}
        onClose={handleCloseParentalDialog}
        onApprove={handleParentalApproval}
        image={mintingImage}
      />

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />
      )}
    </>
  );
};

export default RightPanel;