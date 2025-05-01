"use client";

import { Wand2 } from "lucide-react";
import styles from "./EnhanceButton.module.scss";
import { useModeStore } from "@/stores/modeStore";
import { useCanvasStore } from "@/stores/canvasStore";
import { toast } from "react-toastify";

interface EnhanceButtonProps {
  onClick: () => void;
}

const EnhanceButton = ({ onClick }: EnhanceButtonProps) => {
  const mode = useModeStore((s) => s.mode);
  const editor = useCanvasStore((s) => s.editor);

  // Different text based on mode
  const buttonText = mode === "kids" ? "Magic Enhance" : "AI Enhance";

  const handleEnhanceClick = () => {
    if (editor) {
      // Get all shapes on the current page
      const allShapes = editor.getCurrentPageShapes();

      // If there are shapes, select them all
      if (allShapes.length > 0) {
        // Select all shapes before enhancing
        editor.selectAll();

        // Show a toast notification
        toast.info(mode === "kids" ? "Adding some magic to your drawing..." : "Enhancing your artwork...", {
          position: "bottom-right",
          autoClose: 3000,
          icon: <span>{mode === "kids" ? "✨" : "🎨"}</span>
        });

        // Now call the original onClick handler (which will enhance the selection)
        onClick();
      } else {
        // If no shapes, show a message
        toast.info("Please draw something first!", {
          position: "bottom-right",
          autoClose: 3000,
          icon: <span>✏️</span>
        });
      }
    } else {
      // Fallback to original onClick if editor isn't available
      onClick();
    }
  };

  return (
    <button className={styles.enhanceButton} onClick={handleEnhanceClick}>
      <Wand2 size={16} className={styles.icon} />
      <span>{buttonText}</span>
    </button>
  );
};

export default EnhanceButton;