import { useState, useEffect, useRef } from 'react';
import styles from './EnhancePromptModal.module.scss';
import { useEnhanceStore } from '@/stores/enhanceStore';
import { useModeStore } from '@/stores/modeStore';
import { X } from 'lucide-react';

interface EnhancePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const EnhancePromptModal = ({ isOpen, onClose, onConfirm }: EnhancePromptModalProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get current application mode (kids or pro)
  const mode = useModeStore((s) => s.mode);

  // Get prompt from store and update function
  const prompt = useEnhanceStore((s) => s.prompt);
  const setPrompt = useEnhanceStore((s) => s.setPrompt);

  // Local state for prompt input
  const [promptInput, setPromptInput] = useState(prompt);

  // Sync local state with store when modal opens
  useEffect(() => {
    if (isOpen) {
      setPromptInput(prompt);
    }
  }, [isOpen, prompt]);

  // Animation handling
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Focus the textarea when modal opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen) {
        // Close on Escape
        if (e.key === 'Escape') {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = () => {
    // Update the store with the prompt
    setPrompt(promptInput);
    onConfirm();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Ctrl+Enter or Command+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit();
    }
  };

  // No longer needed as we're setting placeholder directly in the JSX

  // Don't render anything if modal is fully closed
  if (!isOpen && !isVisible) return null;

  return (
    <div className={`${styles.modalOverlay} ${isVisible ? styles.visible : ''}`}>
      <div
        ref={modalRef}
        className={`${styles.modalContainer} ${isVisible ? styles.visible : ''}`}
      >
        <button className={styles.closeButton} onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className={styles.modalContent}>
          <h3 className={styles.modalTitle}>
            {mode === 'kids' ? 'Tell us your magic idea!' : 'Describe your artwork'}
          </h3>

          <p className={styles.modalDescription}>
            {mode === 'kids'
              ? "Tell us about your drawing to make the magic better!🦄✨"
              : "Adding a description helps the AI understand your vision!"}
          </p>

          <textarea
            ref={inputRef}
            className={styles.promptInput}
            placeholder={mode === 'kids'
              ? "What's in your cool picture? 'Dragon eating ice cream' or 'Superhero cat' 🦸‍♀️🐱"
              : "Describe what you're going for (e.g., 'Moody cyberpunk alley, neon signs, rain')"}
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
            aria-label="Artwork description"
          />

          <div className={styles.buttonGroup}>
            <button
              className={styles.skipButton}
              onClick={onConfirm}
            >
              Skip
            </button>
            <button
              className={styles.enhanceButton}
              onClick={handleSubmit}
            >
              {mode === 'kids' ? 'Make Magic!' : 'Enhance Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancePromptModal;