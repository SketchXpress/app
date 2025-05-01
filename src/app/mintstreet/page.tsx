"use client";

import styles from "./page.module.scss";
import { useState } from "react";

const MintStreetPage = () => {
  // Placeholder state for NFT gallery
  const [activeTab, setActiveTab] = useState("gallery");

  return (
    <div className={styles.container}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>Welcome to MintStreet</h1>
          <p className={styles.heroSubtitle}>Mint your sketches as NFTs and showcase your creativity to the world</p>
        </div>
      </section>

      <nav className={styles.tabNav}>
        <button
          className={`${styles.tabButton} ${activeTab === "gallery" ? styles.active : ""}`}
          onClick={() => setActiveTab("gallery")}
        >
          Gallery
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === "mint" ? styles.active : ""}`}
          onClick={() => setActiveTab("mint")}
        >
          Mint NFT
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === "marketplace" ? styles.active : ""}`}
          onClick={() => setActiveTab("marketplace")}
        >
          Marketplace
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === "collection" ? styles.active : ""}`}
          onClick={() => setActiveTab("collection")}
        >
          My Collection
        </button>
      </nav>

      <main className={styles.content}>
        {activeTab === "gallery" && (
          <div className={styles.gallery}>
            <h2>Featured Creations</h2>
            <div className={styles.nftGrid}>
              {/* Placeholder for NFT grid */}
              <div className={styles.emptyState}>
                <p>Connect your wallet to view the gallery</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "mint" && (
          <div className={styles.mintSection}>
            <h2>Mint Your Creation</h2>
            <div className={styles.mintForm}>
              <p>Turn your SketchXpress creations into unique digital collectibles</p>
              <button className={styles.mintButton}>Select Artwork to Mint</button>
            </div>
          </div>
        )}

        {activeTab === "marketplace" && (
          <div className={styles.marketplace}>
            <h2>NFT Marketplace</h2>
            <div className={styles.emptyState}>
              <p>Browse and collect unique digital art</p>
            </div>
          </div>
        )}

        {activeTab === "collection" && (
          <div className={styles.collection}>
            <h2>My Collection</h2>
            <div className={styles.emptyState}>
              <p>Connect your wallet to view your collection</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MintStreetPage;