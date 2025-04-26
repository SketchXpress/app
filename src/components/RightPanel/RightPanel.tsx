"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./RightPanel.module.scss";
import { useModeStore } from "@/stores/modeStore";
import { useEnhanceStore } from "@/stores/enhanceStore";
import Image from "next/image";
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
  AlertOctagon
} from "lucide-react";
import {
  subscribeToEnhanceStarted,
  subscribeToEnhanceCompleted,
  subscribeToEnhanceFailed,
  EnhanceStartedEvent,
  EnhanceCompletedEvent,
  EnhanceFailedEvent
} from "@/lib/events";

// Image type definition
interface GeneratedImage {
  id: number;
  title: string;
  src: string;
  url: string; // Full URL for the image from the backend
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
  const sidebarRef = useRef<HTMLElement | null>(null);

  // Get enhance store values
  const {
    prompt, setPrompt,
    negativePrompt, setNegativePrompt,
    temperature, setTemperature,
    guidanceScale, setGuidanceScale,
    numImages, setNumImages,
    resetToDefaults
  } = useEnhanceStore();

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
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
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
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobile, isTablet, sidebarOpen]);

  // Subscribe to enhance events
  useEffect(() => {
    // Handle enhance started event
    const unsubscribeStarted = subscribeToEnhanceStarted((data: EnhanceStartedEvent) => {
      setIsProcessing(true);
      setGeneratedImages([]);
      setError(null);
      setCurrentJobId(data.jobId);

      // Auto-expand the panel when processing starts
      if (!sidebarOpen) {
        setSidebarOpen(true);
      }
    });

    // Handle enhance completed event
    const unsubscribeCompleted = subscribeToEnhanceCompleted(async (data: EnhanceCompletedEvent) => {
      setIsProcessing(false);

      try {
        // Convert backend image paths to GeneratedImage format
        const images: GeneratedImage[] = await Promise.all(
          data.images.map(async (imagePath, index) => {
            console.log(`Processing image path: ${imagePath}`);

            // Extract just the filename from the path
            const pathParts = imagePath.split('/');
            const filename = pathParts[pathParts.length - 1];

            // Construct URL directly to the /generated/ endpoint
            const fullUrl = `http://localhost:8000/generated/${filename}`;
            console.log(`Trying to fetch image ${index + 1} from: ${fullUrl}`);

            // For image previews, fetch the image
            try {
              const response = await fetch(fullUrl);
              if (!response.ok) {
                console.error(`Failed to fetch image from ${fullUrl}, status: ${response.status}`);
                throw new Error(`Failed to fetch image: ${imagePath}`);
              }

              const blob = await response.blob();
              console.log(`Successfully fetched image ${index + 1}, size: ${blob.size} bytes`);

              return {
                id: index + 1,
                title: `Generated Image ${index + 1}`,
                src: URL.createObjectURL(blob), // Create local URL for the Image component
                url: fullUrl // Store original URL for downloads
              };
            } catch (error) {
              console.error(`Error fetching image ${index + 1}:`, error);
              throw error;
            }
          })
        );

        setGeneratedImages(images);
        setShowGallery(true);
      } catch (err) {
        console.error("Error loading generated images:", err);
        setError("Failed to load generated images");
      }
    });

    // Handle enhance failed event
    const unsubscribeFailed = subscribeToEnhanceFailed((data: EnhanceFailedEvent) => {
      setIsProcessing(false);
      setError(data.error);
    });

    // Clean up subscriptions
    return () => {
      unsubscribeStarted();
      unsubscribeCompleted();
      unsubscribeFailed();
    };
  }, [sidebarOpen]);

  // Poll for job status if needed (backup in case events miss something)
  useEffect(() => {
    if (!currentJobId || !isProcessing) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/status/${currentJobId}`);
        if (!response.ok) {
          console.error("Error polling job status:", await response.text());
          return;
        }

        const data = await response.json();

        if (data.status === "completed") {
          clearInterval(pollInterval);
          setIsProcessing(false);

          // Handle images similar to the event handler
          const images: GeneratedImage[] = await Promise.all(
            data.images.map(async (imagePath: string, index: number) => {
              console.log(`Polling: Processing image path: ${imagePath}`);

              // Extract just the filename from the path
              const pathParts = imagePath.split('/');
              const filename = pathParts[pathParts.length - 1];

              // Construct URL directly to the /generated/ endpoint
              const fullUrl = `http://localhost:8000/generated/${filename}`;
              console.log(`Polling: Trying to fetch image ${index + 1} from: ${fullUrl}`);

              try {
                const response = await fetch(fullUrl);
                if (!response.ok) {
                  console.error(`Polling: Failed to fetch image from ${fullUrl}, status: ${response.status}`);
                  throw new Error(`Failed to fetch image: ${imagePath}`);
                }

                const blob = await response.blob();
                console.log(`Polling: Successfully fetched image ${index + 1}, size: ${blob.size} bytes`);

                return {
                  id: index + 1,
                  title: `Generated Image ${index + 1}`,
                  src: URL.createObjectURL(blob),
                  url: fullUrl
                };
              } catch (error) {
                console.error(`Polling: Error fetching image ${index + 1}:`, error);
                throw error;
              }
            })
          );

          setGeneratedImages(images);
        } else if (data.status === "failed") {
          clearInterval(pollInterval);
          setIsProcessing(false);
          setError(data.error || "Generation failed");
        }
      } catch (err) {
        console.error("Error polling job status:", err);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [currentJobId, isProcessing]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      generatedImages.forEach(image => {
        if (image.src.startsWith('blob:')) {
          URL.revokeObjectURL(image.src);
        }
      });
    };
  }, [generatedImages]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleExport = () => {
    if (!selectedImageId) {
      alert("Please select an image to export");
      return;
    }

    const selectedImage = generatedImages.find(img => img.id === selectedImageId);
    if (!selectedImage) return;

    // Create a temporary link to download the image
    const link = document.createElement('a');
    link.href = selectedImage.url;
    link.target = '_blank';
    link.download = `generated-image-${selectedImageId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMintNFT = () => {
    if (!selectedImageId) {
      alert("Please select an image to mint as NFT");
      return;
    }

    console.log("Minting image with ID:", selectedImageId);
    // Implementation would go here for NFT minting
    alert("NFT minting functionality will be implemented in a future update");
  };

  const handleImageSelect = (id: number) => {
    setSelectedImageId(id === selectedImageId ? null : id);
  };

  const handleDownloadImage = (e: React.MouseEvent, image: GeneratedImage) => {
    e.stopPropagation(); // Prevent selection of the image

    const link = document.createElement('a');
    link.href = image.url;
    link.download = `generated-image-${image.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMintClick = (e: React.MouseEvent, imageId: number) => {
    e.stopPropagation(); // Prevent selection of the image
    setSelectedImageId(imageId);
    handleMintNFT();
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
          className={`${styles.collapseToggle} ${!sidebarOpen ? styles.collapsed : ''}`}
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Collapse panel" : "Expand panel"}
        >
          {sidebarOpen ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </button>
      )}

      {/* Panel content */}
      <aside
        ref={sidebarRef}
        className={`${styles.panel} ${!sidebarOpen ? styles.collapsed : ''} ${isMobile ? styles.mobile : ''} ${isTablet ? styles.tablet : ''}`}
      >
        <div className={styles.panelContent}>
          {/* Collapsed view buttons - only visible when collapsed */}
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

          {/* Expanded view content - only visible when expanded */}
          {sidebarOpen && (
            <>
              {/* Pro mode prompt and parameters */}
              {mode === "pro" && !isProcessing && (
                <div className={styles.section}>
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
                              className={`${styles.numBox} ${idx < numImages ? styles.active : ''}`}
                            />
                          ))}
                        </div>
                      </div>

                      <button
                        className={styles.resetButton}
                        onClick={resetToDefaults}
                        type="button"
                      >
                        <RefreshCw size={14} />
                        <span>Reset to Defaults</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Loading indicator when processing */}
              {isProcessing && (
                <div className={styles.processingSection}>
                  <div className={styles.spinner}></div>
                  <p className={styles.processingText}>
                    Transforming your sketch into amazing artwork...
                  </p>
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
                          className={`${styles.generatedImageCard} ${selectedImageId === image.id ? styles.selected : ''}`}
                          onClick={() => handleImageSelect(image.id)}
                        >
                          <div className={styles.imageContainer}>
                            <Image
                              src={image.src}
                              alt={image.title}
                              width={150}
                              height={150}
                              className={styles.generatedImage}
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
                              {mode === "pro" && (
                                <button
                                  className={styles.imageActionButton}
                                  title="Mint as NFT"
                                  onClick={(e) => handleMintClick(e, image.id)}
                                  type="button"
                                >
                                  <Coins size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className={styles.imageTitle}>{image.title}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons - only enabled when an image is selected */}
              {generatedImages.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.actionButtons}>
                    <button
                      className={`${styles.actionButton} ${!selectedImageId ? styles.disabled : ''}`}
                      onClick={handleExport}
                      disabled={!selectedImageId}
                      type="button"
                    >
                      <Download size={18} />
                      <span>Export</span>
                    </button>

                    {mode === "pro" && (
                      <button
                        className={`${styles.actionButton} ${styles.mintButton} ${!selectedImageId ? styles.disabled : ''}`}
                        onClick={handleMintNFT}
                        disabled={!selectedImageId}
                        type="button"
                      >
                        <Coins size={18} />
                        <span>Mint NFT</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Empty state when no images generated yet */}
              {!isProcessing && !error && generatedImages.length === 0 && (
                <div className={styles.emptyState}>
                  <ImageIcon size={40} className={styles.emptyStateIcon} />
                  <p className={styles.emptyStateText}>
                    Draw something and click &quot;AI Enhance&quot; to transform your sketch!
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />
      )}
    </>
  );
};

export default RightPanel;