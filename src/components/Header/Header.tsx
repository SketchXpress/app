"use client";

import Image from "next/image";
import logo from "../../../public/logo.png";
import styles from "./Header.module.scss";
import responsive from "./HeaderResponsive.module.scss";
import { Menu, X, Share2, LucideLayoutDashboard, Save } from "lucide-react";
import { useState, useEffect } from "react";
import MobileMenu from "../MobileMenu/MobileMenu";
import ModeToggle from "../ModeToggle/ModeToggle";
import ConnectWalletButton from "@/wallet/ConnectWalletButton";
import { useCanvasStore } from "@/stores/canvasStore";
import { toast } from "react-hot-toast"

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleSave = () => {
    const editor = useCanvasStore.getState().editor;
    if (editor) {
      const snapshot = editor.store.getSnapshot();
      const serializedState = JSON.stringify(snapshot);
      localStorage.setItem("sketchxpress-manual-save", serializedState);

      toast("Project saved successfully!");
    } else {
      toast.error("Nothing to save yet.");
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator
        .share({
          title: "My SketchXpress Creation",
          text: "Check out what I made with SketchXpress!",
          url,
        })
        .catch(() => { });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        toast("Link copied to clipboard!");
      });
    }
  };


  return (
    <header className={`${styles.header} ${responsive.header} header`}>
      {/* Logo */}
      <div className={`${styles.logoWrap} ${responsive.logoWrap}`}>
        <div className={styles.logoContainer}>
          <Image
            src={logo}
            alt="SketchXpress Logo"
            className={styles.logoImage}
            priority
          />
        </div>
        <span className={`${styles.title} ${responsive.title}`}>
          SketchXpress
        </span>
      </div>

      {/* Desktop View */}
      {!isMobile && (
        <div className={`${styles.controls} ${responsive.controls}`}>
          <ModeToggle />

          <div className={`${styles.actions} ${responsive.actions}`}>
            <button
              className={`${styles.actionButton} ${styles.saveButton} ${responsive.actionButton}`}
              aria-label="Save"
              onClick={handleSave}
            >
              <Save size={18} />
            </button>

            <button
              className={`${styles.actionButton} ${styles.shareButton} ${responsive.actionButton}`}
              aria-label="Share"
              onClick={handleShare}
            >
              <Share2 size={18} />
            </button>

            <button
              className={`${styles.dashboardButton} ${responsive.dashboardButton}`}
              aria-label="Dashboard"
            >
              <LucideLayoutDashboard size={18} />
            </button>
          </div>

          <div className={styles.connectWalletDesktop}>
            <ConnectWalletButton />
          </div>
        </div>
      )}

      {/* Mobile View → Show Menu / Close */}
      {isMobile && (
        <button
          className={`${styles.menuButton} ${responsive.menuButton}`}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={isMenuOpen ? "Close Menu" : "Open Menu"}
        >
          {isMenuOpen ? (
            <X size={24} className={styles.menuIcon} />
          ) : (
            <>
              <Menu size={20} className={styles.menuIcon} />
              <span className={styles.menuText}>Menu</span>
            </>
          )}
        </button>
      )}


      {/* Mobile Menu */}
      <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </header>
  );
};

export default Header;
