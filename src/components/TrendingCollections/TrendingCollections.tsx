import React, { useState } from 'react';
import Image from 'next/image';
import { CheckCircle } from 'lucide-react';
import { collections } from './data';
import styles from './TrendingCollections.module.scss';

const TrendingCollections = () => {
  const [activeTab, setActiveTab] = useState('trending');

  // Split collections for two columns
  const leftCollections = collections.slice(0, 4);
  const rightCollections = collections.slice(4, 8);

  return (
    <section className={styles.trendingSection}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tabButton} ${activeTab === 'trending' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('trending')}
            >
              Trending
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'top' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('top')}
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
                <div key={collection.id} className={styles.collectionRow}>
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
                  <div className={styles.priceCell}>{collection.poolPrice}</div>
                </div>
              ))}
            </div>

            {/* Right Column Content */}
            <div className={styles.columnContent}>
              {rightCollections.map((collection) => (
                <div key={collection.id} className={styles.collectionRow}>
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
                  <div className={styles.priceCell}>{collection.poolPrice}</div>
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
              <div key={collection.id} className={styles.collectionRow}>
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
                <div className={styles.priceCell}>{collection.poolPrice}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrendingCollections;