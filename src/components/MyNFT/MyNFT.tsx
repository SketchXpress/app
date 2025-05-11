"use client";

import React, { useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { NFT } from "@/types/nft"; // Assuming NFT type is defined here
import { useWalletNFTs } from "@/hooks/queries/useWalletNFTs"; // Recommendation: This hook should support pagination
import { useTransactionHistory } from "@/hooks/queries/useTransactionHistory"; // Recommendation: NFT-to-pool mapping ideally from backend
import ConnectWalletButton from "@/wallet/ConnectWalletButton";
import styles from "./MyNFT.module.scss";
import { ArrowRight, Wallet, Image as ImageIcon, Gem, ChevronDown, AlertCircle } from "lucide-react";

// Confirmed list of valid fallback/placeholder images in /public folder
const VALID_NFT_IMAGES = [
  "/defaultNFT.png",
  "/nft1.jpeg",
  "/nft3.jpg",
  "/nft4.jpg",
  "/nft5.png",
  "/nft6.webp",
  "/demoCar.png",
  "/demoHouse.png",
  "/demoRobot.webp",
];

const INITIAL_VISIBLE_COUNT = 8;
const LOAD_MORE_COUNT = 4;

/**
 * @typedef {object} Transaction
 * @property {string} instructionName - Name of the instruction (e.g., "mintNft").
 * @property {Array<{toString: () => string}>} [accounts] - Accounts involved in the transaction.
 * @property {string} [poolAddress] - Pool address associated with the transaction.
 */

/**
 * MyNFT component displays the connected user's NFT gallery.
 * It fetches NFTs using `useWalletNFTs` and transaction history via `useTransactionHistory`
 * to map NFTs to their respective pools (client-side, with a recommendation for backend processing).
 * Features include pagination for NFTs, error handling, loading states, and wallet connection prompts.
 *
 * @component
 * @returns {React.ReactElement} The rendered "My NFTs" section.
 */
const MyNFT: React.FC = () => {
  const router = useRouter();
  const { connected } = useWallet();
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);

  // Fetch user's NFTs. Recommendation: `useWalletNFTs` should ideally support pagination internally.
  const { data: nfts = [], isLoading: nftsLoading, error: nftsError, refetch: refetchNfts } = useWalletNFTs();

  // Fetch transaction history. Recommendation: NFT-to-pool mapping should ideally be derived server-side.
  const { data: history = [], isLoading: historyLoading, error: historyError, refetch: refetchHistory } = useTransactionHistory(100); // Limit history fetch

  // Memoized mapping of NFT mint addresses to pool addresses
  const nftToPoolMap = useMemo(() => {
    if (historyLoading || !history || history.length === 0 || !nfts || nfts.length === 0) {
      return {};
    }
    const map: Record<string, string> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    history.forEach((tx: any) => { // Use 'any' if Transaction type is not strictly defined for history items
      if (tx.instructionName === "mintNft" && tx.accounts && tx.accounts.length > 1 && tx.poolAddress) {
        const mintAddress = tx.accounts[1]?.toString();
        if (mintAddress) {
          map[mintAddress] = tx.poolAddress;
        }
      }
    });
    return map;
  }, [history, historyLoading, nfts]);

  // Memoized count of NFTs that have an associated pool
  const nftsWithPoolCount = useMemo(() => {
    return nfts.filter(nft => !!nftToPoolMap[nft.mintAddress]).length;
  }, [nfts, nftToPoolMap]);

  const handleLoadMore = useCallback(() => {
    setVisibleCount(prevCount => prevCount + LOAD_MORE_COUNT);
  }, []);

  const visibleNFTs = useMemo(() => nfts.slice(0, visibleCount), [nfts, visibleCount]);
  const hasMoreNfts = useMemo(() => nfts.length > visibleCount, [nfts, visibleCount]);

  const handleNFTClick = useCallback((nft: NFT) => {
    const poolAddress = nftToPoolMap[nft.mintAddress];
    if (poolAddress) {
      router.push(`/mintstreet/collection/${poolAddress}`);
    } else {
      // Potentially navigate to a generic NFT details page if available, or stay on MintStreet
      router.push(`/mintstreet`);
      // console.log(`NFT ${nft.mintAddress} does not have an associated pool in the current history.`);
    }
  }, [nftToPoolMap, router]);

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.currentTarget as HTMLImageElement;
    target.src = VALID_NFT_IMAGES[0]; // Fallback to the first image in the valid list (defaultNFT.png)
    target.onerror = null;
  }, []);

  const totalValue = useMemo(() => {
    return nfts.reduce((acc: number, nft: NFT) => {
      const priceMatch = nft.price?.match(/(\d+\.?\d*)/); // Extract numeric part of price
      const price = priceMatch ? parseFloat(priceMatch[0]) : 0;
      return acc + (isNaN(price) ? 0 : price);
    }, 0).toFixed(2);
  }, [nfts]);

  const isLoading = nftsLoading || (connected && historyLoading); // History is only relevant if connected and NFTs are loaded
  const displayError = nftsError || (connected && historyError && nfts.length > 0) ? (nftsError || historyError) : null;

  const handleRetry = useCallback(() => {
    if (nftsError) refetchNfts();
    if (historyError) refetchHistory();
  }, [nftsError, historyError, refetchNfts, refetchHistory]);

  if (!connected) {
    return (
      <section className={styles.trendingSection} aria-labelledby="mynft-gallery-heading-disconnected">
        <div className={styles.container}>
          <div className={styles.header}>
            <h2 id="mynft-gallery-heading-disconnected" className={styles.tabButton}>Your NFT Gallery</h2>
            <div className={styles.statsCounter}>
              <span className={styles.nftsCount}>0 NFTs</span>
              <span className={styles.totalValue}>0.00 SOL</span>
            </div>
          </div>
          <div className={styles.walletNotConnected}>
            <div className={styles.messageContainer}>
              <div className={styles.iconWrapper}><Wallet size={32} className={styles.walletIcon} aria-hidden="true" /></div>
              <h3 className={styles.title}>Your NFT Gallery</h3>
              <p className={styles.message}>Connect your wallet to view your NFT collection.</p>
              <div className={styles.previewGrid} aria-hidden="true">
                {[1, 2, 3].map((i) => (
                  <div key={`preview-${i}`} className={styles.previewCard}>
                    <div className={styles.previewImageContainer}><ImageIcon className={styles.placeholderIcon} /></div>
                  </div>
                ))}
              </div>
              <div className={styles.connectButtonWrapper}><ConnectWalletButton /></div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.trendingSection} aria-labelledby="mynft-gallery-heading-connected">
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 id="mynft-gallery-heading-connected" className={`${styles.tabButton} ${styles.activeTab}`}>Your NFT Gallery</h2>
          <div className={styles.statsCounter}>
            <span className={styles.nftsCount} aria-label={`Total NFTs: ${nfts.length}`}>{nfts.length} NFTs</span>
            <span className={styles.totalValue} aria-label={`Total value: ${totalValue} SOL`}>{totalValue} SOL</span>
            {nfts.length > 0 && (
              <span className={styles.poolsCount} aria-label={`${nftsWithPoolCount} NFTs with associated pools`}>{nftsWithPoolCount} with pools</span>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className={styles.loadingContainer} role="status" aria-live="polite">
            <div className={styles.loadingSpinner}></div>
            <p>Loading your NFTs...</p>
          </div>
        ) : displayError ? (
          <div className={styles.errorContainer} role="alert">
            <AlertCircle size={32} className={styles.errorIcon} aria-hidden="true" />
            <p className={styles.errorMessage}>Error loading your NFTs: {displayError.message || "An unknown error occurred."}</p>
            <button className={styles.retryButton} onClick={handleRetry}>Retry</button>
          </div>
        ) : nfts.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}><ImageIcon size={48} aria-hidden="true" /></div>
            <p>You don&apos;t have any NFTs yet.</p>
            <p className={styles.emptyStateSubtext}>Explore collections and mint your first NFT!</p>
            <button className={styles.exploreButton} onClick={() => router.push("/mintstreet")}>
              Explore Collections <ArrowRight size={16} className={styles.arrowIcon} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            <div className={styles.nftGrid}>
              {visibleNFTs.map((nft, index) => {
                const hasPool = !!nftToPoolMap[nft.mintAddress];
                const imageSrc = (nft.image && (nft.image.startsWith("http") || nft.image.startsWith("/") || nft.image.startsWith("data:"))) ? nft.image : VALID_NFT_IMAGES[0];
                return (
                  <div
                    key={nft.id || nft.mintAddress || `nft-${index}`}
                    className={`${styles.nftCard} ${hasPool ? styles.hasPool : ""}`}
                    onClick={() => handleNFTClick(nft)}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => e.key === "Enter" && handleNFTClick(nft)}
                    aria-label={`View details for NFT: ${nft.name}`}
                  >
                    <div className={styles.nftImageContainer}>
                      <Image
                        src={imageSrc}
                        alt={nft.name || "User NFT"}
                        width={200} // Specify appropriate width
                        height={200} // Specify appropriate height
                        className={styles.nftImage}
                        onError={handleImageError}
                        placeholder="blur"
                        blurDataURL={VALID_NFT_IMAGES[0]} // Use a generic small placeholder
                      />
                      <div className={styles.priceTag}>
                        <Gem size={14} className={styles.gemIcon} aria-hidden="true" /> {nft.price}
                      </div>
                      {hasPool && <div className={styles.poolBadge}>Pool</div>}
                    </div>
                    <div className={styles.nftInfo}>
                      <h4 className={styles.nftName}>{nft.name}</h4>
                      <p className={styles.collectionName}>{nft.collectionName}</p>
                      <div className={styles.viewDetailsButton} aria-hidden="true">
                        {hasPool ? "View Collection" : "View Details"}
                        <ArrowRight size={14} className={styles.arrowIcon} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {hasMoreNfts && (
              <div className={styles.loadMoreContainer}>
                <button className={styles.loadMoreButton} onClick={handleLoadMore} disabled={isLoading}>
                  Show More <ChevronDown size={16} className={styles.chevronIcon} aria-hidden="true" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default React.memo(MyNFT);

