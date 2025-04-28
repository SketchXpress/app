// src/components/CanvasWrapper/CanvasWrapper.tsx
"use client";

import {
  Tldraw,
  createTLStore,
  defaultShapeUtils,
  defaultTools,
  Editor,
} from "tldraw";
import "tldraw/tldraw.css";
import styles from "./CanvasWrapper.module.scss";
import { useMemo, useCallback, useState } from "react";
import { useCanvasStore } from "@/stores/canvasStore";
import { TLShapeId } from "@tldraw/editor";
import EnhanceButton from "../EnhanceButton/EnhanceButton";
import { enhanceSketch } from "@/lib/enhanceSketch";
import OnboardingGuide from "../OnboardingGuide/OnboardingGuide";

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

const CanvasWrapper = () => {
  // State for tracking AI processing
  const [isProcessing, setIsProcessing] = useState(false);

  // Get Zustand actions
  const setEditor = useCanvasStore((s) => s.setEditor);
  const setSelectedShapeIds = useCanvasStore((s) => s.setSelectedShapeIds);

  // Create the tldraw store with persistence support
  const store = useMemo(() => {
    const newStore = createTLStore();

    // Try to load saved state from localStorage
    try {
      const savedState = localStorage.getItem(CANVAS_STORAGE_KEY);
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        newStore.loadSnapshot(parsedState);
        console.log('Restored canvas state from localStorage');
      }
    } catch (err) {
      console.warn('Failed to restore canvas state:', err);
      // Continue with empty canvas if restore fails
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
      try {
        const snapshot = editor.store.getSnapshot();
        const serializedState = JSON.stringify(snapshot);

        // Check for localStorage size limits (typically ~5MB)
        if (serializedState.length > 4.5 * 1024 * 1024) {
          console.warn('Canvas state too large for localStorage');
          return;
        }

        localStorage.setItem(CANVAS_STORAGE_KEY, serializedState);
        console.log('Saved canvas state to localStorage');
      } catch (err) {
        console.error('Failed to save canvas state:', err);
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

    try {
      setIsProcessing(true);
      await enhanceSketch(editor);
    } catch (err) {
      console.error('[EnhanceSketch] Error:', err);
      alert((err as Error).message || 'Failed to enhance the sketch');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return (
    <div className={styles.canvasContainer}>
      <Tldraw
        store={store}
        shapeUtils={defaultShapeUtils}
        tools={defaultTools}
        onMount={handleMount}
        autoFocus
      />
      <EnhanceButton onClick={handleEnhance} />
      {isProcessing && (
        <div className={styles.processingOverlay}>
          <div className={styles.spinner}></div>
          <p>Enhancing your artwork...</p>
        </div>
      )}
      <OnboardingGuide />
    </div>
  );
};

export default CanvasWrapper;