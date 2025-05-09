"use client";

import Image from 'next/image';
import { NFT } from '@/types/nft';
import styles from './MyNFT.module.scss';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletNFTs } from '@/hooks/queries/useWalletNFTs';
import ConnectWalletButton from "@/wallet/ConnectWalletButton";
import { useTransactionHistory } from '@/hooks/queries/useTransactionHistory';
import { ArrowRight, Wallet, Image as ImageIcon, Gem, ChevronDown } from 'lucide-react';

// Available NFT images that are confirmed to exist in the public folder
const VALID_NFT_IMAGES = [
  "/defaultNFT.png",
  "/nft1.jpeg",
  "/nft3.jpg",
  "/nft4.jpg",
  "/nft5.png",
  "/nft6.webp",
  "/demoCar.png",
  "/demoHouse.png",
  "/demoRobot.webp"
];

const MyNFT = () => {
  const router = useRouter();
  const { connected } = useWallet();
  const [hasMore, setHasMore] = useState(false);
  const [activeTab, setActiveTab] = useState('nfts');
  const [visibleCount, setVisibleCount] = useState(5);

  // Use a more conservative fetch limit to avoid rate limiting
  const { data: history = [], isLoading: historyLoading } = useTransactionHistory(100);
  const { data: nfts = [], isLoading: nftsLoading, error: nftsError } = useWalletNFTs();

  // Create a mapping of NFT mint addresses to pool addresses
  const [nftToPoolMap, setNftToPoolMap] = useState<Record<string, string>>({});
  const [nftsWithPoolCount, setNftsWithPoolCount] = useState(0);

  // Process history data to find which NFTs correspond to which pools - with memoization
  useEffect(() => {
    if (!historyLoading && history && history.length > 0 && nfts && nfts.length > 0) {
      const map: Record<string, string> = {};

      // Process history to find mint addresses and their corresponding pool addresses
      history.forEach(tx => {
        if (tx.instructionName === "mintNft" && tx.accounts && tx.accounts.length > 1 && tx.poolAddress) {
          // For mint transactions, the NFT mint address is typically the second account (index 1)
          const mintAddress = tx.accounts[1]?.toString();

          if (mintAddress) {
            map[mintAddress] = tx.poolAddress;
          }
        }
      });

      // Only update state and trigger re-render if the mapping has changed
      const count = nfts.filter(nft => map[nft.mintAddress]).length;

      // Update state in one batch to reduce renders
      setNftToPoolMap(map);
      setNftsWithPoolCount(count);
    }
  }, [history, historyLoading, nfts]);

  // Check if there are more NFTs to load - memoized
  useEffect(() => {
    if (nfts.length > visibleCount) {
      setHasMore(true);
    } else {
      setHasMore(false);
    }
  }, [nfts.length, visibleCount]);

  // Handle loading more NFTs
  const handleLoadMore = useCallback(() => {
    setVisibleCount(prevCount => prevCount + 5);
  }, []);

  // Get visible NFTs based on current count - memoized
  const visibleNFTs = useMemo(() => {
    return nfts.slice(0, visibleCount);
  }, [nfts, visibleCount]);

  // Handle clicking on an NFT to go to mintstreet/collection page
  const handleNFTClick = useCallback((nft: NFT) => {
    const poolAddress = nftToPoolMap[nft.mintAddress];

    if (poolAddress) {
      // Navigate to the pool's collection page
      router.push(`/mintstreet/collection/${poolAddress}`);
    } else {
      // If no pool address is found, navigate to a default page
      router.push(`/mintstreet`);
    }
  }, [nftToPoolMap, router]);

  // Improved fallback image function to handle image loading errors
  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.currentTarget as HTMLImageElement;

    // Always use a fallback image that is confirmed to exist
    target.src = '/defaultNFT.png';

    // Prevent further error callbacks
    target.onerror = null;
  }, []);

  // Calculate total value of NFTs - memoized
  const totalValue = useMemo(() => {
    return nfts.reduce((acc: number, nft: NFT) => {
      const price = parseFloat(nft.price.split(' ')[0]);
      return acc + (isNaN(price) ? 0 : price);
    }, 0).toFixed(2);
  }, [nfts]);

  // Render different states based on wallet connection
  if (!connected) {
    return (
      <section className={styles.trendingSection}>
        <div className={styles.container}>
          <div className={styles.header}>
            <div className={styles.tabs}>
              <button className={styles.tabButton}>
                Your NFT Gallery
              </button>
            </div>
            <div className={styles.statsCounter}>
              <span className={styles.nftsCount}>0 NFTs</span>
              <span className={styles.totalValue}>0.00 SOL</span>
            </div>
          </div>

          <div className={styles.walletNotConnected}>
            <div className={styles.messageContainer}>
              <div className={styles.iconWrapper}>
                <Wallet size={32} className={styles.walletIcon} />
              </div>
              <h3 className={styles.title}>Your NFT Gallery</h3>
              <p className={styles.message}>
                Connect your wallet to view your NFT collection
              </p>
              <div className={styles.previewGrid}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className={styles.previewCard}>
                    <div className={styles.previewImageContainer}>
                      <ImageIcon className={styles.placeholderIcon} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Use the ConnectWalletButton */}
              <div className="header">
                <ConnectWalletButton />
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.trendingSection}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tabButton} ${activeTab === 'nfts' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('nfts')}
            >
              Your NFT Gallery
            </button>
          </div>
          <div className={styles.statsCounter}>
            <span className={styles.nftsCount}>{nfts.length} NFTs</span>
            <span className={styles.totalValue}>
              {totalValue} SOL
            </span>
            {nfts.length > 0 && (
              <span className={styles.poolsCount}>
                {nftsWithPoolCount} with pools
              </span>
            )}
          </div>
        </div>

        {nftsLoading || historyLoading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading your NFTs...</p>
          </div>
        ) : nftsError ? (
          <div className={styles.errorContainer}>
            <p className={styles.errorMessage}>{nftsError.message}</p>
            <button
              className={styles.retryButton}
              onClick={() => {
                // Refresh page to retry
                window.location.reload();
              }}
            >
              Retry
            </button>
          </div>
        ) : nfts.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>
              <ImageIcon size={48} />
            </div>
            <p>You don&apos;t have any NFTs yet</p>
            <p className={styles.emptyStateSubtext}>Explore collections and mint your first NFT!</p>
            <button
              className={styles.exploreButton}
              onClick={() => router.push('/mintstreet')}
            >
              Explore Collections
              <ArrowRight size={16} className={styles.arrowIcon} />
            </button>
          </div>
        ) : (
          <>
            <div className={styles.nftGrid}>
              {visibleNFTs.map((nft: NFT) => {
                const hasPool = !!nftToPoolMap[nft.mintAddress];
                // Ensure the image URL is valid
                const validImage = nft.image && (
                  nft.image.startsWith('http') ||
                  nft.image.startsWith('/') ||
                  nft.image.startsWith('data:')
                ) ? nft.image : VALID_NFT_IMAGES[0];

                return (
                  <div
                    key={nft.id}
                    className={`${styles.nftCard} ${hasPool ? styles.hasPool : ''}`}
                    onClick={() => handleNFTClick(nft)}
                  >
                    <div className={styles.nftImageContainer}>
                      <Image
                        src={validImage}
                        alt={nft.name}
                        width={200}
                        height={200}
                        className={styles.nftImage}
                        onError={handleImageError}
                      />
                      <div className={styles.priceTag}>
                        <Gem size={14} className={styles.gemIcon} />
                        {nft.price}
                      </div>
                      {hasPool && (
                        <div className={styles.poolBadge}>
                          Pool
                        </div>
                      )}
                    </div>
                    <div className={styles.nftInfo}>
                      <h4 className={styles.nftName}>{nft.name}</h4>
                      <p className={styles.collectionName}>
                        {nft.collectionName}
                      </p>
                      <div className={styles.viewDetailsButton}>
                        {hasPool ? 'View Collection' : 'View Details'}
                        <ArrowRight size={14} className={styles.arrowIcon} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Show More Button */}
            {hasMore && (
              <div className={styles.loadMoreContainer}>
                <button
                  className={styles.loadMoreButton}
                  onClick={handleLoadMore}
                >
                  Show More
                  <ChevronDown size={16} className={styles.chevronIcon} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default MyNFT;