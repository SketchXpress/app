"use client";

import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { useSellNft } from '@/hooks/useSellNFT';
import styles from './PoolNFTsGrid.module.scss';
import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import NFTRowSkeleton from './NFTRowSkeleton';
import NFTCardSkeleton from './NFTCardSkeleton';
import { getAssociatedTokenAddress, getAccount, getMint } from '@solana/spl-token';
import { useAnchorContext } from '@/contexts/AnchorContextProvider';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useBuyNft } from '@/hooks/useBuyNft';

interface NFT {
  mintAddress: string;
  name: string;
  symbol: string;
  uri?: string;
  timestamp: number;
  signature: string;
  price: number;
  image?: string;
  owner?: string;
}

interface PoolNFTsGridProps {
  nfts: NFT[];
  isLoading: boolean;
  error: string | null;
  poolAddress: string;
  onRefresh?: () => void;
}

interface NFTMetadata {
  image?: string;
  name?: string;
  symbol?: string;
  description?: string;
}

// Ownership status for each NFT
type OwnershipStatus = 'pool' | 'user' | 'other' | 'burned';

const SKELETON_COUNT = 5;

const PoolNFTsGrid: React.FC<PoolNFTsGridProps> = ({
  nfts,
  isLoading,
  error,
  poolAddress,
  onRefresh
}) => {
  const [sellingNftMint, setSellingNftMint] = useState<string | null>(null);
  const [buyingNftMint, setBuyingNftMint] = useState<string | null>(null);
  const [nftMetadata, setNftMetadata] = useState<Record<string, NFTMetadata>>({});
  const [metadataLoading, setMetadataLoading] = useState<boolean>(true);
  const [nftOwnership, setNftOwnership] = useState<Record<string, OwnershipStatus>>({});
  const [ownershipLoading, setOwnershipLoading] = useState<boolean>(true);

  const { program } = useAnchorContext();
  const wallet = useWallet();
  const { sellNft, loading: isSelling, error: sellError, success: sellSuccess, isSold } = useSellNft();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { buyFromPool, buyFromUser, loading: isBuying, error: buyError } = useBuyNft();

  // Check NFT ownership
  useEffect(() => {
    const checkNftOwnership = async () => {
      if (!program || !nfts || nfts.length === 0) {
        setOwnershipLoading(false);
        return;
      }

      setOwnershipLoading(true);
      console.log('Checking ownership for NFTs:', nfts.map(n => n.mintAddress));

      const ownershipMap: Record<string, OwnershipStatus> = {};

      try {
        await Promise.all(
          nfts.map(async (nft) => {
            try {
              const mintPubkey = new PublicKey(nft.mintAddress);

              // First check if mint exists
              let mintExists = true;
              let mintInfo;
              try {
                mintInfo = await getMint(program.provider.connection, mintPubkey);
                console.log(`Mint ${nft.mintAddress} exists, supply: ${mintInfo.supply}`);

                // If supply is 0, it was burned
                if (mintInfo.supply === BigInt(0)) {
                  console.log(`NFT ${nft.mintAddress} was burned (supply = 0)`);
                  ownershipMap[nft.mintAddress] = 'burned';
                  return;
                }
              } catch {
                console.log(`Mint ${nft.mintAddress} doesn't exist - marked as burned`);
                mintExists = false;
                ownershipMap[nft.mintAddress] = 'burned';
                return;
              }

              if (!mintExists) return;

              // Find NFT escrow PDA (pool's address)
              const [escrow] = PublicKey.findProgramAddressSync(
                [Buffer.from("nft-escrow"), mintPubkey.toBuffer()],
                program.programId
              );

              console.log(`Checking NFT ${nft.mintAddress}, escrow: ${escrow.toString()}`);

              // Check pool's token account
              const escrowTokenAccount = await getAssociatedTokenAddress(
                mintPubkey,
                escrow,
                true // Allow PDA
              );

              // Check user's token account (if wallet is connected)
              let userOwns = false;
              if (wallet.publicKey) {
                try {
                  const userTokenAccount = await getAssociatedTokenAddress(
                    mintPubkey,
                    wallet.publicKey
                  );

                  const userAccount = await getAccount(
                    program.provider.connection,
                    userTokenAccount
                  );

                  userOwns = userAccount.amount === BigInt(1);
                  console.log(`User owns NFT ${nft.mintAddress}: ${userOwns}`);
                } catch {
                  // User doesn't have a token account for this NFT
                  userOwns = false;
                }
              }

              // Check pool's ownership
              let poolOwns = false;
              try {
                const escrowAccount = await getAccount(
                  program.provider.connection,
                  escrowTokenAccount
                );

                poolOwns = escrowAccount.amount === BigInt(1);
                console.log(`Pool owns NFT ${nft.mintAddress}: ${poolOwns}`);
              } catch {
                // Pool doesn't own the NFT
                poolOwns = false;
              }

              // Determine ownership status
              if (userOwns) {
                ownershipMap[nft.mintAddress] = 'user';
              } else if (poolOwns) {
                ownershipMap[nft.mintAddress] = 'pool';
              } else {
                // Someone else owns it
                ownershipMap[nft.mintAddress] = 'other';
              }

              console.log(`Final ownership for ${nft.mintAddress}: ${ownershipMap[nft.mintAddress]}`);
            } catch (err) {
              console.error(`Error checking ownership for ${nft.mintAddress}:`, err);
              ownershipMap[nft.mintAddress] = 'other';
            }
          })
        );

        console.log('Final ownership map:', ownershipMap);
        setNftOwnership(ownershipMap);
      } catch (err) {
        console.error('Error checking NFT ownership:', err);
      } finally {
        setOwnershipLoading(false);
      }
    };

    checkNftOwnership();
  }, [nfts, program, wallet.publicKey]);

  // Fetch metadata
  useEffect(() => {
    if (!nfts || nfts.length === 0) {
      setMetadataLoading(false);
      return;
    }

    setMetadataLoading(true);
    const fetchAllMetadata = async () => {
      const metadataPromises = nfts.map(async (nft) => {
        if (!nft.uri) {
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
          if (!response.ok) throw new Error(`Failed to fetch metadata`);

          const contentType = response.headers.get("content-type");

          if (contentType && (contentType.includes("application/json") || contentType.includes("text/plain"))) {
            const metadata = await response.json();
            return { mintAddress: nft.mintAddress, metadata };
          } else if (contentType && contentType.startsWith("image/")) {
            return {
              mintAddress: nft.mintAddress,
              metadata: {
                image: uri,
                name: nft.name,
                symbol: nft.symbol
              }
            };
          } else {
            try {
              const metadata = await response.json();
              return { mintAddress: nft.mintAddress, metadata };
            } catch {
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
          console.error(`Error fetching metadata for ${nft.mintAddress}:`, fetchError);
          return {
            mintAddress: nft.mintAddress,
            metadata: {
              name: nft.name,
              image: nft.image,
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
      return imageUrl.startsWith('http') ? imageUrl : '/defaultNFT.png';
    }
    return '/defaultNFT.png';
  }, [nftMetadata]);

  const handleSellNft = useCallback(async (nft: NFT) => {
    if (isSelling || isSold(nft.mintAddress) || nftOwnership[nft.mintAddress] !== 'user') return;

    setSellingNftMint(nft.mintAddress);
    try {
      const result = await sellNft(nft.mintAddress, poolAddress);
      if (result.success) {
        // Update ownership state immediately to show as burned
        setNftOwnership(prev => ({ ...prev, [nft.mintAddress]: 'burned' }));
        // Call refresh if provided to update the NFT list
        if (onRefresh) {
          setTimeout(onRefresh, 2000); // Delay refresh to allow blockchain to update
        }
      }
    } catch (err) {
      console.error('Error handling NFT sale in component:', err);
    }
  }, [isSelling, isSold, poolAddress, sellNft, nftOwnership, onRefresh]);

  const handleBuyNft = useCallback(async (nft: NFT) => {
    const ownership = nftOwnership[nft.mintAddress];

    if (isBuying || ownership === 'burned' || ownership === 'user') return;

    setBuyingNftMint(nft.mintAddress);

    if (ownership === 'pool') {
      // Buy from pool - this creates a new NFT
      console.log('Buying NFT from pool:', nft.mintAddress);
      alert('Buying from pool creates a new NFT. This functionality is coming soon!');
      setBuyingNftMint(null);
      return;

      // TODO: This should call a mint function, not buy an existing NFT
      // try {
      //   const result = await buyFromPool(nft.mintAddress, poolAddress);
      //   if (result.success) {
      //     setNftOwnership(prev => ({ ...prev, [nft.mintAddress]: 'user' }));
      //     if (onRefresh) {
      //       setTimeout(onRefresh, 2000);
      //     }
      //   }
      // } catch (err) {
      //   console.error('Error buying NFT from pool:', err);
      // }
    } else if (ownership === 'other') {
      // Buy from another user - secondary sale
      console.log('Buying NFT from another user:', nft.mintAddress);
      alert('Secondary market functionality coming soon!');
      setBuyingNftMint(null);
      return;
    }

    setBuyingNftMint(null);
  }, [nftOwnership, isBuying]);

  const getStatusBadge = useCallback((ownership: OwnershipStatus) => {
    switch (ownership) {
      case 'user':
        return { text: 'Yours', className: styles.yoursStatus };
      case 'pool':
        return { text: 'Available', className: styles.availableStatus };
      case 'burned':
        return { text: 'Burned', className: styles.burnedStatus };
      case 'other':
        return { text: 'Others', className: styles.secondaryStatus };
      default:
        return { text: 'Unknown', className: styles.unknownStatus };
    }
  }, []);

  const getActionButtons = useCallback((nft: NFT) => {
    const ownership = nftOwnership[nft.mintAddress];
    const nftName = nftMetadata[nft.mintAddress]?.name || nft.name || "Unnamed NFT";
    const isCurrentlyBuying = buyingNftMint === nft.mintAddress && isBuying;

    if (!ownership) {
      return (
        <>
          <button className={`${styles.actionButton} ${styles.buyButton}`} disabled>
            Loading...
          </button>
          <button className={`${styles.actionButton} ${styles.sellButton}`} disabled>
            Loading...
          </button>
        </>
      );
    }

    // NFT is burned - both buttons disabled
    if (ownership === 'burned') {
      return (
        <>
          <button className={`${styles.actionButton} ${styles.buyButton}`} disabled>
            Buy
          </button>
          <button className={`${styles.actionButton} ${styles.sellButton}`} disabled>
            Sell
          </button>
        </>
      );
    }

    // User owns this NFT - can sell it
    if (ownership === 'user') {
      const buttonStatus = getSellButtonStatus(nft.mintAddress);
      return (
        <>
          <button className={`${styles.actionButton} ${styles.buyButton}`} disabled>
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
        </>
      );
    }

    // Pool owns this NFT or someone else owns it - can buy
    if (ownership === 'pool' || ownership === 'other') {
      return (
        <>
          <button
            className={`${styles.actionButton} ${styles.buyButton} ${isCurrentlyBuying ? styles.buyingButton : ''}`}
            onClick={() => handleBuyNft(nft)}
            disabled={isBuying}
            aria-label={`Buy ${nftName}`}
          >
            {isCurrentlyBuying && <Loader2 size={14} className={styles.spinnerIcon} aria-hidden="true" />}
            {isCurrentlyBuying ? 'Buying...' : 'Buy'}
          </button>
          <button className={`${styles.actionButton} ${styles.sellButton}`} disabled>
            Sell
          </button>
        </>
      );
    }

    // Default case
    return (
      <>
        <button className={`${styles.actionButton} ${styles.buyButton}`} disabled>
          Buy
        </button>
        <button className={`${styles.actionButton} ${styles.sellButton}`} disabled>
          Sell
        </button>
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nftOwnership, nftMetadata, isSelling, isBuying, buyingNftMint, handleSellNft, handleBuyNft]);

  const getSellButtonStatus = useCallback((nftMintAddress: string) => {
    // Only for NFTs owned by the user
    if (nftOwnership[nftMintAddress] !== 'user') {
      return { text: 'Sell', disabled: true };
    }

    if (isSold(nftMintAddress)) return { text: 'Sold', disabled: true, showSuccess: true };

    if (sellingNftMint === nftMintAddress) {
      if (isSelling) return { text: 'Selling...', disabled: true, showLoader: true };
      if (sellSuccess && isSold(nftMintAddress)) return { text: 'Sold', disabled: true, showSuccess: true };
      if (sellError) return { text: 'Retry Sell', disabled: false, showError: true };
    }

    return { text: 'Sell', disabled: false };
  }, [isSold, sellingNftMint, isSelling, sellSuccess, sellError, nftOwnership]);

  const showSkeletons = isLoading || (nfts.length > 0 && (metadataLoading || ownershipLoading));

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
                <th>Status</th>
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
        {onRefresh && (
          <button onClick={onRefresh} className={styles.refreshButton}>
            Try Again
          </button>
        )}
      </div>
    );
  }

  if (!nfts || nfts.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <p>No NFTs found in this pool.</p>
        {onRefresh && (
          <button onClick={onRefresh} className={styles.refreshButton}>
            Refresh
          </button>
        )}
      </div>
    );
  }

  if (!wallet.publicKey) {
    return (
      <div className={styles.container}>
        <div className={styles.titleContainer}>
          <h2 className={styles.title}>Pool NFTs</h2>
          {onRefresh && (
            <button onClick={onRefresh} className={styles.refreshButton} disabled={showSkeletons}>
              Refresh
            </button>
          )}
        </div>
        <div className={styles.walletNotConnected}>
          <AlertCircle size={24} />
          <p>Please connect your wallet to interact with NFTs</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} aria-live="polite" aria-busy={isSelling}>
      <div className={styles.titleContainer}>
        <h2 className={styles.title}>Pool NFTs</h2>
        {onRefresh && (
          <button onClick={onRefresh} className={styles.refreshButton} disabled={showSkeletons}>
            Refresh
          </button>
        )}
      </div>

      {sellError && sellingNftMint && (
        <div className={`${styles.errorMessage} ${styles.sellErrorMessage}`} role="alert">
          <AlertCircle size={16} />
          <span>Failed to sell NFT ({nftMetadata[sellingNftMint]?.name || sellingNftMint.slice(0, 6)}): {sellError}. Please try again.</span>
        </div>
      )}

      {buyError && buyingNftMint && (
        <div className={`${styles.errorMessage} ${styles.buyErrorMessage}`} role="alert">
          <AlertCircle size={16} />
          <span>Failed to buy NFT ({nftMetadata[buyingNftMint]?.name || buyingNftMint.slice(0, 6)}): {buyError}. Please try again.</span>
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
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {nfts.map((nft, index) => {
              const nftName = nftMetadata[nft.mintAddress]?.name || nft.name || "Unnamed NFT";
              const nftSymbol = nftMetadata[nft.mintAddress]?.symbol || nft.symbol || "N/S";
              const ownership = nftOwnership[nft.mintAddress] || 'other';
              const statusBadge = getStatusBadge(ownership);

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
                  <td className={styles.statusCell}>
                    <span className={`${styles.statusBadge} ${statusBadge.className}`}>
                      {statusBadge.text}
                    </span>
                  </td>
                  <td className={styles.actionsCell}>
                    {getActionButtons(nft)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.cardsContainer} aria-label="NFTs in Pool - Mobile View">
        {nfts.map((nft, index) => {
          const nftName = nftMetadata[nft.mintAddress]?.name || nft.name || "Unnamed NFT";
          const nftSymbol = nftMetadata[nft.mintAddress]?.symbol || nft.symbol || "N/S";
          const ownership = nftOwnership[nft.mintAddress] || 'other';
          const statusBadge = getStatusBadge(ownership);

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
                  <span className={`${styles.statusBadge} ${statusBadge.className}`}>
                    {statusBadge.text}
                  </span>
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
                {getActionButtons(nft)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(PoolNFTsGrid);