"use client";

import {
  Tldraw,
  createTLStore,
  defaultShapeUtils,
  defaultTools,
  Editor,
  loadSnapshot
} from "tldraw";
import "tldraw/tldraw.css";
import styles from "./CanvasWrapper.module.scss";
import { useMemo, useCallback, useState, useEffect } from "react";
import { useCanvasStore } from "@/stores/canvasStore";
import { TLShapeId } from "@tldraw/editor";
import EnhanceButton from "../EnhanceButton/EnhanceButton";
import { enhanceSketch } from "@/lib/enhanceSketch";
import OnboardingGuide from "../OnboardingGuide/OnboardingGuide";
import { toast } from "react-toastify";

// Storage key for persisting canvas state
const CANVAS_STORAGE_KEY = 'sketchxpress-canvas-state';

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

  // Get Zustand actions
  const setEditor = useCanvasStore((s) => s.setEditor);
  const setSelectedShapeIds = useCanvasStore((s) => s.setSelectedShapeIds);

  // Hide canvas tip after 5 seconds
  useEffect(() => {
    if (showCanvasTip) {
      const timer = setTimeout(() => {
        setShowCanvasTip(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showCanvasTip]);

  // Simulate processing progress
  useEffect(() => {
    if (isProcessing) {
      const interval = setInterval(() => {
        setProcessingProgress(prev => {
          // Increment but stay below 90% to indicate we're still waiting for server
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

  // Create the tldraw store with persistence support
  const store = useMemo(() => {
    const newStore = createTLStore();

    // Only try to access localStorage in the browser
    if (isBrowser) {
      // Try to load saved state from localStorage
      try {
        const savedState = localStorage.getItem(CANVAS_STORAGE_KEY);
        if (savedState) {
          const parsedState = JSON.parse(savedState);
          loadSnapshot(newStore, parsedState);
        }
      } catch (err) {
        console.warn('Failed to restore canvas state:', err);
        // Continue with empty canvas if restore fails
      }
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
      // Only save if we're in the browser
      if (!isBrowser) return;

      try {
        const snapshot = editor.store.getSnapshot();
        const serializedState = JSON.stringify(snapshot);

        // Check for localStorage size limits (typically ~5MB)
        if (serializedState.length > 4.5 * 1024 * 1024) {
          console.warn('Canvas state too large for localStorage');
          toast.warning("Your drawing is getting quite large! Some changes may not be saved automatically.", {
            position: "bottom-right",
            autoClose: 4000,
          });
          return;
        }

        localStorage.setItem(CANVAS_STORAGE_KEY, serializedState);
      } catch {
        toast.error("Failed to save your work. Consider exporting your drawing.", {
          position: "bottom-right",
          autoClose: 5000,
        });
      }
    }, 1000); // Save after 1 second of inactivity

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
        position: "bottom-center",
        autoClose: 3000,
        icon: false
      });
      return;
    }

    try {
      setIsProcessing(true);
      setProcessingProgress(0);

      // We don't need to select all shapes here since EnhanceButton already does this
      // The selection will be handled by EnhanceButton component

      toast.info("Starting AI enhancement process...", {
        position: "bottom-right",
        autoClose: 3000,
        icon: false
      });

      await enhanceSketch(editor);

      // Set progress to 100% when completed
      setProcessingProgress(100);

      // Add a small delay to show 100% completion before hiding overlay
      setTimeout(() => {
        setIsProcessing(false);
      }, 500);

    } catch (err) {
      toast.error(`Enhancement failed: ${err instanceof Error ? err.message : "Unknown error"}`, {
        position: "bottom-right",
        autoClose: 5000,
      });
      setIsProcessing(false);
    }
  }, []);

  return (
    <div className={styles.canvasContainer}>
      {/* Canvas frame with subtle styling */}
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

      {/* Improved processing overlay */}
      {isProcessing && (
        <div className={styles.processingOverlay}>
          <div className={styles.processingContent}>
            <div className={styles.spinner}></div>
            <h3 className={styles.processingTitle}>Enhancing Your Artwork</h3>
            <p className={styles.processingMessage}>
              Our AI is transforming your sketch into something magical. This might take a moment...
            </p>
            <div className={styles.progressBar}>
              <div
                className={styles.progressBarInner}
                style={{
                  width: `${processingProgress}%`,
                  animation: processingProgress > 0 ? 'none' : undefined
                }}
              />
            </div>
          </div>
        </div>
      )}

      <OnboardingGuide />
    </div>
  );
};

export default CanvasWrapper;