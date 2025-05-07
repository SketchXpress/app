"use client";

import { createPortal } from "react-dom";
import { X, Save, Share2, LucideLayoutDashboard } from "lucide-react";
import styles from "./MobileMenu.module.scss";
import ConnectWalletButton from "@/wallet/ConnectWalletButton";
import { useModeStore } from "@/stores/modeStore";
import { toast } from "react-toastify";
import { useEffect, useState } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const MobileMenu = ({ isOpen, onClose }: Props) => {
  const [mounted, setMounted] = useState(false);
  const mode = useModeStore((state) => state.mode);
  const setMode = useModeStore((state) => state.setMode);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSave = () => {
    const snapshot = localStorage.getItem("sketchxpress-manual-save");

    if (snapshot) {
      toast.success("Project saved successfully!", {
        position: "bottom-left",
        autoClose: 2000,
        icon: <span>🎨</span>,
      });
    } else {
      toast.info("Nothing to save yet.", {
        position: "bottom-left",
        autoClose: 2000,
      });
    }
  };

  const handleShare = () => {
    const url = window.location.href;

    if (navigator.share) {
      navigator
        .share({
          title: "SketchXpress Creation",
          text: "Check my creation on SketchXpress!",
          url,
        })
        .then(() => {
          toast.success("Shared successfully!", {
            position: "bottom-left",
            autoClose: 2000,
          });
        })
        .catch(() => {
          toast.error("Could not share content", {
            position: "bottom-left",
            autoClose: 3000,
          });
        });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        toast.info("Link copied to clipboard!", {
          position: "bottom-left",
          autoClose: 2000,
          icon: <span>📋</span>,
        });
      });
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.menu}>
        <div className={styles.header}>
          <span className={styles.logoText}>SketchXpress</span>
          <button onClick={onClose} className={styles.closeButton}>
            <X size={24} />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className={styles.modeToggle}>
          <button
            className={mode === "kids" ? styles.active : ""}
            onClick={() => setMode("kids")}
          >
            Kids
          </button>
          <button
            className={mode === "pro" ? styles.active : ""}
            onClick={() => setMode("pro")}
          >
            Pro
          </button>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button onClick={handleSave}>
            <Save size={20} />
            <span>Save Project</span>
          </button>
          <button onClick={handleShare}>
            <Share2 size={20} />
            <span>Share</span>
          </button>
          <button>
            <LucideLayoutDashboard size={20} />
            <span>Dashboard</span>
          </button>
        </div>

        {/* Wallet Connect */}
        <div className={styles.walletConnect}>
          <ConnectWalletButton />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MobileMenu;
