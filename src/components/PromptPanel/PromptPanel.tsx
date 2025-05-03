"use client";

import { useModeStore } from "@/stores/modeStore";
import styles from "./PromptPanel.module.scss";
import { useState } from "react";

const PromptPanel = () => {
  const mode = useModeStore((s) => s.mode);
  const [prompt, setPrompt] = useState("");

  // Only show in Pro mode
  if (mode !== "pro") return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // TODO: We have to connect this to API
  }

  return (
    <form onSubmit={handleSubmit} className={styles.wrapper}>
      <input type="text" placeholder="Enter your prompt..." value={prompt} onChange={(e) => setPrompt(e.target.value)} className={styles.input} />
      <button type="submit" className={styles.button}>
        Generate
      </button>
    </form>
  )
}

export default PromptPanel;