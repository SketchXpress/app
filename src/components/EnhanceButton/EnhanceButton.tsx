"use client";

import { useState } from "react";
import { Wand2 } from "lucide-react";
import { toast } from "react-toastify";

import { useModeStore } from "@/stores/modeStore";
import { useCanvasStore } from "@/stores/canvasStore";
import { useEnhanceStore } from "@/stores/enhanceStore";

import EnhancePromptModal from "../EnhancePromptModal/EnhancePromptModal";

import styles from "./EnhanceButton.module.scss";

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
      const allShapes = editor.getCurrentPageShapes();

      if (allShapes.length > 0) {
        editor.selectAll();

        setIsModalOpen(true);
        setModalOpen(true);
      } else {
        toast.info("Please draw something first!", {
          position: "bottom-left",
          autoClose: 3000,
          icon: <span>✏️</span>,
        });
      }
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setModalOpen(false);
  };

  const handleConfirm = () => {
    setIsModalOpen(false);
    setModalOpen(false);

    onClick();
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
