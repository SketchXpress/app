"use client";

import { X } from "lucide-react";
import { useState, useEffect, useRef } from "react";

import { useModeStore } from "@/stores/modeStore";
import { useEnhanceStore } from "@/stores/enhanceStore";

import styles from "./EnhancePromptModal.module.scss";

interface EnhancePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const EnhancePromptModal = ({
  isOpen,
  onClose,
  onConfirm,
}: EnhancePromptModalProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const mode = useModeStore((s) => s.mode);

  const prompt = useEnhanceStore((s) => s.prompt);
  const setPrompt = useEnhanceStore((s) => s.setPrompt);
  const setModalOpen = useEnhanceStore((s) => s.setModalOpen);

  const [promptInput, setPromptInput] = useState(prompt);

  useEffect(() => {
    if (isOpen) {
      setPromptInput(prompt);
      setModalOpen(true);
    }
  }, [isOpen, prompt, setModalOpen]);

  // Animation
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);

      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    } else {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setModalOpen(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, setModalOpen]);

  // Closing when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = () => {
    setPrompt(promptInput);
    onConfirm();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleSubmit();
    }
  };

  if (!isOpen && !isVisible) return null;

  // Content based on the user selected mode
  const content = {
    title:
      mode === "kids" ? "Tell us your magic idea!" : "Enhance Your Artwork",
    description:
      mode === "kids"
        ? "Tell us about your drawing to make the magic better!🦄✨"
        : "Add context to help our AI enhance your artwork with precision",
    placeholder:
      mode === "kids"
        ? "What's in your cool picture? 'Dragon eating ice cream' or 'Superhero cat' 🦸‍♀️🐱"
        : "Describe your vision (e.g., 'cyberpunk cityscape with neon lights and rain')",
    buttonText: mode === "kids" ? "Make Magic!" : "Enhance Artwork",
    skipText: mode === "kids" ? "Skip" : "Skip Description",
  };

  return (
    <div
      className={`${styles.modalOverlay} ${isVisible ? styles.visible : ""}`}
    >
      <div
        ref={modalRef}
        className={`${styles.modalContainer} ${
          isVisible ? styles.visible : ""
        }`}
      >
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className={styles.modalContent}>
          <div className={styles.headerSection}>
            <h3 className={styles.modalTitle}>{content.title}</h3>
            <p className={styles.modalDescription}>{content.description}</p>
          </div>

          <div className={styles.inputSection}>
            <label htmlFor="promptInput" className={styles.inputLabel}>
              {mode === "kids" ? "Your Description" : "Artwork Description"}
            </label>
            <textarea
              id="promptInput"
              ref={inputRef}
              className={styles.promptInput}
              placeholder={content.placeholder}
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={4}
              aria-label="Artwork description"
            />
            {mode === "pro" && (
              <p className={styles.inputHint}>
                Tip: Be specific about style, mood, colors, and details
              </p>
            )}
          </div>

          <div className={styles.buttonGroup}>
            <button className={styles.skipButton} onClick={onConfirm}>
              {content.skipText}
            </button>
            <button className={styles.enhanceButton} onClick={handleSubmit}>
              {content.buttonText}
            </button>
          </div>

          <div className={styles.termsSection}>
            <p className={styles.termsDisclaimer}>
              * By enhancing, you agree to our{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer">
                Terms and Conditions
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancePromptModal;
