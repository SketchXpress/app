"use client";

import Image from "next/image";
import Link from "next/link";
import { toast } from "react-toastify";
import { useState, useEffect } from "react";
import { useCanvasStore } from "@/stores/canvasStore";
import {
  Menu,
  X,
  Share2,
  LucideLayoutDashboard,
  Save,
  Coins,
} from "lucide-react";
import { getSnapshot } from "tldraw";

import styles from "./Header.module.scss";
import logo from "../../../public/logo.png";
import responsive from "./HeaderResponsive.module.scss";
import MobileMenu from "../MobileMenu/MobileMenu";
import ModeToggle from "../ModeToggle/ModeToggle";
import canvasStorage from '@/lib/canvasStorage';

import ConnectWalletButton from "@/wallet/ConnectWalletButton";

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

  // Change handleSave to be async
  const handleSave = async () => {
    const editor = useCanvasStore.getState().editor;

    if (!editor) {
      toast.error("Nothing to save yet. Try drawing something first!", {
        position: "bottom-left",
        autoClose: 3000,
      });
      return;
    }

    try {
      const snapshot = getSnapshot(editor.store);

      // Save with a timestamp-based name for manual saves
      const saveName = `manual-${Date.now()}`;

      // Show loading toast
      const loadingToast = toast.loading("Saving your artwork...", {
        position: "bottom-left",
      });

      // Generate a small preview thumbnail
      let previewBase64 = '';
      try {
        // Get a small SVG preview if possible
        const svgResult = await editor.getSvgString(editor.getSelectedShapeIds(), {
          scale: 0.2,
          background: true,
        });

        if (svgResult && svgResult.svg) {
          previewBase64 = `data:image/svg+xml;base64,${btoa(svgResult.svg)}`;
        }
      } catch (previewErr) {
        console.warn('Failed to generate preview:', previewErr);
      }

      // Save canvas with the preview
      const success = await canvasStorage.saveCanvas(snapshot, saveName);
      toast.dismiss(loadingToast);

      if (success) {
        // If we got a preview, save it
        if (previewBase64) {
          await canvasStorage.saveCanvasPreview(saveName, previewBase64);
        }

        toast.success("Project saved successfully!", {
          position: "bottom-left",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          icon: <span>🎨</span>,
        });
      } else {
        toast.error("Failed to save project. Please try again.", {
          position: "bottom-left",
          autoClose: 3000,
        });
      }
    } catch (err) {
      console.error('Error in handleSave:', err);
      toast.error("Failed to save project. Please try again.", {
        position: "bottom-left",
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
            position: "bottom-left",
            autoClose: 2000,
          });
        })
        .catch((error) => {
          if (error.name !== "AbortError") {
            toast.error("Could not share content", {
              position: "bottom-left",
              autoClose: 3000,
            });
          }
        });
    } else {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          toast.info("Link copied to clipboard!", {
            position: "bottom-left",
            autoClose: 3000,
            icon: <span>📋</span>,
          });
        })
        .catch(() => {
          toast.error("Could not copy the link", {
            position: "bottom-left",
            autoClose: 3000,
          });
        });
    }
  };

  return (
    <header className={`${styles.header} ${responsive.header} header`}>
      {/* Logo */}
      <Link href="/" className={styles.logoWrap}>
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
      </Link>

      {/* Mode Toggle in the middle for desktop */}
      {!isMobile && (
        // <div className={`${styles.centerControls} ${responsive.centerControls}`}>
        <ModeToggle />
        // </div>
      )}

      {/* Desktop Controls */}
      {!isMobile && (
        <div className={`${styles.controls} ${responsive.controls}`}>
          <Link href="/mintstreet" className={styles.mintStreetButton}>
            <Coins size={18} />
            <span>MintStreet</span>
          </Link>
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
            <Link
              href="/mintstreet"
              className={`${styles.actionButton} ${styles.dashboardButton} ${responsive.actionButton}`}
              aria-label="Dashboard"
            >
              <LucideLayoutDashboard size={18} />
            </Link>
          </div>
          <div className={styles.connectWalletDesktop}>
            <ConnectWalletButton />
          </div>
        </div>
      )}

      {/* Mobile Controls */}
      {isMobile && (
        <>
          {/* Empty div for flex layout balance on the left */}
          <div className={styles.mobileSpacerLeft}></div>

          {/* MintStreet Button in the middle for mobile */}
          <Link href="/mintstreet" className={styles.mobileMintStreetButton}>
            <Coins size={18} />
            <span>MintStreet</span>
          </Link>

          {/* Hamburger Menu Button on the right */}
          <button
            className={`${styles.menuIconButton} ${responsive.menuIconButton}`}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? "Close Menu" : "Open Menu"}
          >
            {isMenuOpen ? (
              <X size={24} className={styles.menuIcon} />
            ) : (
              <Menu size={24} className={styles.menuIcon} />
            )}
          </button>
        </>
      )}

      {/* Mobile Menu */}
      <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </header>
  );
};

export default Header;
