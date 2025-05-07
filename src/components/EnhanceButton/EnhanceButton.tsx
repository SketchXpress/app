"use client";

import { useState } from "react";
import { Wand2 } from "lucide-react";
import styles from "./EnhanceButton.module.scss";
import { useModeStore } from "@/stores/modeStore";
import { useCanvasStore } from "@/stores/canvasStore";
import { useEnhanceStore } from "@/stores/enhanceStore";
import { toast } from "react-toastify";
import EnhancePromptModal from "../EnhancePromptModal/EnhancePromptModal";

interface EnhanceButtonProps {
  onClick: () => void;
}

const EnhanceButton = ({ onClick }: EnhanceButtonProps) => {
  const mode = useModeStore((s) => s.mode);
  const editor = useCanvasStore((s) => s.editor);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { setModalOpen } = useEnhanceStore();

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
        // Update store with modal state
        setModalOpen(true);
      } else {
        // If no shapes, show a message
        toast.info("Please draw something first!", {
          position: "bottom-left",
          autoClose: 3000,
          icon: <span>✏️</span>
        });
      }
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    // Update store with modal state
    setModalOpen(false);
  };

  const handleConfirm = () => {
    // Close the modal
    setIsModalOpen(false);
    // Update store with modal state
    setModalOpen(false);

    // Now call the original onClick handler (which will enhance the selection)
    onClick();

    // Clear the prompt after enhancement is complete
    // We do this with a slight delay to ensure the enhancement process has started
    setTimeout(() => {
      useEnhanceStore.getState().setPrompt("");
    }, 500);
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