"use client";

import {
  Tldraw,
  createTLStore,
  defaultShapeUtils,
  defaultTools,
  Editor,
  loadSnapshot,
  getSnapshot
} from "tldraw";
import { toast } from "react-toastify";
import { useMemo, useCallback, useState, useEffect } from "react";

import "tldraw/tldraw.css";
import { TLShapeId } from "@tldraw/editor";
import { useCanvasStore } from "@/stores/canvasStore";
import { enhanceSketch } from "@/lib/enhanceSketch";
import styles from "./CanvasWrapper.module.scss";
import EnhanceButton from "../EnhanceButton/EnhanceButton";
import OnboardingGuide from "../OnboardingGuide/OnboardingGuide";
import { useEnhanceStore } from "@/stores/enhanceStore";
import { useModeStore } from "@/stores/modeStore";
import canvasStorage from "@/lib/canvasStorage";

// Debounce helper with proper typing
const debounce = <T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  ms = 300
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
};

// Helper to check if we're in browser environment
const isBrowser = typeof window !== 'undefined';

const CanvasWrapper = () => {
  // State for tracking AI processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showCanvasTip, setShowCanvasTip] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Get Zustand actions
  const setEditor = useCanvasStore((s) => s.setEditor);
  const setSelectedShapeIds = useCanvasStore((s) => s.setSelectedShapeIds);
  const mode = useModeStore((s) => s.mode);

  // Hide canvas tip after 5 seconds
  useEffect(() => {
    if (showCanvasTip) {
      const timer = setTimeout(() => {
        setShowCanvasTip(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showCanvasTip]);

  // Simulating processing progress
  useEffect(() => {
    if (isProcessing) {
      const interval = setInterval(() => {
        setProcessingProgress(prev => {
          const next = prev + (1 + Math.random() * 2);
          return next < 90 ? next : 89;
        });
      }, 800);

      return () => {
        clearInterval(interval);
        setProcessingProgress(0);
      };
    }
  }, [isProcessing]);

  useEffect(() => {
    // Detect mobile devices
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    // Function to set viewport height
    function setViewportHeight() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    // Run both functions initially
    checkMobile();
    setViewportHeight();

    // Update on resize and orientation change
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', setViewportHeight);

    // iOS Safari may need a small delay
    window.addEventListener('orientationchange', () => {
      setTimeout(setViewportHeight, 100);
    });

    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', setViewportHeight);
    };
  }, []);

  // Create the tldraw store with persistence support
  const store = useMemo(() => {
    const newStore = createTLStore();

    // Only try to access storage in the browser
    if (isBrowser) {
      // Load the canvas state asynchronously
      const loadSavedCanvas = async () => {
        try {
          const savedState = await canvasStorage.loadCanvas();
          if (savedState) {
            loadSnapshot(newStore, savedState);
          }
        } catch (err) {
          console.warn('Failed to restore canvas state:', err);
        }
      };

      loadSavedCanvas();
    }

    return newStore;
  }, []);

  // Handle editor mount and setup persistence
  const handleMount = useCallback((editor: Editor) => {
    setEditor(editor);

    // Set default tool to "draw" when canvas loads
    editor.setCurrentTool('draw');

    // Listen to selection changes
    const selectionUnsubscribe = editor.store.listen(
      () => {
        const ids = editor.getSelectedShapeIds();
        setSelectedShapeIds(ids as TLShapeId[]);
      },
      { scope: "document" }
    );

    // Create debounced save function to avoid excessive writes
    const saveCanvasState = debounce(() => {
      if (!isBrowser || !editor) return;

      try {
        const snapshot = getSnapshot(editor.store);

        // Save asynchronously
        canvasStorage.saveCanvas(snapshot).then(success => {
          if (!success) {
            toast.error("Failed to save your work. Consider exporting your drawing.", {
              position: "bottom-left",
              autoClose: 5000,
            });
          }
        });
      } catch (err) {
        console.error('Error getting snapshot:', err);
        toast.error("Failed to save your work. Consider exporting your drawing.", {
          position: "bottom-left",
          autoClose: 5000,
        });
      }
    }, 1000);

    // Listen for document changes to persist state
    const persistUnsubscribe = editor.store.listen(saveCanvasState, { scope: 'document' });

    // Return cleanup function
    return () => {
      selectionUnsubscribe();
      persistUnsubscribe();
    };
  }, [setEditor, setSelectedShapeIds]);

  // Handle AI enhancement
  const handleEnhance = useCallback(async () => {
    const editor = useCanvasStore.getState().editor;
    if (!editor) return;

    const shapes = editor.getCurrentPageShapes();
    if (shapes.length === 0) {
      toast.info("Please draw something first!", {
        position: "bottom-left",
        autoClose: 3000,
        icon: false
      });
      return;
    }

    try {
      setIsProcessing(true);
      setProcessingProgress(0);

      // Show a single toast notification here
      toast.info(mode === "kids" ? "Adding some magic to your drawing..." : "Enhancing your artwork...", {
        position: "bottom-left",
        autoClose: 4000,
        icon: <span>{mode === "kids" ? "✨" : "🎨"}</span>
      });

      await enhanceSketch(editor);

      // Set progress to 100% when completed
      setProcessingProgress(100);

      // Add a small delay to show 100% completion before hiding overlay
      setTimeout(() => {
        setIsProcessing(false);

        // Clear the prompt after successful enhancement
        // Access the enhanceStore directly from the import
        const { setPrompt } = useEnhanceStore.getState();
        setPrompt("");

        // Switch to select tool after enhancement is complete
        editor.setCurrentTool('select');

        // Update the canvas store to reflect the tool change
        const { setActiveTool } = useCanvasStore.getState();
        setActiveTool('select');

        // Select all shapes that were just enhanced
        const allShapes = editor.getCurrentPageShapes();
        if (allShapes.length > 0) {
          editor.selectAll();
        }
      }, 500);

    } catch (err) {
      toast.error(`Enhancement failed: ${err instanceof Error ? err.message : "Unknown error"}`, {
        position: "bottom-left",
        autoClose: 5000,
      });
      setIsProcessing(false);
    }
  }, [mode]);

  return (
    <>
      {/* Add this div to prevent scrolling on mobile */}
      {isMobile && <div className={styles.preventScroll} aria-hidden="true" />}

      <div className={styles.canvasContainer}>
        <div className={styles.canvasFrame} />

        <Tldraw
          store={store}
          shapeUtils={defaultShapeUtils}
          tools={defaultTools}
          onMount={handleMount}
          autoFocus
          className={styles.canvasArea}
        />

        <EnhanceButton onClick={handleEnhance} />

        {/* Initial canvas tip */}
        {showCanvasTip && (
          <div className={styles.canvasTip}>
            Draw something, then click &quot;AI Enhance&quot; to transform it
          </div>
        )}

        {/* processing overlay */}
        {isProcessing && (
          <div className={styles.processingOverlay} style={{ zIndex: 9999 }}>
            <div className={styles.processingContent}>
              {/* Decorative particles */}
              <div className={styles.particles}>
                <div className={styles.particle} style={{ top: '10%', left: '10%' }}></div>
                <div className={styles.particle} style={{ top: '30%', left: '80%' }}></div>
                <div className={styles.particle} style={{ top: '70%', left: '20%' }}></div>
                <div className={styles.particle} style={{ top: '80%', left: '70%' }}></div>
                <div className={styles.particle} style={{ top: '40%', left: '30%' }}></div>
              </div>

              <div className={styles.spinnerContainer}>
                <div className={styles.spinner}></div>
                <div className={styles.spinnerInner}></div>
              </div>

              <h3 className={styles.processingTitle}>
                {useModeStore.getState().mode === "kids" ? "Making Magic!" : "Enhancing Your Artwork"}
              </h3>

              <p className={styles.processingMessage}>
                {useModeStore.getState().mode === "kids"
                  ? "Your sketch is being transformed into something amazing..."
                  : "Our AI is transforming your sketch into a refined artwork. This might take a moment..."}
              </p>

              <div className={styles.progressBar}>
                <div
                  className={styles.progressBarInner}
                  style={{
                    width: `${processingProgress}%`,
                    animation: processingProgress > 0 ? 'shimmer 2s infinite' : undefined
                  }}
                ></div>
              </div>

              <div className={styles.progressText}>{Math.round(processingProgress)}% Complete</div>
            </div>
          </div>
        )}

        <OnboardingGuide />
      </div>
    </>
  );
};

export default CanvasWrapper;