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

const CanvasWrapper = () => {
  // 1) Create the tldraw store once
  const store = useMemo(() => createTLStore(), []);

  // State for tracking AI processing
  const [isProcessing, setIsProcessing] = useState(false);

  // 2) Get your Zustand actions
  const setEditor = useCanvasStore((s) => s.setEditor);
  const setSelectedShapeIds = useCanvasStore((s) => s.setSelectedShapeIds);

  // 3) When <Tldraw> mounts, grab the Editor and subscribe to its store
  const handleMount = useCallback((editor: Editor) => {
    setEditor(editor);

    // Listen to *all* document changes and update selection
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const unsubscribe = editor.store.listen(
      () => {
        const ids = editor.getSelectedShapeIds();
        setSelectedShapeIds(ids as TLShapeId[]);
      },
      { scope: "document" }
    );
  }, [setEditor, setSelectedShapeIds]);

  // Handle AI enhancement
  const handleEnhance = useCallback(async () => {
    const editor = useCanvasStore.getState().editor
    if (!editor) return

    try {
      setIsProcessing(true)
      await enhanceSketch(editor)
    } catch (err) {
      console.error('[EnhanceSketch] Error:', err)
      alert((err as Error).message || 'Failed to enhance the sketch')
    } finally {
      setIsProcessing(false)
    }
  }, [])


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
    </div>
  );
};

export default CanvasWrapper;