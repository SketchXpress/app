"use client";

import { Wand2 } from "lucide-react";
import styles from "./EnhanceButton.module.scss";
import { useModeStore } from "@/stores/modeStore";

interface EnhanceButtonProps {
  onClick: () => void;
}

const EnhanceButton = ({ onClick }: EnhanceButtonProps) => {
  const mode = useModeStore((s) => s.mode);

  // Different text based on mode
  const buttonText = mode === "kids" ? "Magic Enhance" : "AI Enhance";

  return (
    <button className={styles.enhanceButton} onClick={onClick}>
      <Wand2 size={16} className={styles.icon} />
      <span>{buttonText}</span>
    </button>
  );
};

export default EnhanceButton;