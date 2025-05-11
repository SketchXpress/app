"use client";

import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { useSellNft } from '@/hooks/useSellNFT';
import styles from './PoolNFTsGrid.module.scss';
import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import NFTRowSkeleton from './NFTRowSkeleton';
import NFTCardSkeleton from './NFTCardSkeleton';

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

interface NFTMetadata {
  image?: string;
  name?: string;
  symbol?: string;
  description?: string;
}

const SKELETON_COUNT = 5;

const PoolNFTsGrid: React.FC<PoolNFTsGridProps> = ({ nfts, isLoading, error, poolAddress }) => {
  const [sellingNftMint, setSellingNftMint] = useState<string | null>(null);
  const [nftMetadata, setNftMetadata] = useState<Record<string, NFTMetadata>>({});
  const [metadataLoading, setMetadataLoading] = useState<boolean>(true);

  const { sellNft, loading: isSelling, error: sellError, success: sellSuccess, isSold } = useSellNft();

  useEffect(() => {
    if (!nfts || nfts.length === 0) {
      setMetadataLoading(false);
      return;
    }
    setMetadataLoading(true);
    const fetchAllMetadata = async () => {
      const metadataPromises = nfts.map(async (nft) => {
        if (!nft.uri) {
          // If no URI, use existing NFT data for metadata (especially image and name)
          return {
            mintAddress: nft.mintAddress,
            metadata: {
              name: nft.name,
              image: nft.image,
              symbol: nft.symbol
            }
          };
        }

        try {
          let uri = nft.uri;
          if (uri.startsWith('ar://')) {
            uri = `https://arweave.net/${uri.substring(5)}`;
          } else if (!uri.startsWith('http')) {
            uri = `https://${uri.replace(/^\/\//, '')}`;
          }

          const response = await fetch(uri, { mode: 'cors' });
          if (!response.ok) throw new Error(`Failed to fetch metadata from ${uri}: ${response.status} ${response.statusText}`);

          const contentType = response.headers.get("content-type");

          if (contentType && (contentType.includes("application/json") || contentType.includes("text/plain"))) {
            // If content type is JSON or plain text (some arweave links are text/plain but contain JSON)
            const metadata = await response.json();
            return { mintAddress: nft.mintAddress, metadata };
          } else if (contentType && contentType.startsWith("image/")) {
            // If content type is an image, use the URI as the image directly
            return {
              mintAddress: nft.mintAddress,
              metadata: {
                image: uri, // Use the URI itself as the image URL
                name: nft.name, // Fallback to NFT's direct name/symbol
                symbol: nft.symbol
              }
            };
          } else {
            // If content type is ambiguous or not what we expect, try to parse as JSON, but catch errors
            try {
              const metadata = await response.json();
              return { mintAddress: nft.mintAddress, metadata };
            } catch (jsonParseError) {
              console.warn(`Could not parse JSON from ${uri} with content-type ${contentType}, attempting to use as image. Error: ${jsonParseError}`);
              // Fallback: assume it might be an image if JSON parsing fails or content type is weird
              return {
                mintAddress: nft.mintAddress,
                metadata: {
                  image: uri,
                  name: nft.name,
                  symbol: nft.symbol
                }
              };
            }
          }
        } catch (fetchError) {
          console.error(`Error fetching or processing metadata for ${nft.mintAddress} from ${nft.uri}:`, fetchError);
          return {
            mintAddress: nft.mintAddress,
            metadata: {
              name: nft.name,
              image: nft.image, // Fallback to direct image from NFT data if URI fetch fails
              symbol: nft.symbol
            }
          };
        }
      });

      const results = await Promise.allSettled(metadataPromises);
      const newMetadata: Record<string, NFTMetadata> = {};
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          newMetadata[result.value.mintAddress] = result.value.metadata;
        }
      });
      setNftMetadata(prev => ({ ...prev, ...newMetadata }));
      setMetadataLoading(false);
    };

    fetchAllMetadata();
  }, [nfts]);

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = '/defaultNFT.png';
    e.currentTarget.onerror = null;
  }, []);

  const formatTimestamp = useCallback((timestamp: number) => {
    if (!timestamp) return 'Unknown time';
    try {
      const date = new Date(timestamp * 1000);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (err) {
      console.error('Error formatting timestamp:', err);
      return 'Invalid date';
    }
  }, []);

  const getNftImageUrl = useCallback((nft: NFT): string => {
    const metadata = nftMetadata[nft.mintAddress];
    const imageUrl = metadata?.image || nft.image;

    if (imageUrl) {
      if (imageUrl.startsWith('ipfs://')) {
        return `https://ipfs.io/ipfs/${imageUrl.substring(7)}`;
      }
      if (imageUrl.startsWith('ar://')) {
        return `https://arweave.net/${imageUrl.substring(5)}`;
      }
      // Ensure it's a valid http/https URL or fallback
      return imageUrl.startsWith('http') ? imageUrl : '/defaultNFT.png';
    }
    return '/defaultNFT.png';
  }, [nftMetadata]);

  const handleSellNft = useCallback(async (nft: NFT) => {
    if (isSelling || isSold(nft.mintAddress)) return;
    setSellingNftMint(nft.mintAddress);
    try {
      await sellNft(nft.mintAddress, poolAddress);
    } catch (err) {
      console.error('Error handling NFT sale in component:', err);
    }
  }, [isSelling, isSold, poolAddress, sellNft]);

  const getSellButtonStatus = useCallback((nftMintAddress: string) => {
    if (isSold(nftMintAddress)) return { text: 'Sold', disabled: true, showSuccess: true };
    if (sellingNftMint === nftMintAddress) {
      if (isSelling) return { text: 'Selling...', disabled: true, showLoader: true };
      if (sellSuccess && isSold(nftMintAddress)) return { text: 'Sold', disabled: true, showSuccess: true };
      if (sellError) return { text: 'Retry Sell', disabled: false, showError: true };
    }
    return { text: 'Sell', disabled: false };
  }, [isSold, sellingNftMint, isSelling, sellSuccess, sellError]);

  const showSkeletons = isLoading || (nfts.length > 0 && metadataLoading);

  if (showSkeletons) {
    return (
      <div className={styles.container}>
        <h2 className={`${styles.title} ${styles.skeletonTitle}`}><div className={`${styles.skeleton} ${styles.skeletonTextMedium}`}></div></h2>
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
              {Array.from({ length: SKELETON_COUNT }).map((_, index) => <NFTRowSkeleton key={`row-skeleton-${index}`} />)}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => <NFTCardSkeleton key={`card-skeleton-${index}`} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer} role="alert">
        <AlertCircle size={24} className={styles.errorIcon} />
        <p>Error loading NFTs: {error}</p>
      </div>
    );
  }

  if (!nfts || nfts.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <p>No NFTs found in this pool.</p>
      </div>
    );
  }

  return (
    <div className={styles.container} aria-live="polite" aria-busy={isSelling}>
      <h2 className={styles.title}>Pool NFTs</h2>
      {sellError && sellingNftMint && (
        <div className={`${styles.errorMessage} ${styles.sellErrorMessage}`} role="alert">
          <AlertCircle size={16} />
          <span>Failed to sell NFT ({nftMetadata[sellingNftMint]?.name || sellingNftMint.slice(0, 6)}): {sellError}. Please try again.</span>
        </div>
      )}
      <div className={styles.tableContainer}>
        <table className={styles.table} aria-label="NFTs in Pool - Desktop View">
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
              const nftName = nftMetadata[nft.mintAddress]?.name || nft.name || "Unnamed NFT";
              const nftSymbol = nftMetadata[nft.mintAddress]?.symbol || nft.symbol || "N/S";
              return (
                <tr key={nft.mintAddress}>
                  <td className={styles.indexCell}>{index + 1}</td>
                  <td className={styles.imageCell}>
                    <div className={styles.imageWrapper}>
                      <Image
                        src={getNftImageUrl(nft)}
                        alt={`Image of ${nftName}`}
                        width={40}
                        height={40}
                        className={styles.nftImage}
                        onError={handleImageError}
                        placeholder="blur"
                        blurDataURL="/defaultNFT.png"
                      />
                    </div>
                  </td>
                  <td className={styles.nameCell} title={nftName}>{nftName}</td>
                  <td className={styles.symbolCell} title={nftSymbol}>{nftSymbol}</td>
                  <td className={styles.priceCell}>{nft.price ? `${nft.price.toFixed(4)} SOL` : "N/A"}</td>
                  <td className={styles.timeCell}>{formatTimestamp(nft.timestamp)}</td>
                  <td className={styles.actionsCell}>
                    <button className={`${styles.actionButton} ${styles.buyButton}`} disabled aria-label={`Buy ${nftName} (disabled)`}>
                      Buy
                    </button>
                    <button
                      className={`${styles.actionButton} ${styles.sellButton} ${buttonStatus.disabled ? styles.disabledButton : ''} ${buttonStatus.showSuccess ? styles.soldButton : ''}`}
                      onClick={() => handleSellNft(nft)}
                      disabled={buttonStatus.disabled || isSelling}
                      aria-label={buttonStatus.showSuccess ? `${nftName} Sold` : `Sell ${nftName}`}
                    >
                      {buttonStatus.showLoader && <Loader2 size={14} className={styles.spinnerIcon} aria-hidden="true" />}
                      {buttonStatus.showSuccess && <CheckCircle size={14} className={styles.checkIcon} aria-hidden="true" />}
                      {buttonStatus.text}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.cardsContainer} aria-label="NFTs in Pool - Mobile View">
        {nfts.map((nft, index) => {
          const buttonStatus = getSellButtonStatus(nft.mintAddress);
          const nftName = nftMetadata[nft.mintAddress]?.name || nft.name || "Unnamed NFT";
          const nftSymbol = nftMetadata[nft.mintAddress]?.symbol || nft.symbol || "N/S";
          return (
            <div key={nft.mintAddress} className={styles.card} role="listitem">
              <div className={styles.cardHeader}>
                <div className={styles.cardImageWrapper}>
                  <Image
                    src={getNftImageUrl(nft)}
                    alt={`Image of ${nftName}`}
                    width={60}
                    height={60}
                    className={styles.cardImage}
                    onError={handleImageError}
                    placeholder="blur"
                    blurDataURL="/defaultNFT.png"
                  />
                </div>
                <div className={styles.cardInfo}>
                  <div className={styles.cardIndex}>#{index + 1}</div>
                  <h3 className={styles.cardName} title={nftName}>{nftName}</h3>
                  <div className={styles.cardSymbol} title={nftSymbol}>{nftSymbol}</div>
                </div>
              </div>
              <div className={styles.cardDetails}>
                <div className={styles.cardDetail}>
                  <span className={styles.detailLabel}>Price:</span>
                  <span className={styles.detailValue}>{nft.price ? `${nft.price.toFixed(4)} SOL` : "N/A"}</span>
                </div>
                <div className={styles.cardDetail}>
                  <span className={styles.detailLabel}>Time:</span>
                  <span className={styles.detailValue}>{formatTimestamp(nft.timestamp)}</span>
                </div>
              </div>
              <div className={styles.cardActions}>
                <button className={`${styles.actionButton} ${styles.buyButton}`} disabled aria-label={`Buy ${nftName} (disabled)`}>
                  Buy
                </button>
                <button
                  className={`${styles.actionButton} ${styles.sellButton} ${buttonStatus.disabled ? styles.disabledButton : ''} ${buttonStatus.showSuccess ? styles.soldButton : ''}`}
                  onClick={() => handleSellNft(nft)}
                  disabled={buttonStatus.disabled || isSelling}
                  aria-label={buttonStatus.showSuccess ? `${nftName} Sold` : `Sell ${nftName}`}
                >
                  {buttonStatus.showLoader && <Loader2 size={14} className={styles.spinnerIcon} aria-hidden="true" />}
                  {buttonStatus.showSuccess && <CheckCircle size={14} className={styles.checkIcon} aria-hidden="true" />}
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

export default React.memo(PoolNFTsGrid);

