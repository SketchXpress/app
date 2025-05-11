"use client";

import styles from "./page.module.scss"
import RightPanel from "@/components/RightPanel/RightPanel";
import LeftSidebar from "@/components/LeftSidebar/LeftSidebar";
import CanvasWrapper from "@/components/CanvasWrapper/CanvasWrapper";

const SketchPage = () => {
  return (
    <div className={styles.wrapper}>
      <LeftSidebar />
      <div className={styles.canvasArea}>
        <CanvasWrapper />
      </div>
      <RightPanel />
    </div>
  )
}

export default SketchPage;