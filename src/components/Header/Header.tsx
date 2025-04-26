"use client";

import Image from "next/image";
import logo from "../../../public/logo.png";
import ModeToggle from "../ModeToggle/ModeToggle";
import styles from "./Header.module.scss";
import { Menu, Share2, User, Save } from "lucide-react";
import { useState } from "react";
import ConnectWalletButton from "@/wallet/ConnectWalletButton";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className={styles.header}>
      {/* Mobile menu button */}
      <button
        className={styles.menuButton}
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        aria-label="Toggle menu"
      >
        <Menu size={20} />
      </button>

      {/* Logo */}
      <div className={styles.logoWrap}>
        <div className={styles.logoContainer}>
          <Image
            src={logo}
            alt="SketchXpress Logo"
            className={styles.logoImage}
            priority
          />
        </div>
        <span className={styles.title}>SketchXpress</span>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <ModeToggle />

        {/* Action Buttons */}
        <div className={styles.actions}>
          <button className={styles.actionButton} aria-label="Save">
            <Save size={18} />
          </button>
          <button className={styles.actionButton} aria-label="Share">
            <Share2 size={18} />
          </button>
          <button className={styles.profileButton} aria-label="Profile">
            <User size={18} />
          </button>
        </div>

        {/* Desktop-only Connect Wallet Button */}
        <div className={styles.connectWalletDesktop}>
          <ConnectWalletButton />
        </div>
      </div>

      {/* Mobile menu overlay */}
      {isMenuOpen && (
        <div className={styles.mobileMenu}>
          <div className={styles.mobileMenuContent}>
            <button className={styles.mobileMenuItem}>
              <Save size={18} />
              <span>Save Project</span>
            </button>
            <button className={styles.mobileMenuItem}>
              <Share2 size={18} />
              <span>Share</span>
            </button>
            <button className={styles.mobileMenuItem}>
              <User size={18} />
              <span>Profile</span>
            </button>

            {/* Connect Wallet in Mobile Menu */}
            <div className={styles.mobileMenuItem}>
              <ConnectWalletButton />
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
