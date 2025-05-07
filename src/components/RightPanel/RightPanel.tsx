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
  Settings,
  RefreshCw,
  AlertOctagon,
  Star,
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
  handleExport,
  handleDownloadImage,
  mintNFT,
  isKidsMode,
} from "./utils";
import styles from "./RightPanel.module.scss";

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
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    temperature,
    setTemperature,
    guidanceScale,
    setGuidanceScale,
    numImages,
    setNumImages,
    resetToDefaults,
  } = useEnhanceStore();

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
                    <label htmlFor="prompt-input" className={styles.inputLabel}>
                      Describe Your Art 🎨
                    </label>
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
                    <label
                      htmlFor="negative-prompt-input"
                      className={styles.inputLabel}
                    >
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
                      {showAdvanced ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                  </div>

                  {/* Advanced Parameters Panel */}
                  {showAdvanced && (
                    <div className={styles.advancedParams}>
                      {/* Temperature Slider */}
                      <div className={styles.paramSlider}>
                        <div className={styles.paramHeader}>
                          <label htmlFor="temperature-slider">
                            Temperature: {temperature.toFixed(2)}
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
                            Guidance Scale: {guidanceScale.toFixed(2)}
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
                            Number of Images: {numImages}
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

                  {/* Pool Selection Indicator */}
                  {sidebarOpen && (
                    <div className={styles.poolIndicator}>
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
                      className={`${styles.actionButton} ${!selectedImageId ? styles.disabled : ""
                        }`}
                      onClick={() => handleExport(selectedImageId, generatedImages)}
                      disabled={!selectedImageId}
                      type="button"
                    >
                      <Download size={18} />
                      <span>Export</span>
                    </button>

                    {/* Modify the mint button to work with both modes */}
                    {mode === "pro" ? (
                      <button
                        className={`${styles.actionButton} ${styles.mintButton
                          } ${!selectedImageId ? styles.disabled : ""}`}
                        onClick={handleMintNFT}
                        disabled={!selectedImageId}
                        type="button"
                      >
                        <Coins size={18} />
                        <span>Mint NFT</span>
                      </button>
                    ) : (
                      <button
                        className={`${styles.actionButton} ${styles.kidsMintButton
                          } ${!selectedImageId ? styles.disabled : ""}`}
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
        <div
          className={styles.sidebarOverlay}
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
};

export default RightPanel;