"use client";

import { useState } from "react";
import { Wand2 } from "lucide-react";
import styles from "./EnhanceButton.module.scss";
import { useModeStore } from "@/stores/modeStore";
import { useCanvasStore } from "@/stores/canvasStore";
import { toast } from "react-toastify";
import EnhancePromptModal from "../EnhancePromptModal/EnhancePromptModal";

interface EnhanceButtonProps {
  onClick: () => void;
}

const EnhanceButton = ({ onClick }: EnhanceButtonProps) => {
  const mode = useModeStore((s) => s.mode);
  const editor = useCanvasStore((s) => s.editor);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Different text based on mode
  const buttonText = mode === "kids" ? "Magic Enhance" : "AI Enhance";

  const handleEnhanceClick = () => {
    if (editor) {
      // Get all shapes on the current page
      const allShapes = editor.getCurrentPageShapes();

      // If there are shapes, select them all and open modal
      if (allShapes.length > 0) {
        // Select all shapes before enhancing
        editor.selectAll();

        // Open the prompt modal instead of immediately enhancing
        setIsModalOpen(true);
      } else {
        // If no shapes, show a message
        toast.info("Please draw something first!", {
          position: "bottom-right",
          autoClose: 3000,
          icon: <span>✏️</span>
        });
      }
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleConfirm = () => {
    // Close the modal
    setIsModalOpen(false);

    // Show a toast notification
    toast.info(mode === "kids" ? "Adding some magic to your drawing..." : "Enhancing your artwork...", {
      position: "bottom-right",
      autoClose: 3000,
      icon: <span>{mode === "kids" ? "✨" : "🎨"}</span>
    });

    // Now call the original onClick handler (which will enhance the selection)
    onClick();
  };

  return (
    <>
      <button className={styles.enhanceButton} onClick={handleEnhanceClick}>
        <Wand2 size={16} className={styles.icon} />
        <span>{buttonText}</span>
      </button>

      <EnhancePromptModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onConfirm={handleConfirm}
      />
    </>
  );
};

export default EnhanceButton;