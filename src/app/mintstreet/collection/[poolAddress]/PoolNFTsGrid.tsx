"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import styles from './PoolNFTsGrid.module.scss';
import { formatDistanceToNow } from 'date-fns';
import { useSellNft } from '@/hooks/useSellNFT';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

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
  poolAddress: string;
}

// Interface for NFT metadata
interface NFTMetadata {
  image?: string;
  name?: string;
  symbol?: string;
  description?: string;
  // Add other fields as needed
}

const PoolNFTsGrid: React.FC<PoolNFTsGridProps> = ({ nfts, isLoading, error, poolAddress }) => {
  // State for tracking the NFT being sold
  const [sellingNftMint, setSellingNftMint] = useState<string | null>(null);

  // State for NFT metadata (including images)
  const [nftMetadata, setNftMetadata] = useState<Record<string, NFTMetadata>>({});

  // Use our sell NFT hook
  const { sellNft, loading: isSelling, error: sellError, success: sellSuccess, isSold } = useSellNft();

  // Fetch NFT metadata from URIs
  useEffect(() => {
    const fetchNFTMetadata = async () => {
      const metadataPromises = nfts
        .filter(nft => nft.uri && !nftMetadata[nft.mintAddress])
        .map(async (nft) => {
          if (!nft.uri) return null;

          try {
            // Ensure URI is properly formatted with https
            let uri = nft.uri;
            if (!uri.startsWith('http')) {
              uri = `https://${uri.replace('://', '')}`;
            }

            const response = await fetch(uri);
            if (!response.ok) throw new Error(`Failed to fetch metadata: ${response.status}`);

            const metadata = await response.json();
            return { mintAddress: nft.mintAddress, metadata };
          } catch (error) {
            console.error(`Error fetching metadata for ${nft.mintAddress}:`, error);
            return null;
          }
        });

      const results = await Promise.all(metadataPromises);

      // Update metadata state with new results
      const newMetadata = { ...nftMetadata };
      results.forEach(result => {
        if (result) {
          newMetadata[result.mintAddress] = result.metadata;
        }
      });

      setNftMetadata(newMetadata);
    };

    fetchNFTMetadata();
  }, [nfts]);

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

  // Get the image URL for an NFT
  const getNftImageUrl = (nft: NFT) => {
    // First try the metadata image
    if (nftMetadata[nft.mintAddress]?.image) {
      let imageUrl = nftMetadata[nft.mintAddress].image || '';

      // Handle IPFS URLs
      if (imageUrl.startsWith('ipfs://')) {
        imageUrl = `https://ipfs.io/ipfs/${imageUrl.slice(7)}`;
      }

      return imageUrl;
    }

    // Then try the image directly from NFT data
    if (nft.image) {
      return nft.image;
    }

    // Fallback to default image
    return '/defaultNFT.png';
  };

  // Handle NFT sell button click
  const handleSellNft = async (nft: NFT) => {
    if (isSelling || isSold(nft.mintAddress)) return;

    // Set the NFT being sold
    setSellingNftMint(nft.mintAddress);

    try {
      // Call the sellNft function from our hook
      const result = await sellNft(nft.mintAddress, poolAddress);

      if (result && result.success) {
        console.log('NFT sold successfully!', result.signature);
      }
    } catch (error) {
      console.error('Error handling NFT sale:', error);
    }
  };

  // Get button status
  const getSellButtonStatus = (nftMintAddress: string) => {
    if (isSold(nftMintAddress)) {
      return { text: 'Sold', disabled: true, showSuccess: true };
    }

    if (sellingNftMint === nftMintAddress) {
      if (isSelling) return { text: 'Selling...', disabled: true, showLoader: true };
      if (sellSuccess) return { text: 'Sold', disabled: true, showSuccess: true };
      if (sellError) return { text: 'Failed', disabled: false, showError: true };
    }

    return { text: 'Sell', disabled: false };
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

      {/* Error message if sell fails */}
      {sellError && (
        <div className={`${styles.errorMessage}`}>
          <AlertCircle size={16} />
          <span>{sellError}</span>
        </div>
      )}

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
            {nfts.map((nft, index) => {
              const buttonStatus = getSellButtonStatus(nft.mintAddress);

              return (
                <tr key={nft.mintAddress}>
                  <td className={styles.indexCell}>{index + 1}</td>
                  <td className={styles.imageCell}>
                    <div className={styles.imageWrapper}>
                      <Image
                        src={getNftImageUrl(nft)}
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
                    <button
                      className={`${styles.actionButton} ${styles.sellButton} ${isSold(nft.mintAddress) ? styles.soldButton : ''}`}
                      onClick={() => handleSellNft(nft)}
                      disabled={buttonStatus.disabled}
                    >
                      {buttonStatus.showLoader && (
                        <span className={styles.buttonLoader}>
                          <Loader2 size={12} className={styles.spinnerIcon} />
                        </span>
                      )}
                      {buttonStatus.showSuccess && (
                        <span className={styles.buttonSuccess}>
                          <CheckCircle size={12} className={styles.checkIcon} />
                        </span>
                      )}
                      {buttonStatus.text}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className={styles.cardsContainer}>
        {nfts.map((nft, index) => {
          const buttonStatus = getSellButtonStatus(nft.mintAddress);

          return (
            <div key={nft.mintAddress} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardImageWrapper}>
                  <Image
                    src={getNftImageUrl(nft)}
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
                <button
                  className={`${styles.actionButton} ${styles.sellButton} ${isSold(nft.mintAddress) ? styles.soldButton : ''}`}
                  onClick={() => handleSellNft(nft)}
                  disabled={buttonStatus.disabled}
                >
                  {buttonStatus.showLoader && (
                    <span className={styles.buttonLoader}>
                      <Loader2 size={12} className={styles.spinnerIcon} />
                    </span>
                  )}
                  {buttonStatus.showSuccess && (
                    <span className={styles.buttonSuccess}>
                      <CheckCircle size={12} className={styles.checkIcon} />
                    </span>
                  )}
                  {buttonStatus.text}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PoolNFTsGrid;