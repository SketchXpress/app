"use client";

import Image from "next/image";
import logo from "../../../public/logo.png";
import ModeToggle from "../ModeToggle/ModeToggle";
import styles from "./Header.module.scss";
import { Menu, Share2, User, Save } from "lucide-react";
import { useState } from "react";

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
      </div>

      {/* Mobile menu overlay */}
      {isMenuOpen && (
        <div className={styles.mobileMenu}>
          <div className={styles.mobileMenuContent}>
            {/* Menu items would go here */}
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
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;