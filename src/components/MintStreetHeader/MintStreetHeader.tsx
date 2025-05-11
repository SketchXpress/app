"use client";

import Image from "next/image";
import logo from "../../../public/assets/images/logo.png";
import styles from "./MintStreetHeader.module.scss";
import { ArrowLeft, Search } from "lucide-react";
import { useState, useEffect } from "react";
import ConnectWalletButton from "@/wallet/ConnectWalletButton";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MintStreetHeader = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const pathname = usePathname();

  // Check if we're on a specific collection page
  const isCollectionPage = pathname?.includes('/mintstreet/') && pathname !== '/mintstreet';

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const toggleSearchExpansion = () => {
    setIsSearchExpanded(!isSearchExpanded);
  };

  return (
    <header className={styles.header}>
      {!isMobile && (
        <>
          {/* Logo */}
          <Link href="/" className={styles.logoWrap}>
            <div className={styles.logoContainer}>
              <Image
                src={logo}
                alt="SketchXpress Logo"
                className={styles.logoImage}
                priority
              />
            </div>
            <span className={styles.title}>
              SketchXpress
            </span>
          </Link>

          {/* Search Bar - Center for Desktop */}
          <div className={styles.centerControls}>
            <div className={styles.searchBar}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search NFTs..."
                className={styles.searchInput}
              />
            </div>
          </div>

          {/* Desktop Right Controls */}
          <div className={styles.controls}>
            {isCollectionPage ? (
              <>
                <Link href="/mintstreet" className={styles.returnButton}>
                  <ArrowLeft size={16} />
                  <span>Return to MintStreet</span>
                </Link>
              </>
            ) : (
              <Link href="/" className={styles.returnButton}>
                <ArrowLeft size={16} />
                <span>Return to Studio</span>
              </Link>
            )}
            <div className={styles.connectWalletDesktop}>
              <ConnectWalletButton />
            </div>
          </div>
        </>
      )}

      {/* Mobile Layout */}
      {isMobile && (
        <div className={styles.mobileControls}>
          {isSearchExpanded ? (
            <div className={styles.expandedMobileSearchContainer}>
              <Search size={16} className={styles.mobileSearchIcon} />
              <input
                type="text"
                placeholder="Search NFTs..."
                className={styles.mobileSearchInput}
                autoFocus
              />
              <button
                className={styles.closeSearchButton}
                onClick={toggleSearchExpansion}
              >
                &times;
              </button>
            </div>
          ) : (
            <>
              <div className={styles.mobileLeft}>
                <Link href="/" className={styles.logoWrap}>
                  <div className={styles.logoContainer}>
                    <Image
                      src={logo}
                      alt="SketchXpress Logo"
                      className={styles.logoImage}
                      priority
                    />
                  </div>
                  <span className={styles.title}>
                    SketchXpress
                  </span>
                </Link>
              </div>
              <div className={styles.mobileCenter}>
                <button
                  className={styles.searchIconButton}
                  onClick={toggleSearchExpansion}
                >
                  <Search size={18} />
                </button>
              </div>
              <div className={styles.mobileRight}>
                {isCollectionPage ? (
                  <div className={styles.mobileReturnButtons}>
                    <Link href="/mintstreet" className={styles.mobileReturnButton}>
                      <ArrowLeft size={16} />
                      <span>To MintStreet</span>
                    </Link>
                  </div>
                ) : (
                  <Link href="/" className={styles.mobileReturnButton}>
                    <ArrowLeft size={16} />
                    <span>Return</span>
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
};

export default MintStreetHeader;