// src/components/RightPanel/RightPanel.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./RightPanel.module.scss";
import { useModeStore } from "@/stores/modeStore";
import Image from "next/image";
import {
  Wand2,
  Download,
  Coins,
  ChevronsRight,
  ChevronsLeft,
  X,
  Image as ImageIcon,
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Settings,
  BrainCircuit,
} from "lucide-react";

// Default values for generation parameters
const DEFAULT_PARAMS = {
  temperature: 0.65,
  guidanceScale: 0.82,
  numImages: 4
};

// Generated images for demo
const demoImages = [
  { id: 1, title: "Robot Sketch", src: "/demoSketch.png" },
  { id: 2, title: "Space Explorer", src: "/demoSketch.png" },
  { id: 3, title: "Fantasy Castle", src: "/demoSketch.png" },
  { id: 4, title: "Friendly Monster", src: "/demoSketch.png" }
];

const RightPanel = () => {
  const mode = useModeStore((s) => s.mode);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [showGallery, setShowGallery] = useState(true);
  const sidebarRef = useRef<HTMLElement | null>(null);

  // For demo purposes, we'll show all images by default
  const [generatedImages, setGeneratedImages] = useState(demoImages.slice(0, params.numImages));

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

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const resetToDefaults = () => {
    setParams(DEFAULT_PARAMS);
  };

  const handleGenerate = () => {
    console.log("Generating with prompt:", prompt);
    console.log("Negative prompt:", negativePrompt);
    console.log("Parameters:", params);

    // Update the number of images based on the parameter
    setGeneratedImages(demoImages.slice(0, params.numImages));
    setShowGallery(true);
  };

  const handleExport = () => {
    console.log("Exporting generated image");
    // Implementation would go here
  };

  const handleMint = () => {
    console.log("Minting NFT");
    // Implementation would go here
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
              <button
                className={styles.iconButton}
                onClick={() => setSidebarOpen(true)}
                title="AI Generation"
              >
                <Wand2 size={20} />
              </button>
              <button
                className={styles.iconButton}
                onClick={() => setSidebarOpen(true)}
                title="Actions"
              >
                <Sliders size={20} />
              </button>
              {generatedImages.length > 0 && (
                <button
                  className={styles.iconButton}
                  onClick={() => setSidebarOpen(true)}
                  title="Generated Images"
                >
                  <ImageIcon size={20} />
                </button>
              )}
            </div>
          )}

          {/* Expanded view content - only visible when expanded */}
          {sidebarOpen && (
            <>
              {/* Pro mode prompt controls */}
              {mode === "pro" && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    <MessageSquare size={16} className={styles.sectionIcon} />
                    <span>AI Generation</span>
                  </h3>

                  <div className={styles.promptInputGroup}>
                    <label className={styles.inputLabel}>Text Prompt</label>
                    <textarea
                      className={styles.promptInput}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe what you want to create..."
                      rows={3}
                    />
                  </div>

                  <div className={styles.promptInputGroup}>
                    <label className={styles.inputLabel}>Negative Prompt (Optional)</label>
                    <textarea
                      className={styles.promptInput}
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      placeholder="Describe what to avoid..."
                      rows={2}
                    />
                  </div>

                  {/* Advanced Parameters */}
                  <div className={styles.parametersToggle}>
                    <button
                      className={styles.toggleButton}
                      onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                      <Settings size={14} className={styles.settingsIcon} />
                      <span>Parameters</span>
                      {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {showAdvanced && (
                    <div className={styles.advancedParams}>
                      <div className={styles.paramSlider}>
                        <div className={styles.paramHeader}>
                          <label>Temperature (τ): {params.temperature.toFixed(2)}</label>
                          <div className={styles.paramLabels}>
                            <span>Precise</span>
                            <span>Creative</span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={params.temperature}
                          onChange={(e) => setParams({ ...params, temperature: parseFloat(e.target.value) })}
                          className={styles.slider}
                        />
                      </div>

                      <div className={styles.paramSlider}>
                        <div className={styles.paramHeader}>
                          <label>Guidance Scale: {params.guidanceScale.toFixed(2)}</label>
                          <div className={styles.paramLabels}>
                            <span>Diverse</span>
                            <span>Focused</span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={params.guidanceScale}
                          onChange={(e) => setParams({ ...params, guidanceScale: parseFloat(e.target.value) })}
                          className={styles.slider}
                        />
                      </div>

                      <div className={styles.paramSlider}>
                        <div className={styles.paramHeader}>
                          <label>Number of Images: {params.numImages}</label>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="4"
                          step="1"
                          value={params.numImages}
                          onChange={(e) => setParams({ ...params, numImages: parseInt(e.target.value) })}
                          className={styles.slider}
                        />
                        <div className={styles.numImagesIndicator}>
                          {Array.from({ length: 4 }).map((_, idx) => (
                            <div
                              key={idx}
                              className={`${styles.numBox} ${idx < params.numImages ? styles.active : ''}`}
                            />
                          ))}
                        </div>
                      </div>

                      <button
                        className={styles.resetButton}
                        onClick={resetToDefaults}
                      >
                        <RefreshCw size={14} />
                        <span>Reset to Defaults</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <Wand2 size={16} className={styles.sectionIcon} />
                  <span>Actions</span>
                </h3>

                <div className={styles.actionButtons}>
                  <button className={`${styles.actionButton} ${styles.generateButton}`} onClick={handleGenerate}>
                    <BrainCircuit size={18} />
                    <span>Generate</span>
                  </button>

                  <button className={styles.actionButton} onClick={handleExport}>
                    <Download size={18} />
                    <span>Export</span>
                  </button>

                  {mode === "pro" && (
                    <button className={`${styles.actionButton} ${styles.mintButton}`} onClick={handleMint}>
                      <Coins size={18} />
                      <span>Mint NFT</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Generated Images Gallery */}
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
                    >
                      {showGallery ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {showGallery && (
                    <div className={styles.generatedImagesGrid}>
                      {generatedImages.map((image) => (
                        <div key={image.id} className={styles.generatedImageCard}>
                          <div className={styles.imageContainer}>
                            <Image
                              src={image.src}
                              alt={image.title}
                              width={150}
                              height={150}
                              className={styles.generatedImage}
                            />
                            <div className={styles.imageActions}>
                              <button className={styles.imageActionButton} title="Download">
                                <Download size={14} />
                              </button>
                              {mode === "pro" && (
                                <button className={styles.imageActionButton} title="Mint as NFT">
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