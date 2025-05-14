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
  ExternalLink,
} from "lucide-react";
import { toast } from "react-toastify";

import { usePoolStore } from "@/stores/poolStore";
import { useModeStore } from "@/stores/modeStore";
import { useEnhanceStore } from "@/stores/enhanceStore";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMintNFT } from "@/lib/mintNFT";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

import ParentalControl from "../ParentalControl/ParentalContrl";
import CollectionDropdown from "@/components/CollectionDropdown/CollectionDropdown";

import {
  useResponsiveBehavior,
  useEnhanceEvents,
  useImageGallery,
  useParentalControl,
  useAdvancedParameters,
} from "./hooks";
import { mintNFT, isKidsMode } from "./utils";
import styles from "./RightPanel.module.scss";
import { useState } from "react";
import { useRouter } from "next/navigation";

const RightPanel: React.FC = () => {
  const {
    sidebarOpen,
    setSidebarOpen,
    isMobile,
    isTablet,
    sidebarRef,
    toggleSidebar,
  } = useResponsiveBehavior();

  const { generatedImages, selectedImageId, setSelectedImageId, error } =
    useEnhanceEvents(sidebarOpen, setSidebarOpen);

  const { showGallery, setShowGallery } = useImageGallery(setSelectedImageId);
  const [nftName, setNftName] = useState<string>("");
  const {
    showParentalDialog,
    setShowParentalDialog,
    mintingImage,
    setMintingImage,
    handleCloseParentalDialog,
  } = useParentalControl();
  const { showAdvanced, setShowAdvanced } = useAdvancedParameters();

  const walletContext = useWallet();
  const { setVisible } = useWalletModal();
  const mode = useModeStore((s) => s.mode);
  const { selectedPool } = usePoolStore();
  const { mintNft } = useMintNFT();
  const router = useRouter();

  const {
    temperature,
    setTemperature,
    guidanceScale,
    setGuidanceScale,
    numImages,
    setNumImages,
    resetToDefaults,
  } = useEnhanceStore();

  // Download handler
  const handleDirectDownload = () => {
    if (!selectedImageId) {
      toast.warning("Please select an image to download", {
        position: "bottom-left",
        autoClose: 3000,
      });
      return;
    }
    const img = generatedImages.find((i) => i.id === selectedImageId);
    if (!img) return;

    toast.info("Starting download...", {
      position: "bottom-left",
      autoClose: 2000,
      icon: () => <span>📥</span>,
    });

    fetch(img.url)
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `generated-image-${img.id}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setTimeout(() => {
          toast.success("Image downloaded successfully!", {
            position: "bottom-left",
            autoClose: 3000,
            icon: () => <span>✅</span>,
          });
        }, 1000);
      })
      .catch((e) =>
        toast.error(`Download failed: ${e.message}`, {
          position: "bottom-left",
          autoClose: 4000,
        })
      );
  };

  // Mint handler
  const handleMintNFT = async () => {
    // Check if wallet is connected - if not, open wallet modal
    if (!walletContext.connected || !walletContext.publicKey) {
      toast.info("Please connect your wallet to mint NFT", {
        position: "bottom-left",
        autoClose: 3000,
      });
      setVisible(true); // Open wallet connection modal
      return;
    }

    // Check if an image is selected
    if (!selectedImageId) {
      toast.warning("Please select an image from Generated Images to mint", {
        position: "bottom-left",
        autoClose: 3000,
      });
      return;
    }

    const success = await mintNFT(
      walletContext,
      selectedImageId,
      generatedImages,
      mode,
      selectedPool,
      mintNft,
      nftName.trim()
    );

    // If minting was successful, show extended success toast with link to Mintstreet
    if (success) {
      // Clear the name after successful mint
      if (nftName.trim()) {
        setNftName("");
      }

      // Show extended success message with action to navigate to Mintstreet
      toast.success(
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <span>🎉 NFT minted successfully!</span>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: "white",
              color: "#06b6d4",
              border: "1px solid #06b6d4",
              borderRadius: "6px",
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
            onClick={() => {
              router.push("/mintstreet");
              toast.dismiss();
            }}
          >
            View in Mintstreet <ExternalLink size={14} />
          </button>
        </div>,
        {
          position: "bottom-left",
          autoClose: 8000,
          closeOnClick: false,
          style: { maxWidth: "320px" },
        }
      );
    }
  };

  // Kids-mode mint click
  const handleKidsMintClick = (imageId: number) => {
    // Check if an image is selected
    if (!imageId) {
      toast.warning("Please select an image from Generated Images to mint", {
        position: "bottom-left",
        autoClose: 3000,
      });
      return;
    }

    const img = generatedImages.find((i) => i.id === imageId);
    if (!img) return;
    setSelectedImageId(imageId);
    setMintingImage(img);
    setShowParentalDialog(true);
  };

  // After parental approval
  const handleParentalApproval = () => {
    setShowParentalDialog(false);
    setTimeout(() => handleMintNFT(), 100);
  };

  return (
    <>
      {/* Mobile/Tablet toggle */}
      {(isMobile || isTablet) && (
        <button
          className={styles.mobileToggle}
          onClick={() => {
            if (sidebarOpen) {
              setSidebarOpen(false);
            } else {
              setSidebarOpen(true);
            }
          }}
          aria-label={sidebarOpen ? "Close panel" : "Open panel"}
        >
          {sidebarOpen ? <X size={18} /> : <ChevronsLeft size={18} />}
        </button>
      )}

      {/* Desktop collapse toggle */}
      {!isMobile && !isTablet && (
        <button
          className={`${styles.collapseToggle} ${
            !sidebarOpen ? styles.collapsed : ""
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

      <aside
        ref={sidebarRef}
        className={`${styles.panel} ${!sidebarOpen ? styles.collapsed : ""} ${
          isMobile ? styles.mobile : ""
        } ${isTablet ? styles.tablet : ""}`}
      >
        <div className={styles.panelContent}>
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

          {sidebarOpen && (
            <>
              {/* Advanced Params - Only show in Pro mode */}
              {mode === "pro" && (
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
                        aria-label={
                          showAdvanced ? "Hide parameters" : "Show parameters"
                        }
                      >
                        {showAdvanced ? (
                          <ChevronUp size={18} />
                        ) : (
                          <ChevronDown size={18} />
                        )}
                      </button>
                    </div>

                    {showAdvanced && (
                      <div className={styles.cardContent}>
                        {/* Temperature */}
                        <div className={styles.paramSlider}>
                          <div className={styles.paramHeader}>
                            <label htmlFor="temperature-slider">
                              <span className={styles.paramLabel}>
                                Temperature:
                              </span>
                              <span className={styles.paramValue}>
                                {temperature.toFixed(2)}
                              </span>
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

                        {/* Guidance Scale */}
                        <div className={styles.paramSlider}>
                          <div className={styles.paramHeader}>
                            <label htmlFor="guidance-slider">
                              <span className={styles.paramLabel}>
                                Guidance Scale:
                              </span>
                              <span className={styles.paramValue}>
                                {guidanceScale.toFixed(2)}
                              </span>
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

                        {/* Number of Images */}
                        <div className={styles.paramSlider}>
                          <div className={styles.paramHeader}>
                            <label htmlFor="num-images-slider">
                              <span className={styles.paramLabel}>
                                Number of Images:
                              </span>
                              <span className={styles.paramValue}>
                                {numImages}
                              </span>
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
                            {Array.from({ length: 4 }).map((_, i) => (
                              <div
                                key={i}
                                className={`${styles.numBox} ${
                                  i < numImages ? styles.active : ""
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Reset */}
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
                </div>
              )}

              {/* Collection Dropdown Section - Available in both modes */}
              <div className={styles.section}>
                {/* Section Title */}
                <h3 className={styles.sectionTitle}>
                  <Coins size={16} className={styles.sectionIcon} />
                  <span>Collection</span>
                </h3>

                {/* Show default collection */}
                {!selectedPool && (
                  <div className={styles.poolBadge}>
                    <div className={styles.poolIcon}>
                      {isKidsMode(mode) ? (
                        <Star size={16} />
                      ) : (
                        <Coins size={16} />
                      )}
                    </div>
                    <span className={styles.poolName}>
                      Default: {isKidsMode(mode) ? "Kids" : "Pro"} Collection
                    </span>
                  </div>
                )}

                {/* Collection Dropdown Component */}
                <CollectionDropdown mode={mode} />

                {/* Show selected pool */}
                {selectedPool && (
                  <div className={styles.poolBadge}>
                    <div className={styles.poolIcon}>
                      <Coins size={16} />
                    </div>
                    <span className={styles.poolName}>
                      Selected: {selectedPool.name}
                    </span>
                    <button
                      className={styles.clearPoolButton}
                      onClick={() =>
                        usePoolStore.getState().clearSelectedPool()
                      }
                      title="Clear pool selection"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className={styles.errorSection}>
                  <AlertOctagon size={24} className={styles.errorIcon} />
                  <p className={styles.errorText}>{error}</p>
                </div>
              )}

              {/* Gallery */}
              {generatedImages.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.galleryHeader}>
                    <h3 className={styles.sectionTitle}>
                      <ImageIcon size={16} className={styles.sectionIcon} />
                      <span>Generated Images</span>
                      <span className={styles.imageCount}>
                        {generatedImages.length}
                      </span>
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
                          className={`${styles.generatedImageCard} ${
                            selectedImageId === image.id ? styles.selected : ""
                          }`}
                          onClick={() => {
                            const newId =
                              image.id === selectedImageId ? null : image.id;
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

              {generatedImages.length > 0 && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>NFT Details</h3>
                  <div className={styles.nftNameInput}>
                    <label htmlFor="nft-name">NFT Name (Optional)</label>
                    <input
                      id="nft-name"
                      type="text"
                      value={nftName}
                      onChange={(e) => setNftName(e.target.value)}
                      placeholder={`${
                        selectedPool?.name ||
                        (isKidsMode(mode)
                          ? "Kids Collection"
                          : "Pro Collection")
                      } Artwork`}
                      className={styles.inputField}
                      maxLength={50}
                    />
                    <small className={styles.helperText}>
                      Leave empty to use default name
                    </small>
                  </div>
                </div>
              )}

              {/* Actions */}
              {generatedImages.length > 0 && (
                <div className={styles.section}>
                  <div
                    className={`${styles.actionButtons} ${
                      isMobile ? styles.mobileActions : ""
                    }`}
                  >
                    {mode === "pro" ? (
                      <button
                        className={`${styles.actionButton} ${
                          styles.mintButton
                        } ${
                          !selectedImageId || !selectedPool
                            ? styles.disabled
                            : ""
                        }`}
                        onClick={handleMintNFT}
                        disabled={!selectedImageId || !selectedPool}
                        type="button"
                      >
                        <Coins size={18} />
                        <span>Mint NFT</span>
                      </button>
                    ) : (
                      <button
                        className={`${styles.actionButton} ${
                          styles.kidsMintButton
                        } ${
                          !selectedImageId || !selectedPool
                            ? styles.disabled
                            : ""
                        }`}
                        onClick={() =>
                          selectedImageId &&
                          selectedPool &&
                          handleKidsMintClick(selectedImageId)
                        }
                        disabled={!selectedImageId || !selectedPool}
                        type="button"
                      >
                        <Coins size={18} />
                        <span>Mint NFT</span>
                        <span className={styles.parentalStar}>
                          <Star size={10} />
                        </span>
                      </button>
                    )}

                    <button
                      className={`${styles.actionButton} ${
                        styles.downloadButton
                      } ${!selectedImageId ? styles.disabled : ""}`}
                      onClick={handleDirectDownload}
                      disabled={!selectedImageId}
                      type="button"
                    >
                      <Download size={18} />
                      <span>Download</span>
                    </button>
                  </div>

                  {/* Updated hint message */}
                  {!selectedImageId && !selectedPool && (
                    <p className={styles.selectionHint}>
                      Select an image from Generated Images and choose a
                      collection pool to mint
                    </p>
                  )}
                  {selectedImageId && !selectedPool && (
                    <p className={styles.selectionHint}>
                      Please select a collection pool to mint your NFT
                    </p>
                  )}
                  {!selectedImageId && selectedPool && (
                    <p className={styles.selectionHint}>
                      Select an image from Generated Images above to mint
                    </p>
                  )}
                </div>
              )}

              {/* Empty state */}
              {!error && generatedImages.length === 0 && (
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

      <ParentalControl
        isOpen={showParentalDialog}
        onClose={handleCloseParentalDialog}
        onApprove={handleParentalApproval}
        image={mintingImage}
      />

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
