"use client";

import {
  Tldraw,
  createTLStore,
  defaultShapeUtils,
  defaultTools
} from "tldraw";
import "tldraw/tldraw.css";
import styles from "./CanvasWrapper.module.scss";
import { useMemo } from "react";

const CanvasWrapper = () => {
  // Memoizing TLDraw store to persist across renders
  const store = useMemo(() => createTLStore(), []);

  return (
    <div className={styles.canvasContainer}>
      <Tldraw store={store} shapeUtils={defaultShapeUtils} tools={defaultTools} />
    </div>
  )
}

export default CanvasWrapper;