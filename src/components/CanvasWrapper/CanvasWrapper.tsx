"use client";

import { toast } from "react-toastify";
import { useMemo, useCallback, useState, useEffect } from "react";

import { TLShapeId } from "@tldraw/editor";
import {
  Tldraw,
  createTLStore,
  defaultShapeUtils,
  defaultTools,
  Editor,
  loadSnapshot,
  getSnapshot,
} from "tldraw";

import canvasStorage from "@/lib/canvasStorage";
import { useModeStore } from "@/stores/modeStore";
import { enhanceSketch } from "@/lib/enhanceSketch";
import { useCanvasStore } from "@/stores/canvasStore";
import { useEnhanceStore } from "@/stores/enhanceStore";

import EnhanceButton from "../EnhanceButton/EnhanceButton";
import OnboardingGuide from "../OnboardingGuide/OnboardingGuide";

import "tldraw/tldraw.css";
import styles from "./CanvasWrapper.module.scss";

// Debounce helper function
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

const isBrowser = typeof window !== "undefined";

const CanvasWrapper = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCanvasTip, setShowCanvasTip] = useState(true);
  const [processingProgress, setProcessingProgress] = useState(0);

  const mode = useModeStore((s) => s.mode);
  const setEditor = useCanvasStore((s) => s.setEditor);
  const setSelectedShapeIds = useCanvasStore((s) => s.setSelectedShapeIds);

  // Hiding canvas tips after 5 seconds
  useEffect(() => {
    if (showCanvasTip) {
      const timer = setTimeout(() => {
        setShowCanvasTip(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showCanvasTip]);

  // Progress
  useEffect(() => {
    if (isProcessing) {
      const interval = setInterval(() => {
        setProcessingProgress((prev) => {
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

  // For mobile devices
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    function setViewportHeight() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    }

    checkMobile();
    setViewportHeight();

    window.addEventListener("resize", setViewportHeight);
    window.addEventListener("resize", checkMobile);
    window.addEventListener("orientationchange", setViewportHeight);

    // iOS Safari orientation issue
    window.addEventListener("orientationchange", () => {
      setTimeout(setViewportHeight, 100);
    });

    return () => {
      window.removeEventListener("resize", setViewportHeight);
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("orientationchange", setViewportHeight);
    };
  }, []);

  // Clearing canvas on new session
  useEffect(() => {
    if (!isBrowser) return;

    const isNewSession = !sessionStorage.getItem("canvasSessionStarted");

    if (isNewSession) {
      canvasStorage
        .deleteCanvas("current")
        .then(() => {
          sessionStorage.setItem("canvasSessionStarted", "true");
        })
        .catch((err) => {
          console.warn("Failed to clear canvas data:", err);
        });
    }

    // Clearing canvas if user is away for 3 minutes
    const lastActivity = localStorage.getItem("lastCanvasActivity");
    if (lastActivity) {
      const timeSinceLastActivity = Date.now() - parseInt(lastActivity, 10);
      const thirtyMinutes = 3 * 60 * 1000;

      if (timeSinceLastActivity > thirtyMinutes) {
        canvasStorage
          .deleteCanvas("current")
          .then(() => console.warn("Canvas cleared due to inactivity"))
          .catch(console.warn);
      }
    }

    localStorage.setItem("lastCanvasActivity", Date.now().toString());
  }, []);

  // Tracking user activity
  useEffect(() => {
    if (!isBrowser) return;

    const updateActivity = () => {
      localStorage.setItem("lastCanvasActivity", Date.now().toString());
    };

    window.addEventListener("mousemove", updateActivity);
    window.addEventListener("touchstart", updateActivity);

    return () => {
      window.removeEventListener("mousemove", updateActivity);
      window.removeEventListener("touchstart", updateActivity);
    };
  }, []);

  // Persistent support
  const store = useMemo(() => {
    const newStore = createTLStore();

    if (isBrowser) {
      const loadSavedCanvas = async () => {
        try {
          const savedState = await canvasStorage.loadCanvas();
          if (savedState) {
            loadSnapshot(newStore, savedState);
          }
        } catch (err) {
          console.warn("Failed to restore canvas state:", err);
        }
      };

      loadSavedCanvas();
    }

    return newStore;
  }, []);

  const handleMount = useCallback(
    (editor: Editor) => {
      setEditor(editor);

      // Default to `draw` when load
      editor.setCurrentTool("draw");

      const selectionUnsubscribe = editor.store.listen(
        () => {
          const ids = editor.getSelectedShapeIds();
          setSelectedShapeIds(ids as TLShapeId[]);
        },
        { scope: "document" }
      );

      // debounce to handle excessive paint on the canvas
      const saveCanvasState = debounce(() => {
        if (!isBrowser || !editor) return;

        try {
          const snapshot = getSnapshot(editor.store);

          canvasStorage.saveCanvas(snapshot).then((success) => {
            if (!success) {
              toast.error(
                "Failed to save your work. Consider exporting your drawing.",
                {
                  position: "bottom-left",
                  autoClose: 5000,
                }
              );
            }
          });
        } catch (err) {
          console.error("Error getting snapshot:", err);
          toast.error(
            "Failed to save your work. Consider exporting your drawing.",
            {
              position: "bottom-left",
              autoClose: 5000,
            }
          );
        }
      }, 1000);

      // Listen for document changes to persist state
      const persistUnsubscribe = editor.store.listen(saveCanvasState, {
        scope: "document",
      });

      // Return cleanup function
      return () => {
        selectionUnsubscribe();
        persistUnsubscribe();
      };
    },
    [setEditor, setSelectedShapeIds]
  );

  // Handle AI enhancement
  const handleEnhance = useCallback(async () => {
    const editor = useCanvasStore.getState().editor;
    if (!editor) return;

    const shapes = editor.getCurrentPageShapes();
    if (shapes.length === 0) {
      toast.info("Please draw something first!", {
        position: "bottom-left",
        autoClose: 3000,
        icon: false,
      });
      return;
    }

    try {
      setIsProcessing(true);
      setProcessingProgress(0);

      // Show a single toast notification here
      toast.info(
        mode === "kids"
          ? "Adding some magic to your drawing..."
          : "Enhancing your artwork...",
        {
          position: "bottom-left",
          autoClose: 4000,
          icon: <span>{mode === "kids" ? "✨" : "🎨"}</span>,
        }
      );

      await enhanceSketch(editor);

      setProcessingProgress(100);

      setTimeout(() => {
        setIsProcessing(false);
        const { setPrompt } = useEnhanceStore.getState();
        setPrompt("");

        // Switching to `select` tools once image genereated
        editor.setCurrentTool("select");

        const { setActiveTool } = useCanvasStore.getState();
        setActiveTool("select");

        // Selecting all the changes
        const allShapes = editor.getCurrentPageShapes();
        if (allShapes.length > 0) {
          editor.selectAll();
        }
      }, 500);
    } catch (err) {
      toast.error(
        `Enhancement failed: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
        {
          position: "bottom-left",
          autoClose: 5000,
        }
      );
      setIsProcessing(false);
    }
  }, [mode]);

  return (
    <>
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
              <div className={styles.particles}>
                <div
                  className={styles.particle}
                  style={{ top: "10%", left: "10%" }}
                ></div>
                <div
                  className={styles.particle}
                  style={{ top: "30%", left: "80%" }}
                ></div>
                <div
                  className={styles.particle}
                  style={{ top: "70%", left: "20%" }}
                ></div>
                <div
                  className={styles.particle}
                  style={{ top: "80%", left: "70%" }}
                ></div>
                <div
                  className={styles.particle}
                  style={{ top: "40%", left: "30%" }}
                ></div>
              </div>

              <div className={styles.spinnerContainer}>
                <div className={styles.spinner}></div>
                <div className={styles.spinnerInner}></div>
              </div>

              <h3 className={styles.processingTitle}>
                {useModeStore.getState().mode === "kids"
                  ? "Making Magic!"
                  : "Enhancing Your Artwork"}
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
                    animation:
                      processingProgress > 0
                        ? "shimmer 2s infinite"
                        : undefined,
                  }}
                ></div>
              </div>

              <div className={styles.progressText}>
                {Math.round(processingProgress)}% Complete
              </div>
            </div>
          </div>
        )}

        <OnboardingGuide />
      </div>
    </>
  );
};

export default CanvasWrapper;
