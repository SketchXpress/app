"use client";

import LeftSidebar from "@/components/LeftSidebar/LeftSidebar";
import styles from "./page.module.scss"
import RightPanel from "@/components/RightPanel/RightPanel";

const SketchPage = () => {
  return (
    <div className={styles.wrapper}>
      <LeftSidebar />
      <div className={styles.canvasArea}>
        <h2>Canvas area goes here...</h2>
      </div>
      <RightPanel />
    </div>
  )
}

export default SketchPage;