"use client";

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './MyNFT.module.scss';
import { ArrowRight, Wallet, Image as ImageIcon, Gem, ChevronDown } from 'lucide-react';
import ConnectWalletButton from "@/wallet/ConnectWalletButton";
import { useWalletNFTs, NFT } from '@/hooks/useWalletNFT';
import { useBondingCurveHistory } from '@/hooks/useBondingCurveHistory';

const MyNFT = () => {
  const { connected } = useWallet();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('nfts');

  // State for pagination
  const [visibleCount, setVisibleCount] = useState(5);
  const [hasMore, setHasMore] = useState(false);

  // Use our hooks
  const { nfts, loading, error } = useWalletNFTs();

  // Get bonding curve history to find pool addresses
  const { history, isLoading: historyLoading } = useBondingCurveHistory(200);

  // Create a mapping of NFT mint addresses to pool addresses
  const [nftToPoolMap, setNftToPoolMap] = useState<Record<string, string>>({});
  const [nftsWithPoolCount, setNftsWithPoolCount] = useState(0);

  // Process history data to find which NFTs correspond to which pools
  useEffect(() => {
    if (!historyLoading && history && history.length > 0) {
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

      console.log("NFT to Pool mapping:", map);
      setNftToPoolMap(map);

      // Count NFTs with pools if we have the NFT data
      if (nfts && nfts.length > 0) {
        const count = nfts.filter(nft => map[nft.mintAddress]).length;
        setNftsWithPoolCount(count);
      }
    }
  }, [history, historyLoading, nfts, loading]);

  // Check if there are more NFTs to load
  useEffect(() => {
    if (nfts.length > visibleCount) {
      setHasMore(true);
    } else {
      setHasMore(false);
    }
  }, [nfts, visibleCount]);

  // Handle loading more NFTs
  const handleLoadMore = () => {
    setVisibleCount(prevCount => prevCount + 5);
  };

  // Get visible NFTs based on current count
  const visibleNFTs = nfts.slice(0, visibleCount);

  // Handle clicking on an NFT to go to mintstreet/collection page
  const handleNFTClick = (nft: NFT) => {
    const poolAddress = nftToPoolMap[nft.mintAddress];

    if (poolAddress) {
      // Navigate to the pool's collection page
      router.push(`/mintstreet/collection/${poolAddress}`);
    } else {
      // If no pool address is found, navigate to a default page
      console.warn(`No pool address found for NFT: ${nft.mintAddress}`);
      router.push(`/mintstreet`);
    }
  };

  // Fallback image function to handle image loading errors
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    target.src = '/nft1.jpeg'; // Default fallback image
  };

  // Calculate total value of NFTs
  const calculateTotalValue = () => {
    return nfts.reduce((acc: number, nft: NFT) => {
      const price = parseFloat(nft.price.split(' ')[0]);
      return acc + (isNaN(price) ? 0 : price);
    }, 0).toFixed(2);
  };

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
              {calculateTotalValue()} SOL
            </span>
            {nfts.length > 0 && (
              <span className={styles.poolsCount}>
                {nftsWithPoolCount} with pools
              </span>
            )}
          </div>
        </div>

        {loading || historyLoading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading your NFTs...</p>
          </div>
        ) : error ? (
          <div className={styles.errorContainer}>
            <p className={styles.errorMessage}>{error}</p>
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
            <button className={styles.exploreButton}>
              Explore Collections
              <ArrowRight size={16} className={styles.arrowIcon} />
            </button>
          </div>
        ) : (
          <>
            <div className={styles.nftGrid}>
              {visibleNFTs.map((nft: NFT) => {
                const hasPool = !!nftToPoolMap[nft.mintAddress];
                return (
                  <div
                    key={nft.id}
                    className={`${styles.nftCard} ${hasPool ? styles.hasPool : ''}`}
                    onClick={() => handleNFTClick(nft)}
                  >
                    <div className={styles.nftImageContainer}>
                      <Image
                        src={nft.image}
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