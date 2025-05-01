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
import { toast } from "react-toastify";

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
      try {
        const snapshot = editor.store.getSnapshot();
        const serializedState = JSON.stringify(snapshot);

        if (serializedState.length > 4.5 * 1024 * 1024) {
          toast.warning("Your project is too large to save locally. Consider exporting instead.", {
            position: "bottom-right",
            autoClose: 5000,
          });
          return;
        }

        localStorage.setItem("sketchxpress-manual-save", serializedState);

        toast.success("Project saved successfully!", {
          position: "bottom-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          icon: <span>🎨</span>,
        });
      } catch (error) {
        toast.error("Failed to save project. Please try again.", {
          position: "bottom-right",
          autoClose: 3000,
        });
        console.error("Save error:", error);
      }
    } else {
      toast.error("Nothing to save yet. Try drawing something first!", {
        position: "bottom-right",
        autoClose: 3000,
      });
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
        .then(() => {
          toast.success("Shared successfully!", {
            position: "bottom-right",
            autoClose: 2000,
          });
        })
        .catch((error) => {
          if (error.name !== "AbortError") {
            toast.error("Could not share content", {
              position: "bottom-right",
              autoClose: 3000,
            });
          }
        });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        toast.info("Link copied to clipboard!", {
          position: "bottom-right",
          autoClose: 3000,
          icon: <span>📋</span>,
        });
      }).catch(() => {
        toast.error("Could not copy the link", {
          position: "bottom-right",
          autoClose: 3000,
        });
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

      {/* Desktop Controls */}
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

      {/* Mobile Controls */}
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
