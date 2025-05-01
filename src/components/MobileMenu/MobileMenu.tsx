"use client";

import { useState } from "react";
import styles from "./MobileMenu.module.scss";
import { Save, Share2, LucideLayoutDashboard, X } from "lucide-react";
import ConnectWalletButton from "@/wallet/ConnectWalletButton";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const MobileMenu = ({ isOpen, onClose }: Props) => {
  const [mode, setMode] = useState<"kids" | "pro">("pro");

  const handleSave = () => {
    const snapshot = localStorage.getItem("sketchxpress-manual-save");
    alert(snapshot ? "Project saved!" : "Nothing to save yet.");
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: "SketchXpress Creation",
        text: "Check my creation on SketchXpress!",
        url,
      }).catch(() => { });
    } else {
      navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  if (!isOpen) return null;

  return (
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
    </div>
  );
};

export default MobileMenu;
