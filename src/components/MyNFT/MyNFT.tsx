/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  ArrowRight,
  Wallet,
  Image as ImageIcon,
  Gem,
  ChevronDown,
  AlertCircle,
  Loader,
  RefreshCw,
  Zap,
  Clock,
} from "lucide-react";

import { NFT } from "@/types/nft";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletNFTs } from "@/hooks/queries/useWalletNFTs";
import ConnectWalletButton from "@/wallet/ConnectWalletButton";
import { useUserNFTPoolMapping } from "@/hook/pools/useUserNFTPoolMapping";

import styles from "./MyNFT.module.scss";

// Fallback images
const DEFAULT_NFT_IMAGES = [
  "/assets/images/defaultNFT.png",
  "/assets/images/nft1.jpeg",
];

const BASE64_PLACEHOLDER =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUwIiBoZWlnaHQ9IjI1MCIgdmlld0JveD0iMCAwIDI1MCAyNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI1MCIgaGVpZ2h0PSIyNTAiIGZpbGw9IiNGNUY1RjUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0cHgiPk5GVDwvdGV4dD48L3N2Zz4=";

const LOAD_MORE_COUNT = 4;
const INITIAL_VISIBLE_COUNT = 8;

// Metadata interface
interface NFTMetadata {
  image?: string;
  name?: string;
  symbol?: string;
  description?: string;
}

// Metadata fetching functions
const fetchMetadataForNft = async (nft: NFT) => {
  if (!nft.uri) {
    return {
      mintAddress: nft.mintAddress,
      metadata: { name: nft.name, image: nft.image },
    };
  }

  try {
    // Direct fetch from the URI (like your Pinata links)
    const response = await fetch(nft.uri);

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const metadata = await response.json();

    return { mintAddress: nft.mintAddress, metadata };
  } catch (fetchError) {
    console.error(
      `Error fetching metadata for ${nft.mintAddress}:`,
      fetchError
    );
    return {
      mintAddress: nft.mintAddress,
      metadata: { name: nft.name, image: nft.image },
    };
  }
};

const fetchMetadataBatch = async (nfts: NFT[]) => {
  const nftsWithUris = nfts.filter((nft) => nft.uri);

  if (nftsWithUris.length === 0) {
    return nfts.map((nft) => ({
      mintAddress: nft.mintAddress,
      metadata: { name: nft.name, image: nft.image },
    }));
  }

  // Fetch all metadata concurrently
  const results = await Promise.allSettled(
    nftsWithUris.map(fetchMetadataForNft)
  );

  // Combine successful results with fallbacks for failed ones
  const successfulResults = results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    } else {
      const nft = nftsWithUris[index];
      console.error(`Failed to fetch metadata for ${nft.name}:`, result.reason);
      return {
        mintAddress: nft.mintAddress,
        metadata: { name: nft.name, image: nft.image },
      };
    }
  });

  // Include NFTs without URIs
  const nftsWithoutUris = nfts.filter((nft) => !nft.uri);
  const fallbackResults = nftsWithoutUris.map((nft) => ({
    mintAddress: nft.mintAddress,
    metadata: { name: nft.name, image: nft.image },
  }));

  return [...successfulResults, ...fallbackResults];
};

const useImageFallback = () => {
  const [, setFailedUrls] = useState<Set<string>>(new Set());

  const handleImageError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>, nft: NFT) => {
      const target = e.currentTarget as HTMLImageElement;
      const currentSrc = target.src;

      setFailedUrls((prev) => new Set(prev).add(currentSrc));

      if (nft.image && currentSrc === nft.image && DEFAULT_NFT_IMAGES[0]) {
        target.src = DEFAULT_NFT_IMAGES[0];
      } else if (
        currentSrc === DEFAULT_NFT_IMAGES[0] &&
        DEFAULT_NFT_IMAGES[1]
      ) {
        target.src = DEFAULT_NFT_IMAGES[1];
      } else if (currentSrc !== BASE64_PLACEHOLDER) {
        target.src = BASE64_PLACEHOLDER;
      }

      target.onerror = null;
    },
    []
  );

  return { handleImageError };
};

// Image URL helper function
const getNftImageUrl = (nft: NFT, metadata?: NFTMetadata): string => {
  // Priority 1: Use metadata image (from json_uri fetch)
  const metadataImage = metadata?.image;
  if (metadataImage) {
    // Handle IPFS and Arweave URLs
    if (metadataImage.startsWith("ipfs://")) {
      return `https://ipfs.io/ipfs/${metadataImage.substring(7)}`;
    }
    if (metadataImage.startsWith("ar://")) {
      return `https://arweave.net/${metadataImage.substring(5)}`;
    }
    if (metadataImage.startsWith("http")) {
      return metadataImage;
    }
  }

  // Priority 2: Use original NFT image (from Helius)
  if (nft.image && nft.image !== "/assets/images/nft1.jpeg") {
    return nft.image;
  }

  // Fallback
  return "/assets/images/defaultNFT.png";
};

const MyNFT: React.FC = () => {
  const router = useRouter();
  const { connected, connecting } = useWallet();
  const { handleImageError } = useImageFallback();

  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [sortOption, setSortOption] = useState<
    "poolsFirst" | "newest" | "alphabetical"
  >("poolsFirst");

  // Add metadata state
  const [nftMetadata, setNftMetadata] = useState<Record<string, NFTMetadata>>(
    {}
  );
  const [metadataLoading, setMetadataLoading] = useState<boolean>(false);

  // Main data hooks
  const {
    data: nfts = [],
    isLoading: nftsLoading,
    error: nftsError,
    refetch: refetchNfts,
  } = useWalletNFTs();

  // Pool mapping hook
  const {
    poolMappings,
    isEnhancing,
    error: mappingsError,
    stats,
    refresh: refreshMappings,
  } = useUserNFTPoolMapping(nfts);

  // Metadata fetching effect
  useEffect(() => {
    if (!nfts || nfts.length === 0) {
      setMetadataLoading(false);
      return;
    }

    // Only fetch metadata for NFTs that have URIs and we haven't fetched yet
    const nftsNeedingMetadata = nfts.filter(
      (nft) => nft.uri && !nftMetadata[nft.mintAddress]
    );

    if (nftsNeedingMetadata.length === 0) {
      setMetadataLoading(false);
      return;
    }

    setMetadataLoading(true);

    const fetchAllMetadata = async () => {
      try {
        const results = await fetchMetadataBatch(nftsNeedingMetadata);

        const newMetadata: Record<string, NFTMetadata> = {};
        results.forEach((result) => {
          if (result && result.mintAddress) {
            newMetadata[result.mintAddress] = result.metadata;
          }
        });

        setNftMetadata((prev) => ({ ...prev, ...newMetadata }));
      } catch (error) {
        console.error("Error fetching metadata batch:", error);
      } finally {
        setMetadataLoading(false);
      }
    };

    fetchAllMetadata();
  }, [nfts]); // Removed nftMetadata dependency to prevent infinite loops

  // Convert poolMappings to legacy format
  const nftToPoolMap = useMemo(() => {
    const legacyMap: Record<
      string,
      { address: string; name?: string; timestamp?: number }
    > = {};

    Object.entries(poolMappings).forEach(([mintAddress, mapping]) => {
      legacyMap[mintAddress] = {
        address: mapping.poolAddress,
        name: mapping.poolName,
        timestamp: mapping.timestamp,
      };
    });

    return legacyMap;
  }, [poolMappings]);

  // Sorting strategies
  const sortingStrategies = useMemo(
    () => ({
      poolsFirst: (nfts: NFT[]) =>
        [...nfts].sort((a, b) => {
          const hasPoolA = !!nftToPoolMap[a.mintAddress];
          const hasPoolB = !!nftToPoolMap[b.mintAddress];

          if (hasPoolA && !hasPoolB) return -1;
          if (!hasPoolA && hasPoolB) return 1;

          if (hasPoolA && hasPoolB) {
            const timestampA = nftToPoolMap[a.mintAddress].timestamp || 0;
            const timestampB = nftToPoolMap[b.mintAddress].timestamp || 0;
            return timestampB - timestampA;
          }

          const nameA = a.name || "";
          const nameB = b.name || "";
          return nameA.localeCompare(nameB);
        }),

      newest: (nfts: NFT[]) =>
        [...nfts].sort((a, b) => {
          const timestampA =
            nftToPoolMap[a.mintAddress]?.timestamp || a.timestamp || 0;
          const timestampB =
            nftToPoolMap[b.mintAddress]?.timestamp || b.timestamp || 0;
          return timestampB - timestampA;
        }),

      alphabetical: (nfts: NFT[]) =>
        [...nfts].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    }),
    [nftToPoolMap]
  );

  const sortedNFTs = useMemo(() => {
    if (!nfts.length) return [];
    return sortingStrategies[sortOption](nfts);
  }, [nfts, sortOption, sortingStrategies]);

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      nfts.forEach((nft) => {
        if (nft.image?.startsWith("blob:")) {
          URL.revokeObjectURL(nft.image);
        }
      });
    };
  }, [nfts]);

  const visibleNFTs = useMemo(
    () => sortedNFTs.slice(0, visibleCount),
    [sortedNFTs, visibleCount]
  );

  const hasMoreNfts = useMemo(
    () => sortedNFTs.length > visibleCount,
    [sortedNFTs, visibleCount]
  );

  // Enhanced stats
  const nftStats = useMemo(() => {
    const withPools = sortedNFTs.filter(
      (nft) => !!nftToPoolMap[nft.mintAddress]
    );
    const withoutPools = sortedNFTs.filter(
      (nft) => !nftToPoolMap[nft.mintAddress]
    );
    const visibleWithPools = visibleNFTs.filter(
      (nft) => !!nftToPoolMap[nft.mintAddress]
    );

    return {
      total: sortedNFTs.length,
      withPools: withPools.length,
      withoutPools: withoutPools.length,
      poolsShownFirst: visibleWithPools.length,
      poolsPercentage:
        sortedNFTs.length > 0
          ? Math.round((withPools.length / sortedNFTs.length) * 100)
          : 0,
      mappingProgress:
        stats.totalNFTs > 0
          ? Math.round((stats.mappedNFTs / stats.totalNFTs) * 100)
          : 0,
      cacheMisses: stats.cacheMisses,
      apiCalls: stats.apiCalls,
    };
  }, [sortedNFTs, nftToPoolMap, visibleNFTs, stats]);

  const totalValue = useMemo(() => {
    return sortedNFTs
      .reduce((acc: number, nft: NFT) => {
        const priceMatch = nft.price?.match(/(\d+\.?\d*)/);
        const price = priceMatch ? parseFloat(priceMatch[0]) : 0;
        return acc + (isNaN(price) ? 0 : price);
      }, 0)
      .toFixed(2);
  }, [sortedNFTs]);

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prevCount) => prevCount + LOAD_MORE_COUNT);
  }, []);

  const handleNFTClick = useCallback(
    (nft: NFT) => {
      const poolInfo = nftToPoolMap[nft.mintAddress];
      if (poolInfo) {
        router.push(`/mintstreet/collection/${poolInfo.address}`);
      } else {
        router.push(`/mintstreet`);
      }
    },
    [nftToPoolMap, router]
  );

  // Loading states
  const isLoading = nftsLoading;
  const displayError = nftsError || mappingsError;

  const handleRetry = useCallback(async () => {
    if (nftsError) await refetchNfts();
    if (mappingsError) await refreshMappings();
  }, [nftsError, mappingsError, refetchNfts, refreshMappings]);

  // Progress indicator
  const ProgressIndicator: React.FC = () => {
    if (!isEnhancing || stats.totalNFTs === 0) return null;

    return (
      <div className={styles.progressIndicator}>
        <div className={styles.progressContent}>
          <Zap size={16} className={styles.enhancingIcon} />
          <span className={styles.progressText}>
            Discovering pool associations... {stats.mappedNFTs}/
            {stats.totalNFTs} NFTs
          </span>
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${nftStats.mappingProgress}%` }}
          />
        </div>
      </div>
    );
  };

  const SortDropdown: React.FC = () => (
    <div className={styles.sortDropdown}>
      <select
        value={sortOption}
        onChange={(e) => setSortOption(e.target.value as any)}
        className={styles.sortSelect}
        aria-label="Sort NFTs by"
      >
        <option value="poolsFirst">🏆 Pool NFTs First</option>
        <option value="newest">🕒 Newest First</option>
        <option value="alphabetical">🔤 A-Z</option>
      </select>
    </div>
  );

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
                Connect your wallet to view your NFT collection with pool NFTs
                prioritized.
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
              <div className={`${styles.connectButtonWrapper} header`}>
                <ConnectWalletButton />
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

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
          <div className={styles.headerControls}>
            <SortDropdown />
            <div className={styles.statsCounter}>
              <span
                className={styles.nftsCount}
                aria-label={`Total NFTs: ${nftStats.total}`}
              >
                {nftStats.total} NFTs
              </span>
              <span
                className={styles.totalValue}
                aria-label={`Total value: ${totalValue} SOL`}
              >
                {totalValue} SOL
              </span>
              {nftStats.total > 0 && (
                <span
                  className={styles.poolsCount}
                  aria-label={`${nftStats.withPools} NFTs with associated pools`}
                >
                  {nftStats.withPools} with pools ({nftStats.poolsPercentage}%)
                </span>
              )}
            </div>
          </div>
        </div>

        <ProgressIndicator />

        {metadataLoading && (
          <div className={styles.metadataLoadingIndicator}>
            <Loader size={16} className={styles.metadataSpinner} />
            <span>Loading NFT images...</span>
          </div>
        )}

        {nftStats.withPools > 0 && sortOption === "poolsFirst" && (
          <div className={styles.sortingIndicator}>
            <span className={styles.sortingText}>
              📌 Pool NFTs shown first ({nftStats.poolsShownFirst} visible of{" "}
              {nftStats.withPools} total)
            </span>
            {isEnhancing && (
              <span className={styles.enhancingText}>
                <Clock size={14} /> Discovering more...
              </span>
            )}
          </div>
        )}

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
          <div className={styles.errorContainer} role="alert">
            <AlertCircle
              size={48}
              className={styles.errorIcon}
              aria-hidden="true"
            />
            <p className={styles.errorMessage}>
              Error loading your NFTs: {"An unknown error occurred."}
            </p>
            <button className={styles.retryButton} onClick={handleRetry}>
              <RefreshCw size={16} className={styles.refreshIcon} />
              Retry
            </button>
          </div>
        ) : sortedNFTs.length === 0 ? (
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
          <>
            <div className={styles.nftGrid}>
              {visibleNFTs.map((nft, index) => {
                const poolInfo = nftToPoolMap[nft.mintAddress];
                const hasPool = !!poolInfo;
                const isTopPoolNFT =
                  hasPool && index < 3 && sortOption === "poolsFirst";

                // Use the enhanced image URL function
                const metadata = nftMetadata[nft.mintAddress];
                const imageSrc = getNftImageUrl(nft, metadata);
                const nftName = metadata?.name || nft.name;

                const isEnhancingThis = isEnhancing && !hasPool;

                return (
                  <div
                    key={nft.id || nft.mintAddress || `nft-${index}`}
                    className={`${styles.nftCard} ${
                      hasPool ? styles.hasPool : ""
                    } ${isTopPoolNFT ? styles.priorityNFT : ""} ${
                      isEnhancingThis ? styles.enhancing : ""
                    }`}
                    onClick={() => handleNFTClick(nft)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleNFTClick(nft);
                      }
                    }}
                    aria-label={`View details for NFT: ${nftName}${
                      hasPool ? " (Pool NFT)" : ""
                    }`}
                  >
                    <div className={styles.nftImageContainer}>
                      <Image
                        src={imageSrc}
                        alt={nftName || "User NFT"}
                        fill
                        className={styles.nftImage}
                        onError={(e) => handleImageError(e, nft)}
                        sizes="(max-width: 480px) 150px, (max-width: 768px) 200px, 250px"
                        placeholder="blur"
                        blurDataURL={BASE64_PLACEHOLDER}
                        priority={index < 4}
                      />
                      <div className={styles.priceTag}>
                        <Gem
                          size={14}
                          className={styles.gemIcon}
                          aria-hidden="true"
                        />
                      </div>

                      {hasPool ? (
                        <div className={styles.poolBadge}>
                          {poolInfo.name || "Pool Collection"}
                        </div>
                      ) : isEnhancingThis ? (
                        <div className={styles.enhancingBadge}>
                          <div className={styles.enhancingSpinner} />
                          Analyzing...
                        </div>
                      ) : null}

                      {isTopPoolNFT && (
                        <div className={styles.priorityBadge}>⭐ Featured</div>
                      )}
                    </div>
                    <div className={styles.nftInfo}>
                      <h4 className={styles.nftName}>{nftName}</h4>
                      <p className={styles.collectionName}>
                        {nft.collectionName}
                      </p>
                      <div
                        className={styles.viewDetailsButton}
                        aria-hidden="true"
                      >
                        {hasPool
                          ? "View Collection"
                          : isEnhancingThis
                          ? "Analyzing..."
                          : "View Details"}
                        <ArrowRight size={14} className={styles.arrowIcon} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMoreNfts && (
              <div className={styles.loadMoreContainer}>
                <button
                  className={styles.loadMoreButton}
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  aria-label={`Load ${LOAD_MORE_COUNT} more NFTs. Currently showing ${visibleCount} of ${sortedNFTs.length}`}
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
