"use client";

import React from 'react';
import Image from 'next/image';
import styles from './PoolNFTsGrid.module.scss';
import { formatDistanceToNow } from 'date-fns';

interface NFT {
  mintAddress: string;
  name: string;
  symbol: string;
  uri?: string;
  timestamp: number;
  signature: string;
  price: number;
  image?: string;
}

interface PoolNFTsGridProps {
  nfts: NFT[];
  isLoading: boolean;
  error: string | null;
}

const PoolNFTsGrid: React.FC<PoolNFTsGridProps> = ({ nfts, isLoading, error }) => {
  // Handle image loading errors
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = '/defaultNFT.png';
  };

  // Format timestamp to relative time
  const formatTimestamp = (timestamp: number) => {
    try {
      // Convert seconds to milliseconds for date-fns
      const date = new Date(timestamp * 1000);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Unknown time';
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading NFTs...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p>Error loading NFTs: {error}</p>
      </div>
    );
  }

  // Empty state
  if (!nfts || nfts.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <p>No NFTs found in this pool.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Pool NFTs</h2>

      {/* Desktop Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>S.No.</th>
              <th>Image</th>
              <th>Name</th>
              <th>Symbol</th>
              <th>Mint Price</th>
              <th>Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {nfts.map((nft, index) => (
              <tr key={nft.mintAddress}>
                <td className={styles.indexCell}>{index + 1}</td>
                <td className={styles.imageCell}>
                  <div className={styles.imageWrapper}>
                    <Image
                      src={nft.image || '/defaultNFT.png'}
                      alt={nft.name}
                      width={40}
                      height={40}
                      className={styles.nftImage}
                      onError={handleImageError}
                    />
                  </div>
                </td>
                <td className={styles.nameCell}>{nft.name}</td>
                <td className={styles.symbolCell}>{nft.symbol}</td>
                <td className={styles.priceCell}>{nft.price} SOL</td>
                <td className={styles.timeCell}>{formatTimestamp(nft.timestamp)}</td>
                <td className={styles.actionsCell}>
                  <button className={`${styles.actionButton} ${styles.buyButton}`} disabled>
                    Buy
                  </button>
                  <button className={`${styles.actionButton} ${styles.sellButton}`}>
                    Sell
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className={styles.cardsContainer}>
        {nfts.map((nft, index) => (
          <div key={nft.mintAddress} className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardImageWrapper}>
                <Image
                  src={nft.image || '/defaultNFT.png'}
                  alt={nft.name}
                  width={60}
                  height={60}
                  className={styles.cardImage}
                  onError={handleImageError}
                />
              </div>
              <div className={styles.cardInfo}>
                <div className={styles.cardIndex}>#{index + 1}</div>
                <h3 className={styles.cardName}>{nft.name}</h3>
                <div className={styles.cardSymbol}>{nft.symbol}</div>
              </div>
            </div>

            <div className={styles.cardDetails}>
              <div className={styles.cardDetail}>
                <span className={styles.detailLabel}>Price:</span>
                <span className={styles.detailValue}>{nft.price} SOL</span>
              </div>
              <div className={styles.cardDetail}>
                <span className={styles.detailLabel}>Time:</span>
                <span className={styles.detailValue}>{formatTimestamp(nft.timestamp)}</span>
              </div>
            </div>

            <div className={styles.cardActions}>
              <button className={`${styles.actionButton} ${styles.buyButton}`} disabled>
                Buy
              </button>
              <button className={`${styles.actionButton} ${styles.sellButton}`}>
                Sell
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PoolNFTsGrid;