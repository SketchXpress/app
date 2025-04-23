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
import { useMemo, useCallback } from "react";
import { useCanvasStore } from "@/stores/canvasStore";
import { TLShapeId } from "@tldraw/editor";

const CanvasWrapper = () => {
  // 1) Create the tldraw store once
  const store = useMemo(() => createTLStore(), []);

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

    // It’s good practice to unsubscribe when this component unmounts;
    // but since onMount callbacks can’t return a cleanup, you can
    // also do this in a useEffect tied to your component’s lifecycle.
  }, [setEditor, setSelectedShapeIds]);

  return (
    <div className={styles.canvasContainer}>
      <Tldraw
        store={store}
        shapeUtils={defaultShapeUtils}
        tools={defaultTools}
        onMount={handleMount}
        autoFocus
      />
    </div>
  );
};

export default CanvasWrapper;
