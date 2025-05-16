"use client";

import { motion } from "framer-motion";
import { Sparkles, Palette } from "lucide-react";

import { useModeStore } from "@/stores/modeStore";

import styles from "./ModeToggle.module.scss";

const ModeToggle = () => {
  const mode = useModeStore((s) => s.mode);
  const setMode = useModeStore((s) => s.setMode);

  return (
    <div className={styles.container}>
      <motion.div
        className={styles.slider}
        layout
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
        }}
        initial={false}
        animate={{
          x: mode === "pro" ? "100%" : "0%",
        }}
      />

      <button
        className={`${styles.button} ${mode === "kids" ? styles.active : ""}`}
        onClick={() => setMode("kids")}
        aria-pressed={mode === "kids"}
      >
        <Sparkles size={14} className={styles.icon} />
        <span>Kids</span>
      </button>

      <button
        className={`${styles.button} ${mode === "pro" ? styles.active : ""}`}
        onClick={() => setMode("pro")}
        aria-pressed={mode === "pro"}
      >
        <Palette size={14} className={styles.icon} />
        <span>Pro</span>
      </button>
    </div>
  );
};

export default ModeToggle;
