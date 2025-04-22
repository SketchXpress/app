"use client";

import { useState } from "react";
import styles from "./RightPanel.module.scss";
import { useModeStore } from "@/stores/modeStore";
import { Wand2 } from "lucide-react";

const RightPanel = () => {
  const mode = useModeStore((s) => s.mode);
  const [prompt, setPrompt] = useState("");

  const handleGenerate = () => {
    console.log("Generating with prompt: ", prompt);

    // TODO: We have to call the AI backend
  }

  const handleExport = () => {
    console.log("Export clicked");

    // TODO: Use Tldraw Editor.toImage()
  }

  const handleMint = () => {
    console.log("Mint NFT clicked");

    // TODO: Show modal + Mint Logic
  }

  return (
    <aside className={styles.panel}>
      {mode == "pro" && (
        <div className={styles.promptBox}>
          <textarea className={styles.promptInput} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe your vision (e.g., 'Cyberpunk robot dog'" />
        </div>
      )}

      <button className={styles.actionButton} onClick={handleGenerate}>
        <Wand2 size={18} />
        <span>Generate</span>
      </button>


      <button className={styles.actionButton} onClick={handleExport}>
        <Wand2 size={18} />
        <span>Export</span>
      </button>

      <button className={styles.actionButton} onClick={handleMint}>
        <Wand2 size={18} />
        <span>Mint NFT</span>
      </button>

    </aside>
  )
}

export default RightPanel;