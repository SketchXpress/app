"use client";

import { useState, useEffect, useRef } from "react";
import { AssetRecordType } from "@tldraw/tldraw";
import Image from "next/image";
import styles from "./LeftSidebar.module.scss";
import { useModeStore } from "@/stores/modeStore";
import {
  Upload,
  Lightbulb,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Zap,
  PenTool,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Brush,
  X,
  Layers,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { useCanvasStore } from "@/stores/canvasStore";

const examples = [
  { id: 1, title: "Robot Sketch", thumbnail: "/demoSketch.png" },
  { id: 2, title: "Space Explorer", thumbnail: "/demoSketch.png" },
  { id: 3, title: "Fantasy Castle", thumbnail: "/demoSketch.png" },
  { id: 4, title: "Friendly Monster", thumbnail: "/demoSketch.png" }
];

// Drawing tips for kids and pro modes
const drawingTips = {
  kids: [
    { tip: "Use bold lines for better results", icon: <PenTool size={14} /> },
    { tip: "Draw one thing at a time (like a robot)", icon: <Layers size={14} /> },
    { tip: "Keep it simple, no tiny details", icon: <Zap size={14} /> },
    { tip: "Erase and restart anytime", icon: <Eraser size={14} /> }
  ],
  pro: [
    { tip: "Use strong contours for better AI detection", icon: <PenTool size={14} /> },
    { tip: "Try cross-hatching for detailed shading", icon: <Brush size={14} /> },
    { tip: "Separate subjects from background", icon: <Layers size={14} /> },
    { tip: "Add visual hints for style (geometric/organic)", icon: <Zap size={14} /> },
    { tip: "Include text notes for specific details", icon: <Lightbulb size={14} /> }
  ]
};

const LeftSidebar = () => {
  const mode = useModeStore((s) => s.mode);
  const [showTips, setShowTips] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarRef = useRef<HTMLElement | null>(null);

  const clearCanvas = useCanvasStore((state) => state.clearCanvas);
  const undoAction = useCanvasStore((state) => state.undoAction);
  const redoAction = useCanvasStore((state) => state.redoAction);
  const setActiveTool = useCanvasStore((state) => state.setActiveTool);
  const activeTool = useCanvasStore((state) => state.activeTool);

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
  }, []); // Empty dependency array so it only runs on mount

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

  // Detect when sidebar should be automatically expanded
  useEffect(() => {
    // Auto expand tips on first visit (could be stored in localStorage)
    const hasSeenTips = sessionStorage.getItem('hasSeenTips');
    if (!hasSeenTips) {
      setShowTips(true);
      sessionStorage.setItem('hasSeenTips', 'true');
    }
  }, []);

  const toggleSidebar = () => {
    console.log("Toggle sidebar clicked, current state:", sidebarOpen);
    setSidebarOpen(!sidebarOpen);
  };

  const handleUploadArt = () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.click();

    fileInput.onchange = (event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const editor = useCanvasStore.getState().editor;
      if (!editor) return;

      const assetId = AssetRecordType.createId();
      const reader = new FileReader();

      reader.onload = () => {
        const base64DataUrl = reader.result as string;
        const image = new window.Image();

        image.onload = () => {
          const { width, height } = image;

          editor.createAssets([
            {
              id: assetId,
              type: "image",
              typeName: "asset",
              props: {
                name: file.name,
                src: base64DataUrl, // ✅ valid src now
                w: width,
                h: height,
                mimeType: file.type,
                isAnimated: false,
              },
              meta: {},
            },
          ]);

          editor.createShape({
            type: "image",
            x: (window.innerWidth - width) / 2,
            y: (window.innerHeight - height) / 2,
            props: {
              assetId,
              w: width,
              h: height,
            },
          });
        };

        image.src = base64DataUrl;
      };

      reader.readAsDataURL(file); // ✅ convert to base64
    };
  };


  // Determine which tips to show based on mode
  const tipsToShow = mode === 'kids' ? drawingTips.kids : drawingTips.pro;

  return (
    <>
      {/* Mobile toggle button - only visible on mobile */}
      {isMobile && (
        <button
          className={styles.mobileToggle}
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {sidebarOpen ? <X size={18} /> : <ChevronsRight size={18} />}
        </button>
      )}

      {/* Desktop collapse toggle - only visible on desktop/tablet */}
      {!isMobile && (
        <button
          className={`${styles.collapseToggle} ${!sidebarOpen ? styles.collapsed : ''}`}
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen ? <ChevronsLeft size={18} /> : <ChevronsRight size={18} />}
        </button>
      )}

      {/* Sidebar content */}
      <aside
        ref={sidebarRef}
        className={`${styles.sidebar} ${!sidebarOpen ? styles.collapsed : ''} ${isMobile ? styles.mobile : ''} ${isTablet ? styles.tablet : ''}`}
      >
        <div className={styles.sidebarContent}>
          {/* Main drawing tools */}
          <div className={styles.toolsSection}>
            <h3 className={styles.sectionTitle}>Tools</h3>

            <div className={styles.toolsGrid}>
              <button
                className={`${styles.toolButton} ${activeTool === 'draw' ? styles.active : ''}`}
                onClick={() => setActiveTool('draw')}
              >
                <PenTool size={20} />
                <span className={styles.toolLabel}>Draw</span>
              </button>

              <button
                className={`${styles.toolButton} ${activeTool === 'eraser' ? styles.active : ''}`}
                onClick={() => setActiveTool('eraser')}
              >
                <Eraser size={20} />
                <span className={styles.toolLabel}>Erase</span>
              </button>

              <button className={styles.toolButton} onClick={undoAction}>
                <Undo2 size={20} />
                <span className={styles.toolLabel}>Undo</span>
              </button>

              <button className={styles.toolButton} onClick={redoAction}>
                <Redo2 size={20} />
                <span className={styles.toolLabel}>Redo</span>
              </button>
            </div>

            <button
              className={`${styles.iconButton} ${styles.uploadButton}`}
              onClick={handleUploadArt}
            >
              <Upload size={18} />
              <span>Upload Art</span>
            </button>

            <button
              className={`${styles.iconButton} ${styles.clearButton}`}
              onClick={clearCanvas}
            >
              <Trash2 size={18} />
              <span>Clear Canvas</span>
            </button>
          </div>

          {/* Drawing Tips Section */}
          <div className={styles.section}>
            <button
              className={`${styles.sectionHeader} ${showTips ? styles.active : ''}`}
              onClick={() => {
                if (!sidebarOpen) setSidebarOpen(true);
                setShowTips(!showTips)
              }}
            >
              <div className={styles.sectionHeaderLeft}>
                <Lightbulb size={18} className={styles.sectionIcon} />
                <span>Drawing Tips</span>
              </div>
              <div className={styles.chevron}>
                {showTips ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {showTips && (
              <div className={styles.tipsContainer}>
                <ul className={styles.tips}>
                  {tipsToShow.map((item, index) => (
                    <li key={index} className={styles.tip}>
                      <span className={styles.tipIcon}>{item.icon}</span>
                      <span className={styles.tipText}>{item.tip}</span>
                    </li>
                  ))}
                </ul>

                {/* Kids mode gets an encouraging message */}
                {mode === 'kids' && (
                  <div className={styles.encouragement}>
                    <span className={styles.sparkle}>✨</span> Remember, there&apos;s no wrong way to draw! Have fun!
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Example Gallery Section */}
          <div className={styles.section}>
            <button
              className={`${styles.sectionHeader} ${showGallery ? styles.active : ''}`}
              onClick={() => {
                if (!sidebarOpen) setSidebarOpen(true);
                setShowGallery(!showGallery)
              }}
            >
              <div className={styles.sectionHeaderLeft}>
                <ImageIcon size={18} className={styles.sectionIcon} />
                <span>Example Gallery</span>
              </div>
              <div className={styles.chevron}>
                {showGallery ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {showGallery && (
              <div className={styles.galleryGrid}>
                {examples.map(example => (
                  <div key={example.id} className={styles.galleryItem}>
                    <div className={styles.imageContainer}>
                      <Image
                        src={example.thumbnail}
                        alt={example.title}
                        width={150}
                        height={100}
                        className={styles.exampleImage}
                      />
                      <button className={styles.useThisButton}>
                        <span>Use this</span>
                      </button>
                    </div>
                    <span className={styles.exampleTitle}>{example.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Sidebar overlay for mobile */}
      {isMobile && sidebarOpen && (
        <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />
      )}
    </>
  );
};

export default LeftSidebar;