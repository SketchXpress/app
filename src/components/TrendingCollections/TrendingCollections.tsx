"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { CheckCircle, Loader2 } from 'lucide-react';
import styles from './TrendingCollections.module.scss';
import { useBondingCurveHistory, HistoryItem } from '@/hooks/useBondingCurveHistory';
import { usePoolPrices } from '@/hooks/usePoolPrices';
import { useAnchorContext } from '@/contexts/AnchorContextProvider';
import { useRouter } from 'next/navigation';

// Define a type for our collection data
interface DynamicCollection {
  id: string;
  rank: number;
  name: string;
  image: string;
  verified: boolean;
  nftCount?: number;
  totalVolume: number;
}

// Helper to organize transactions by pool and extract collection names
const processTrendingCollections = (transactions: HistoryItem[]) => {
  // Group transactions by pool address
  const poolMap = new Map<string, {
    poolAddress: string,
    transactions: number,
    timestamp: number,
    totalVolume: number,
    name: string,
    nftCount: number,
    collectionFound: boolean
  }>();

  // First, build a dynamic collection map
  // We need to track:
  // 1. Collection creation transactions (createCollectionNft) to get collection names and addresses
  // 2. Pool creation transactions (createPool) to link pools to collections

  // Step 1: Find all collection creation transactions
  const collectionCreations = new Map<string, { name: string, symbol: string }>();

  transactions.forEach(tx => {
    if (tx.instructionName === "createCollectionNft" && tx.args) {
      const name = tx.args.name as string;
      const symbol = tx.args.symbol as string;

      // Get the collection mint address from the accounts
      if (tx.accounts && tx.accounts.length > 1) {
        const collectionMintAddress = tx.accounts[1].toString(); // Collection mint is typically the second account
        collectionCreations.set(collectionMintAddress, { name, symbol });
      }
    }
  });

  // Step 2: Find all pool creation transactions and link them to collections
  const poolToCollectionMap = new Map<string, string>();

  transactions.forEach(tx => {
    if (tx.instructionName === "createPool" && tx.accounts && tx.accounts.length > 1) {
      const poolAddress = tx.poolAddress;
      const collectionMintAddress = tx.accounts[1].toString(); // Collection mint is typically the second account

      if (poolAddress && collectionCreations.has(collectionMintAddress)) {
        const collection = collectionCreations.get(collectionMintAddress);
        if (collection) {
          poolToCollectionMap.set(poolAddress, collection.name);
        }
      }
    }
  });

  // Now process all transactions to build the pool data
  transactions.forEach(tx => {
    if (!tx.poolAddress) return; // Skip if no pool address

    // Get or create pool entry
    if (!poolMap.has(tx.poolAddress)) {
      // Try to find collection name from our dynamic map
      const collectionName = poolToCollectionMap.get(tx.poolAddress);

      poolMap.set(tx.poolAddress, {
        poolAddress: tx.poolAddress,
        transactions: 0,
        timestamp: 0,
        totalVolume: 0,
        name: collectionName || `Collection ${tx.poolAddress.substring(0, 6)}`,
        nftCount: 0,
        collectionFound: !!collectionName
      });
    }

    const pool = poolMap.get(tx.poolAddress)!;

    // Update pool stats
    pool.transactions += 1;

    // Update timestamp if more recent
    if (tx.blockTime && tx.blockTime > pool.timestamp) {
      pool.timestamp = tx.blockTime;
    }

    // Update volume if available
    if (tx.price) {
      pool.totalVolume += tx.price;
    }

    // Count NFTs minted for this collection
    if (tx.instructionName === "mintNft") {
      pool.nftCount += 1;
    }
  });

  return Array.from(poolMap.values());
};

const TrendingCollections: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('trending');
  const [collections, setCollections] = useState<DynamicCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [poolAddresses, setPoolAddresses] = useState<string[]>([]);

  // Get wallet and Anchor context
  const { program } = useAnchorContext();
  const { prices, loading: pricesLoading } = usePoolPrices(poolAddresses);

  // Check wallet and program state
  const isProgramInitialized = !!program;

  // Use the hook to get history data
  const {
    history,
    isLoading: historyLoading,
    error: historyError
  } = useBondingCurveHistory(50);

  // Get a random NFT image from the available images
  const getRandomNftImage = () => {
    // List of available NFT images
    const nftImages = [
      '/nft1.jpeg',
      '/nft2.avif',
      '/nft3.jpg',
      '/nft4.jpg',
      '/nft5.png',
      '/nft6.webp'
    ];

    // Select a random image from the array
    const randomIndex = Math.floor(Math.random() * nftImages.length);
    return nftImages[randomIndex];
  };

  // Process history data when it's available
  useEffect(() => {
    if (!historyLoading) {
      try {
        if (historyError) {
          setError(historyError);
          setIsLoading(false);
          return;
        }

        // Set collections to empty array if no history
        if (!history || history.length === 0) {
          setCollections([]);
          setIsLoading(false);
          return;
        }

        // Process collections from history
        const poolData = processTrendingCollections(history);

        // Sort based on active tab
        let sortedPools = [...poolData];
        if (activeTab === 'trending') {
          // Sort by most recent activity
          sortedPools.sort((a, b) => b.timestamp - a.timestamp);
        } else {
          // Sort by volume
          sortedPools.sort((a, b) => b.totalVolume - a.totalVolume);
        }

        // Take top 8
        sortedPools = sortedPools.slice(0, 8);

        // Format for display - using random NFT images
        const formattedCollections: DynamicCollection[] = sortedPools.map((pool, index) => ({
          id: pool.poolAddress,
          rank: index + 1,
          name: pool.name,
          image: getRandomNftImage(), // Assign a random NFT image
          verified: true,
          nftCount: pool.nftCount,
          totalVolume: pool.totalVolume
        }));

        setPoolAddresses(formattedCollections.map(collection => collection.id));
        setCollections(formattedCollections);
        setIsLoading(false);
      } catch (err) {
        console.error("Error processing collections:", err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setIsLoading(false);
      }
    }
  }, [history, historyLoading, historyError, activeTab]);

  // Handle tab change
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  // Handle collection click - Navigate to collection page
  const handleCollectionClick = (poolAddress: string) => {
    router.push(`/mintstreet/collection/${poolAddress}`);
  };

  // Split collections for two columns
  const leftCollections = collections.slice(0, 4);
  const rightCollections = collections.slice(4, 8);

  // Handle image error
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    target.src = '/defaultNFT.png'; // Use defaultNFT.png as fallback
  };

  // Improved function to display pool price with fallbacks
  const renderPoolPrice = (collection: DynamicCollection) => {
    // If program is initialized and prices are loaded, use the price
    if (isProgramInitialized && !pricesLoading && prices[collection.id]) {
      return <div className={styles.priceCell}>{prices[collection.id]}</div>;
    }

    // Fallback: Show total volume as the price instead
    // We display total volume from transaction history when we can't get real-time pool price
    return <div className={styles.priceCell}>{collection.totalVolume.toFixed(4)} SOL</div>;
  };

  // Render loading state
  if (isLoading) {
    return (
      <section className={styles.trendingSection}>
        <div className={styles.container}>
          <div className={styles.header}>
            <div className={styles.tabs}>
              <button
                className={`${styles.tabButton} ${activeTab === 'trending' ? styles.activeTab : ''}`}
                onClick={() => handleTabChange('trending')}
              >
                Trending
              </button>
              <button
                className={`${styles.tabButton} ${activeTab === 'top' ? styles.activeTab : ''}`}
                onClick={() => handleTabChange('top')}
              >
                Top
              </button>
            </div>
            <button className={styles.viewAllButton}>View all</button>
          </div>
          <div className={styles.loadingContainer}>
            <Loader2 size={32} className={styles.loadingSpinner} />
            <p>Loading collections...</p>
          </div>
        </div>
      </section>
    );
  }

  // Render empty state if no collections
  if (collections.length === 0) {
    return (
      <section className={styles.trendingSection}>
        <div className={styles.container}>
          <div className={styles.header}>
            <div className={styles.tabs}>
              <button
                className={`${styles.tabButton} ${activeTab === 'trending' ? styles.activeTab : ''}`}
                onClick={() => handleTabChange('trending')}
              >
                Trending
              </button>
              <button
                className={`${styles.tabButton} ${activeTab === 'top' ? styles.activeTab : ''}`}
                onClick={() => handleTabChange('top')}
              >
                Top
              </button>
            </div>
            <button className={styles.viewAllButton}>View all</button>
          </div>
          <div className={styles.emptyContainer}>
            <p>No collections found. Be the first to create a collection!</p>
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
              className={`${styles.tabButton} ${activeTab === 'trending' ? styles.activeTab : ''}`}
              onClick={() => handleTabChange('trending')}
            >
              Trending
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'top' ? styles.activeTab : ''}`}
              onClick={() => handleTabChange('top')}
            >
              Top
            </button>
          </div>

          <button className={styles.viewAllButton}>View all</button>
        </div>

        {/* Desktop View */}
        <div className={styles.tableContainer}>
          <div className={styles.tableLayout}>
            {/* Left Column Header */}
            <div className={styles.columnHeader}>
              <div className={styles.rankHeader}>RANK</div>
              <div className={styles.collectionHeader}>COLLECTION</div>
              <div className={styles.priceHeader}>POOL PRICE</div>
            </div>

            {/* Right Column Header */}
            <div className={styles.columnHeader}>
              <div className={styles.rankHeader}>RANK</div>
              <div className={styles.collectionHeader}>COLLECTION</div>
              <div className={styles.priceHeader}>POOL PRICE</div>
            </div>

            {/* Left Column Content */}
            <div className={styles.columnContent}>
              {leftCollections.map((collection) => (
                <div
                  key={collection.id}
                  className={styles.collectionRow}
                  onClick={() => handleCollectionClick(collection.id)}
                >
                  <div className={styles.rankCell}>{collection.rank}</div>
                  <div className={styles.collectionCell}>
                    <div className={styles.collectionInfo}>
                      <div className={styles.imageContainer}>
                        <Image
                          src={collection.image}
                          alt={collection.name}
                          width={40}
                          height={40}
                          className={styles.collectionImage}
                          onError={handleImageError}
                        />
                      </div>
                      <div className={styles.collectionName}>
                        {collection.name}
                        {collection.verified && (
                          <CheckCircle size={14} className={styles.verifiedIcon} />
                        )}
                      </div>
                    </div>
                  </div>
                  {renderPoolPrice(collection)}
                </div>
              ))}
            </div>

            {/* Right Column Content */}
            <div className={styles.columnContent}>
              {rightCollections.map((collection) => (
                <div
                  key={collection.id}
                  className={styles.collectionRow}
                  onClick={() => handleCollectionClick(collection.id)}
                >
                  <div className={styles.rankCell}>{collection.rank}</div>
                  <div className={styles.collectionCell}>
                    <div className={styles.collectionInfo}>
                      <div className={styles.imageContainer}>
                        <Image
                          src={collection.image}
                          alt={collection.name}
                          width={40}
                          height={40}
                          className={styles.collectionImage}
                          onError={handleImageError}
                        />
                      </div>
                      <div className={styles.collectionName}>
                        {collection.name}
                        {collection.verified && (
                          <CheckCircle size={14} className={styles.verifiedIcon} />
                        )}
                      </div>
                    </div>
                  </div>
                  {renderPoolPrice(collection)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile View */}
        <div className={styles.mobileContainer}>
          <div className={styles.mobileHeader}>
            <div className={styles.rankHeader}>RANK</div>
            <div className={styles.collectionHeader}>COLLECTION</div>
            <div className={styles.priceHeader}>POOL PRICE</div>
          </div>

          <div className={styles.mobileContent}>
            {collections.map((collection) => (
              <div
                key={collection.id}
                className={styles.collectionRow}
                onClick={() => handleCollectionClick(collection.id)}
              >
                <div className={styles.rankCell}>{collection.rank}</div>
                <div className={styles.collectionCell}>
                  <div className={styles.collectionInfo}>
                    <div className={styles.imageContainer}>
                      <Image
                        src={collection.image}
                        alt={collection.name}
                        width={32}
                        height={32}
                        className={styles.collectionImage}
                        onError={handleImageError}
                      />
                    </div>
                    <div className={styles.collectionName}>
                      {collection.name}
                      {collection.verified && (
                        <CheckCircle size={12} className={styles.verifiedIcon} />
                      )}
                    </div>
                  </div>
                </div>
                {renderPoolPrice(collection)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrendingCollections;