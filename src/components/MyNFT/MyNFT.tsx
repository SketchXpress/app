"use client";

import React, { useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { NFT } from "@/types/nft";
import { useWalletNFTs } from "@/hooks/queries/useWalletNFTs";
import { useTransactionHistory } from "@/hooks/queries/useTransactionHistory";

import ConnectWalletButton from "@/wallet/ConnectWalletButton";
import styles from "./MyNFT.module.scss";
import {
  ArrowRight,
  Wallet,
  Image as ImageIcon,
  Gem,
  ChevronDown,
  AlertCircle,
  Loader,
  RefreshCw,
} from "lucide-react";

// Confirmed list of valid fallback/placeholder images in /public folder
const VALID_NFT_IMAGES = "/assets/images/defaultNFT.png";

const INITIAL_VISIBLE_COUNT = 8;
const LOAD_MORE_COUNT = 4;

/**
 * MyNFT component displays the connected user's NFT gallery.
 * Features include pagination for NFTs, error handling, loading states, and wallet connection prompts.
 */
const MyNFT: React.FC = () => {
  const router = useRouter();
  const { connected, connecting } = useWallet();
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);

  // Fetch user's NFTs
  const {
    data: nfts = [],
    isLoading: nftsLoading,
    error: nftsError,
    refetch: refetchNfts,
  } = useWalletNFTs();

  // Fetch transaction history
  const {
    data: history = [],
    isLoading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useTransactionHistory(100);

  // Memoized mapping of NFT mint addresses to pool addresses
  const nftToPoolMap = useMemo(() => {
    if (!history || history.length === 0 || !nfts || nfts.length === 0) {
      return {};
    }
    const map: Record<string, string> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    history.forEach((tx: any) => {
      if (
        tx.instructionName === "mintNft" &&
        tx.accounts &&
        tx.accounts.length > 1 &&
        tx.poolAddress
      ) {
        const mintAddress = tx.accounts[1]?.toString();
        if (mintAddress) {
          map[mintAddress] = tx.poolAddress;
        }
      }
    });
    return map;
  }, [history, nfts]);

  // Memoized count of NFTs that have an associated pool
  const nftsWithPoolCount = useMemo(() => {
    return nfts.filter((nft) => !!nftToPoolMap[nft.mintAddress]).length;
  }, [nfts, nftToPoolMap]);

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prevCount) => prevCount + LOAD_MORE_COUNT);
  }, []);

  const visibleNFTs = useMemo(
    () => nfts.slice(0, visibleCount),
    [nfts, visibleCount]
  );

  const hasMoreNfts = useMemo(
    () => nfts.length > visibleCount,
    [nfts, visibleCount]
  );

  const handleNFTClick = useCallback(
    (nft: NFT) => {
      const poolAddress = nftToPoolMap[nft.mintAddress];
      if (poolAddress) {
        router.push(`/mintstreet/collection/${poolAddress}`);
      } else {
        // Navigate to NFT details page or stay on MintStreet
        router.push(`/mintstreet`);
      }
    },
    [nftToPoolMap, router]
  );

  const handleImageError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      const target = e.currentTarget as HTMLImageElement;
      if (target.src !== VALID_NFT_IMAGES) {
        target.src = VALID_NFT_IMAGES;
        target.onerror = null;
      }
    },
    []
  );

  const totalValue = useMemo(() => {
    return nfts
      .reduce((acc: number, nft: NFT) => {
        const priceMatch = nft.price?.match(/(\d+\.?\d*)/);
        const price = priceMatch ? parseFloat(priceMatch[0]) : 0;
        return acc + (isNaN(price) ? 0 : price);
      }, 0)
      .toFixed(2);
  }, [nfts]);

  const isLoading = nftsLoading || (connected && historyLoading);
  const displayError = nftsError || (connected && historyError);

  const handleRetry = useCallback(() => {
    if (nftsError) refetchNfts();
    if (historyError) refetchHistory();
  }, [nftsError, historyError, refetchNfts, refetchHistory]);

  // Loading state for connecting wallet
  if (connecting) {
    return (
      <section
        className={styles.trendingSection}
        aria-labelledby="mynft-gallery-heading-connecting"
      >
        <div className={styles.container}>
          <div className={styles.header}>
            <h2
              id="mynft-gallery-heading-connecting"
              className={styles.tabButton}
            >
              Your NFT Gallery
            </h2>
          </div>
          <div className={styles.loadingContainer}>
            <Loader className={styles.loadingSpinner} size={48} />
            <p>Connecting to wallet...</p>
          </div>
        </div>
      </section>
    );
  }

  // Wallet not connected state
  if (!connected) {
    return (
      <section
        className={styles.trendingSection}
        aria-labelledby="mynft-gallery-heading-disconnected"
      >
        <div className={styles.container}>
          <div className={styles.header}>
            <h2
              id="mynft-gallery-heading-disconnected"
              className={styles.tabButton}
            >
              Your NFT Gallery
            </h2>
            <div className={styles.statsCounter}>
              <span className={styles.nftsCount}>0 NFTs</span>
              <span className={styles.totalValue}>0.00 SOL</span>
            </div>
          </div>
          <div className={styles.walletNotConnected}>
            <div className={styles.messageContainer}>
              <div className={styles.iconWrapper}>
                <Wallet
                  size={32}
                  className={styles.walletIcon}
                  aria-hidden="true"
                />
              </div>
              <h3 className={styles.title}>Your NFT Gallery</h3>
              <p className={styles.message}>
                Connect your wallet to view your NFT collection.
              </p>
              <div className={styles.previewGrid} aria-hidden="true">
                {[1, 2, 3].map((i) => (
                  <div key={`preview-${i}`} className={styles.previewCard}>
                    <div className={styles.previewImageContainer}>
                      <ImageIcon className={styles.placeholderIcon} size={32} />
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.connectButtonWrapper}>
                <ConnectWalletButton />
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Connected state with loading, error, or content
  return (
    <section
      className={styles.trendingSection}
      aria-labelledby="mynft-gallery-heading-connected"
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <h2
            id="mynft-gallery-heading-connected"
            className={`${styles.tabButton} ${styles.activeTab}`}
          >
            Your NFT Gallery
          </h2>
          <div className={styles.statsCounter}>
            <span
              className={styles.nftsCount}
              aria-label={`Total NFTs: ${nfts.length}`}
            >
              {nfts.length} NFTs
            </span>
            <span
              className={styles.totalValue}
              aria-label={`Total value: ${totalValue} SOL`}
            >
              {totalValue} SOL
            </span>
            {nfts.length > 0 && (
              <span
                className={styles.poolsCount}
                aria-label={`${nftsWithPoolCount} NFTs with associated pools`}
              >
                {nftsWithPoolCount} with pools
              </span>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div
            className={styles.loadingContainer}
            role="status"
            aria-live="polite"
          >
            <Loader className={styles.loadingSpinner} size={48} />
            <p>Loading your NFTs...</p>
          </div>
        ) : displayError ? (
          /* Error State */
          <div className={styles.errorContainer} role="alert">
            <AlertCircle
              size={48}
              className={styles.errorIcon}
              aria-hidden="true"
            />
            <p className={styles.errorMessage}>
              Error loading your NFTs:{" "}
              {displayError.message || "An unknown error occurred."}
            </p>
            <button className={styles.retryButton} onClick={handleRetry}>
              <RefreshCw size={16} className={styles.refreshIcon} />
              Retry
            </button>
          </div>
        ) : nfts.length === 0 ? (
          /* Empty State */
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>
              <ImageIcon size={48} aria-hidden="true" />
            </div>
            <p>You don&apos;t have any NFTs yet.</p>
            <p className={styles.emptyStateSubtext}>
              Explore collections and mint your first NFT!
            </p>
            <button
              className={styles.exploreButton}
              onClick={() => router.push("/mintstreet")}
            >
              Explore Collections{" "}
              <ArrowRight
                size={16}
                className={styles.arrowIcon}
                aria-hidden="true"
              />
            </button>
          </div>
        ) : (
          /* NFT Grid */
          <>
            <div className={styles.nftGrid}>
              {visibleNFTs.map((nft, index) => {
                const hasPool = !!nftToPoolMap[nft.mintAddress];
                const imageSrc = nft.image || VALID_NFT_IMAGES;

                return (
                  <div
                    key={nft.id || nft.mintAddress || `nft-${index}`}
                    className={`${styles.nftCard} ${
                      hasPool ? styles.hasPool : ""
                    }`}
                    onClick={() => handleNFTClick(nft)}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleNFTClick(nft);
                      }
                    }}
                    aria-label={`View details for NFT: ${nft.name}`}
                  >
                    <div className={styles.nftImageContainer}>
                      <Image
                        src={imageSrc}
                        alt={nft.name || "User NFT"}
                        fill
                        className={styles.nftImage}
                        onError={handleImageError}
                        sizes="(max-width: 480px) 150px, (max-width: 768px) 200px, 250px"
                        placeholder="blur"
                        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                      />
                      <div className={styles.priceTag}>
                        <Gem
                          size={14}
                          className={styles.gemIcon}
                          aria-hidden="true"
                        />
                        {nft.price}
                      </div>
                      {hasPool && <div className={styles.poolBadge}>Pool</div>}
                    </div>
                    <div className={styles.nftInfo}>
                      <h4 className={styles.nftName}>{nft.name}</h4>
                      <p className={styles.collectionName}>
                        {nft.collectionName}
                      </p>
                      <div
                        className={styles.viewDetailsButton}
                        aria-hidden="true"
                      >
                        {hasPool ? "View Collection" : "View Details"}
                        <ArrowRight size={14} className={styles.arrowIcon} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load More Button */}
            {hasMoreNfts && (
              <div className={styles.loadMoreContainer}>
                <button
                  className={styles.loadMoreButton}
                  onClick={handleLoadMore}
                  disabled={isLoading}
                >
                  Show More{" "}
                  <ChevronDown
                    size={16}
                    className={styles.chevronIcon}
                    aria-hidden="true"
                  />
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
