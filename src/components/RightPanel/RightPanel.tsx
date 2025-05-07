"use client";

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
  RefreshCw,
  AlertOctagon,
  Star,
  Sliders,
} from "lucide-react";
import { toast } from "react-toastify";

import { usePoolStore } from "@/stores/poolStore";
import { useModeStore } from "@/stores/modeStore";
import { useEnhanceStore } from "@/stores/enhanceStore";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMintNFT } from "@/lib/mintNFT";

import ParentalControl from "../ParentalControl/ParentalContrl";

// Import custom hooks and utilities
import {
  useResponsiveBehavior,
  useEnhanceEvents,
  useImageGallery,
  useParentalControl,
  useAdvancedParameters,
} from "./hooks";
import {
  mintNFT,
  isKidsMode,
} from "./utils";
import styles from "./RightPanel.module.scss";
import { GeneratedImage } from "./types";

const RightPanel: React.FC = () => {
  // Get custom hooks
  const {
    sidebarOpen,
    setSidebarOpen,
    isMobile,
    isTablet,
    sidebarRef,
    toggleSidebar,
  } = useResponsiveBehavior();

  // Get enhance events
  const {
    generatedImages,
    selectedImageId,
    setSelectedImageId,
    isProcessing,
    error,
  } = useEnhanceEvents(sidebarOpen, setSidebarOpen);

  // Get image gallery
  const { showGallery, setShowGallery } = useImageGallery(
    setSelectedImageId
  );

  // Get parental control
  const {
    showParentalDialog,
    setShowParentalDialog,
    mintingImage,
    setMintingImage,
    handleCloseParentalDialog,
  } = useParentalControl();

  // Get advanced parameters
  const { showAdvanced, setShowAdvanced } = useAdvancedParameters();

  // Context and stores
  const walletContext = useWallet();
  const mode = useModeStore((s) => s.mode);
  const { selectedPool } = usePoolStore();
  const { mintNft } = useMintNFT();

  // Get enhance store values
  const {
    temperature,
    setTemperature,
    guidanceScale,
    setGuidanceScale,
    numImages,
    setNumImages,
    resetToDefaults,
  } = useEnhanceStore();

  // Handle direct download instead of opening in new tab
  const handleDirectDownload = () => {
    if (!selectedImageId) {
      toast.warning("Please select an image to download", {
        position: "bottom-left",
        autoClose: 3000,
      });
      return;
    }

    const selectedImage = generatedImages.find(
      (img) => img.id === selectedImageId
    );

    if (!selectedImage) return;

    // Show toast notification that download is starting
    toast.info("Starting download...", {
      position: "bottom-left",
      autoClose: 2000,
      icon: () => <span>📥</span>,
    });

    // Create a fetch request to get the image as a blob
    fetch(selectedImage.url)
      .then(response => response.blob())
      .then(blob => {
        // Create a download link and trigger it
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `generated-image-${selectedImageId}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        // Show success toast
        setTimeout(() => {
          toast.success("Image downloaded successfully!", {
            position: "bottom-left",
            autoClose: 3000,
            icon: () => <span>✅</span>,
          });
        }, 1000);
      })
      .catch(error => {
        toast.error(`Download failed: ${error.message}`, {
          position: "bottom-left",
          autoClose: 4000,
        });
      });
  };

  // Handle NFT minting
  const handleMintNFT = async () => {
    await mintNFT(
      walletContext,
      selectedImageId,
      generatedImages,
      mode,
      selectedPool,
      mintNft
    );
  };

  // Handle Kids Mode mint button click with parental control
  const handleKidsMintClick = (imageId: number) => {
    const selectedImage = generatedImages.find((img) => img.id === imageId);
    if (!selectedImage) return;

    setSelectedImageId(imageId);
    setMintingImage(selectedImage);
    setShowParentalDialog(true);
  };

  // Handle image minting click (with potential parental control)
  const handleMintClick = (e: React.MouseEvent, imageId: number) => {
    e.stopPropagation();
    setSelectedImageId(imageId); // Select the image first

    if (mode === "pro") {
      // Pro mode: Direct minting
      toast.info("Preparing to mint image...", {
        position: "bottom-left",
        autoClose: 2000,
        icon: () => <span>⏳</span>,
      });

      // Use setTimeout to allow state update before calling mint
      setTimeout(() => handleMintNFT(), 0);
    } else {
      // Kids mode: Show parental control dialog
      handleKidsMintClick(imageId);
    }
  };

  // Handle parental approval
  const handleParentalApproval = () => {
    // Close dialog first
    setShowParentalDialog(false);

    // Then proceed with minting
    setTimeout(() => handleMintNFT(), 100);
  };

  // Handle direct image download
  const handleDirectImageDownload = (e: React.MouseEvent, image: GeneratedImage) => {
    e.stopPropagation();

    // Show downloading toast
    toast.info("Starting download...", {
      position: "bottom-left",
      autoClose: 2000,
      icon: () => <span>📥</span>,
    });

    // Create a fetch request to get the image as a blob
    fetch(image.url)
      .then(response => response.blob())
      .then(blob => {
        // Create a download link and trigger it
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `generated-image-${image.id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        // Show success toast
        setTimeout(() => {
          toast.success("Image downloaded successfully!", {
            position: "bottom-left",
            autoClose: 3000,
            icon: () => <span>✅</span>,
          });
        }, 1000);
      })
      .catch(error => {
        toast.error(`Download failed: ${error.message}`, {
          position: "bottom-left",
          autoClose: 4000,
        });
      });
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
          className={`${styles.collapseToggle} ${!sidebarOpen ? styles.collapsed : ""
            }`}
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Collapse panel" : "Expand panel"}
        >
          {sidebarOpen ? (
            <ChevronsRight size={18} />
          ) : (
            <ChevronsLeft size={18} />
          )}
        </button>
      )}

      {/* Panel content */}
      <aside
        ref={sidebarRef}
        className={`${styles.panel} ${!sidebarOpen ? styles.collapsed : ""} ${isMobile ? styles.mobile : ""
          } ${isTablet ? styles.tablet : ""}`}
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
                  <Sliders size={20} />
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
              {/* Pro mode parameters section - Redesigned */}
              {mode === "pro" && !isProcessing && (
                <div className={styles.section}>
                  <div className={styles.advancedParametersCard}>
                    <div
                      className={styles.cardHeader}
                      onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                      <div className={styles.cardTitle}>
                        <Sliders size={18} className={styles.cardIcon} />
                        <h3>Advanced Parameters</h3>
                      </div>
                      <button
                        className={styles.toggleAdvancedButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAdvanced(!showAdvanced);
                        }}
                        type="button"
                        aria-label={showAdvanced ? "Hide parameters" : "Show parameters"}
                      >
                        {showAdvanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>

                    {showAdvanced && (
                      <div className={styles.cardContent}>
                        {/* Temperature Slider */}
                        <div className={styles.paramSlider}>
                          <div className={styles.paramHeader}>
                            <label htmlFor="temperature-slider">
                              <span className={styles.paramLabel}>Temperature:</span>
                              <span className={styles.paramValue}>{temperature.toFixed(2)}</span>
                            </label>
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
                            onChange={(e) =>
                              setTemperature(parseFloat(e.target.value))
                            }
                            className={styles.slider}
                          />
                        </div>

                        {/* Guidance Scale Slider */}
                        <div className={styles.paramSlider}>
                          <div className={styles.paramHeader}>
                            <label htmlFor="guidance-slider">
                              <span className={styles.paramLabel}>Guidance Scale:</span>
                              <span className={styles.paramValue}>{guidanceScale.toFixed(2)}</span>
                            </label>
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
                            onChange={(e) =>
                              setGuidanceScale(parseFloat(e.target.value))
                            }
                            className={styles.slider}
                          />
                        </div>

                        {/* Number of Images Slider */}
                        <div className={styles.paramSlider}>
                          <div className={styles.paramHeader}>
                            <label htmlFor="num-images-slider">
                              <span className={styles.paramLabel}>Number of Images:</span>
                              <span className={styles.paramValue}>{numImages}</span>
                            </label>
                          </div>
                          <input
                            id="num-images-slider"
                            type="range"
                            min="1"
                            max="4"
                            step="1"
                            value={numImages}
                            onChange={(e) =>
                              setNumImages(parseInt(e.target.value, 10))
                            }
                            className={styles.slider}
                          />
                          <div className={styles.numImagesIndicator}>
                            {Array.from({ length: 4 }).map((_, idx) => (
                              <div
                                key={idx}
                                className={`${styles.numBox} ${idx < numImages ? styles.active : ""
                                  }`}
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
                              icon: () => <RefreshCw size={16} />,
                            });
                          }}
                          type="button"
                        >
                          <RefreshCw size={14} />
                          <span>Reset to Defaults</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Pool Selection Indicator - Redesigned */}
                  <div className={styles.poolBadgeContainer}>
                    <div className={styles.poolBadge}>
                      <div className={styles.poolIcon}>
                        {selectedPool ? (
                          <Coins size={16} />
                        ) : isKidsMode(mode) ? (
                          <Star size={16} />
                        ) : (
                          <Coins size={16} />
                        )}
                      </div>
                      <span className={styles.poolName}>
                        {selectedPool
                          ? `Minting to: ${selectedPool.name}`
                          : `Minting to: ${isKidsMode(mode) ? "Kids" : "Pro"
                          } Collection`}
                      </span>
                      {selectedPool && (
                        <button
                          className={styles.clearPoolButton}
                          onClick={() =>
                            usePoolStore.getState().clearSelectedPool()
                          }
                          title="Clear pool selection"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
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
                        {useModeStore.getState().mode === "kids"
                          ? "Magic Happening!"
                          : "AI Enhancement"}
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

              {/* Generated Images Section - Enhanced */}
              {generatedImages.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.galleryHeader}>
                    <h3 className={styles.sectionTitle}>
                      <ImageIcon size={16} className={styles.sectionIcon} />
                      <span>Generated Images</span>
                      <span className={styles.imageCount}>{generatedImages.length}</span>
                    </h3>
                    <button
                      className={styles.toggleGallery}
                      onClick={() => setShowGallery(!showGallery)}
                      type="button"
                      aria-label={showGallery ? "Hide gallery" : "Show gallery"}
                    >
                      {showGallery ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </button>
                  </div>

                  {showGallery && (
                    <div className={styles.generatedImagesGrid}>
                      {generatedImages.map((image) => (
                        <div
                          key={image.id}
                          className={`${styles.generatedImageCard} ${selectedImageId === image.id ? styles.selected : ""
                            }`}
                          onClick={() => {
                            const newId = image.id === selectedImageId ? null : image.id;
                            setSelectedImageId(newId);
                            if (newId !== null) {
                              toast.info(`Image ${image.id} selected`, {
                                position: "bottom-left",
                                autoClose: 1500,
                                hideProgressBar: true,
                              });
                            }
                          }}
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
                              <button
                                className={styles.imageActionButton}
                                title="Download"
                                onClick={(e) => handleDirectImageDownload(e, image)}
                                type="button"
                              >
                                <Download size={14} />
                              </button>
                              <button
                                className={styles.imageActionButton}
                                title={
                                  mode === "pro"
                                    ? "Mint as NFT"
                                    : "Mint as NFT (Parent Approval Required)"
                                }
                                onClick={(e) => handleMintClick(e, image.id)}
                                type="button"
                              >
                                <Coins size={14} />
                                {mode === "kids" && (
                                  <span className={styles.parentalStar}>
                                    <Star size={8} />
                                  </span>
                                )}
                              </button>
                            </div>
                            {selectedImageId === image.id && (
                              <div className={styles.selectedIndicator} />
                            )}
                          </div>
                          <div className={styles.imageTitle}>{image.title}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons - Mobile order reversed */}
              {generatedImages.length > 0 && (
                <div className={styles.section}>
                  <div className={`${styles.actionButtons} ${isMobile ? styles.mobileActions : ''}`}>
                    {/* The mint button appears first on mobile */}
                    {mode === "pro" ? (
                      <button
                        className={`${styles.actionButton} ${styles.mintButton}
                          ${!selectedImageId ? styles.disabled : ""}`}
                        onClick={handleMintNFT}
                        disabled={!selectedImageId}
                        type="button"
                      >
                        <Coins size={18} />
                        <span>Mint NFT</span>
                      </button>
                    ) : (
                      <button
                        className={`${styles.actionButton} ${styles.kidsMintButton}
                          ${!selectedImageId ? styles.disabled : ""}`}
                        onClick={() =>
                          selectedImageId &&
                          handleKidsMintClick(selectedImageId)
                        }
                        disabled={!selectedImageId}
                        type="button"
                      >
                        <Coins size={18} />
                        <span>Mint NFT</span>
                        <span className={styles.parentalStar}>
                          <Star size={10} />
                        </span>
                      </button>
                    )}

                    {/* Download button renamed from Export */}
                    <button
                      className={`${styles.actionButton} ${styles.downloadButton}
                        ${!selectedImageId ? styles.disabled : ""}`}
                      onClick={handleDirectDownload}
                      disabled={!selectedImageId}
                      type="button"
                    >
                      <Download size={18} />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!isProcessing && !error && generatedImages.length === 0 && (
                <div className={styles.emptyState}>
                  <div className={styles.emptyStateIconWrapper}>
                    <ImageIcon size={30} className={styles.emptyStateIcon} />
                  </div>
                  <p className={styles.emptyStateText}>
                    Click &quot;AI Enhance&quot; to see results here.
                  </p>
                  <p className={styles.emptyStateSubtext}>
                    Your enhanced images will appear in this panel.
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
        <div
          className={styles.sidebarOverlay}
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
};

export default RightPanel;