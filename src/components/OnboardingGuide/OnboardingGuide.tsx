"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./OnboardingGuide.module.scss";
import Image from "next/image";
import { useCanvasStore } from "@/stores/canvasStore";

const OnboardingGuide = () => {
  const [isVisible, setIsVisible] = useState(true);
  const editor = useCanvasStore((s) => s.editor);

  const isCanvasEmpty = useCallback(() => {
    if (!editor) return true;
    const shapes = editor.getCurrentPageShapes();
    return shapes.length === 0;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const hasSeenGuide = localStorage.getItem("sketchxpress-has-seen-guide");
    if (hasSeenGuide) {
      setIsVisible(false);
      return;
    }

    setIsVisible(isCanvasEmpty());

    const unsubscribe = editor.store.listen(
      () => {
        if (!isCanvasEmpty()) {
          setIsVisible(false);
          localStorage.setItem("sketchxpress-has-seen-guide", "true");
        }
      },
      { scope: "document" }
    );

    return () => {
      unsubscribe?.();
    };
  }, [editor, isCanvasEmpty]);

  if (!isVisible) return null;

  return (
    <div className={styles.onboardingContainer}>
      {/* Center Content */}
      <div className={styles.centerContent}>
        <div className={styles.logoWrap}>
          <div className={styles.iconWrapper}>
            <Image
              src="/assets/images/logo.png"
              alt="SketchXpress Logo"
              width={48}
              height={48}
              className={styles.logoImage}
            />
          </div>
          <h1 className={styles.branding}>
            <span className={styles.brandingSketch}>Sketch</span>
            <span className={styles.brandingXpress}>Xpress</span>
          </h1>
        </div>

        {/* Move subTagline outside logoWrap */}
        <p className={styles.subTagline}>
          Where messy lines become masterpieces!
        </p>
      </div>

      {/* Toolbar hint */}
      <div className={styles.toolbarHint}>
        <p className={styles.toolbarText}>Pick a tool & start drawing!</p>
        <div className={styles.toolbarArrow}>
          <svg aria-hidden="true" viewBox="0 0 38 78" fill="none">
            <path
              d="M1 77c14-2 31.833-11.973 35-24 3.167-12.016-6-35-9.5-43.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            ></path>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="m24.165 1.093-2.132 16.309 13.27-4.258-11.138-12.05Z"
              fill="currentColor"
            ></path>
            <path
              d="M24.165 1.093c-.522 3.953-1.037 7.916-2.132 16.309m2.131-16.309c-.835 6.424-1.68 12.854-2.13 16.308m0 0c3.51-1.125 7.013-2.243 13.27-4.257m-13.27 4.257c5.038-1.608 10.08-3.232 13.27-4.257m0 0c-3.595-3.892-7.197-7.777-11.14-12.05m11.14 12.05c-3.837-4.148-7.667-8.287-11.14-12.05"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            ></path>
          </svg>
        </div>
      </div>

      {/* AI Enhance hint */}
      <div className={styles.aiEnhanceHint}>
        <div className={styles.aiEnhanceArrow}>
          <svg aria-hidden="true" viewBox="0 0 38 78" fill="none">
            <path
              d="M1 77c14-2 31.833-11.973 35-24 3.167-12.016-6-35-9.5-43.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            ></path>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="m24.165 1.093-2.132 16.309 13.27-4.258-11.138-12.05Z"
              fill="currentColor"
            ></path>
            <path
              d="M24.165 1.093c-.522 3.953-1.037 7.916-2.132 16.309m2.131-16.309c-.835 6.424-1.68 12.854-2.13 16.308m0 0c3.51-1.125 7.013-2.243 13.27-4.257m-13.27 4.257c5.038-1.608 10.08-3.232 13.27-4.257m0 0c-3.595-3.892-7.197-7.777-11.14-12.05m11.14 12.05c-3.837-4.148-7.667-8.287-11.14-12.05"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            ></path>
          </svg>
        </div>
        <p className={styles.aiEnhanceText}>
          Click &quot;AI Enhance&quot; to boost your sketch!
        </p>
      </div>

      {/* Left Sidebar */}
      {/* Single Left Sidebar Hint */}
      <div className={styles.leftSidebarSingleHint}>
        <div className={styles.leftArrow}>
          <svg viewBox="0 0 78 38" fill="none">
            <path
              d="M77 1c-2 14-11.973 31.833-24 35-12.016 3.167-35-6-43.5-9.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            ></path>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M1 24.165l16.309-2.132-4.258 13.27L1 24.165z"
              fill="currentColor"
            ></path>
          </svg>
        </div>
        <p className={styles.leftHintText}>Tips & Gallery here!</p>
      </div>
    </div>
  );
};

export default OnboardingGuide;
