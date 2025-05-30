/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import React, { useState, useEffect, useCallback, useRef } from "react";

import { useSellNft } from "@/hooks/useSellNFT";
import { PublicKey, Connection } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { useAnchorContext } from "@/contexts/AnchorContextProvider";

import NFTRowSkeleton from "./NFTRowSkeleton";
import NFTCardSkeleton from "./NFTCardSkeleton";

import styles from "./PoolNFTsGrid.module.scss";

interface NFT {
  mintAddress: string;
  name: string;
  symbol: string;
  uri?: string;
  timestamp: number;
  signature: string;
  price: number;
  image?: string;
  minterAddress?: string;
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

type OwnershipStatus = "pool" | "user" | "other" | "burned" | "loading";

const SKELETON_COUNT = 5;
const mintInfoCache = new Map<string, { supply: bigint } | "nonexistent">();

const fetchMetadataForNft = async (nft: NFT) => {
  if (!nft.uri) {
    return {
      mintAddress: nft.mintAddress,
      metadata: { name: nft.name, image: nft.image, symbol: nft.symbol },
    };
  }

  try {
    const response = await fetch(
      `/api/nft-metadata?uri=${encodeURIComponent(nft.uri)}`
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const metadata = await response.json();

    // Handle API error response
    if (metadata.error) {
      throw new Error(metadata.error);
    }

    return { mintAddress: nft.mintAddress, metadata };
  } catch (fetchError) {
    console.error(
      `Error fetching metadata for ${nft.mintAddress}:`,
      fetchError
    );
    return {
      mintAddress: nft.mintAddress,
      metadata: { name: nft.name, image: nft.image, symbol: nft.symbol },
    };
  }
};

// Batch metadata fetching function
const fetchMetadataBatch = async (nfts: NFT[]) => {
  const nftsWithUris = nfts.filter((nft) => nft.uri);

  if (nftsWithUris.length === 0) {
    return nfts.map((nft) => ({
      mintAddress: nft.mintAddress,
      metadata: { name: nft.name, image: nft.image, symbol: nft.symbol },
    }));
  }

  try {
    const response = await fetch("/api/nft-metadata", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uris: nftsWithUris.map((nft) => nft.uri),
      }),
    });

    if (!response.ok) {
      throw new Error(`Batch API error: ${response.status}`);
    }

    const results = await response.json();

    // Combine results with original NFTs
    return nfts.map((nft) => {
      if (!nft.uri) {
        return {
          mintAddress: nft.mintAddress,
          metadata: { name: nft.name, image: nft.image, symbol: nft.symbol },
        };
      }

      const result = results.find((r: any) => r.uri === nft.uri);
      return {
        mintAddress: nft.mintAddress,
        metadata: result?.success
          ? result.metadata
          : { name: nft.name, image: nft.image, symbol: nft.symbol },
      };
    });
  } catch (error) {
    console.error("Batch metadata fetch error:", error);
    return Promise.all(nfts.map(fetchMetadataForNft));
  }
};

const PoolNFTsGrid: React.FC<PoolNFTsGridProps> = ({
  nfts,
  isLoading,
  error,
  poolAddress,
  onRefresh,
}) => {
  const [nftMetadata, setNftMetadata] = useState<Record<string, NFTMetadata>>(
    {}
  );
  const [metadataLoading, setMetadataLoading] = useState<boolean>(true);
  const [nftOwnership, setNftOwnership] = useState<
    Record<string, OwnershipStatus>
  >({});
  const [ownershipLoading, setOwnershipLoading] = useState<boolean>(true);

  const { program } = useAnchorContext();
  const wallet = useWallet();
  const {
    sellNft,
    loading: isSelling,
    error: sellError,
    isSold,
  } = useSellNft();
  const isBuying = false;

  const connectionRef = useRef<Connection | null>(null);
  useEffect(() => {
    if (program) {
      connectionRef.current = program.provider.connection;
    }
  }, [program]);

  // NFT Ownership checking
  useEffect(() => {
    const checkNftOwnershipOptimized = async () => {
      if (!connectionRef.current || !nfts || nfts.length === 0) {
        setOwnershipLoading(false);
        return;
      }
      setOwnershipLoading(true);
      const connection = connectionRef.current;
      const currentNftOwnership: Record<string, OwnershipStatus> = {};
      nfts.forEach((nft) => (currentNftOwnership[nft.mintAddress] = "loading"));
      setNftOwnership(currentNftOwnership);

      const mintPubkeysToQuery: PublicKey[] = [];
      const mintAddressMap: Record<string, string> = {};

      for (const nft of nfts) {
        if (mintInfoCache.has(nft.mintAddress)) {
          const cachedMintInfo = mintInfoCache.get(nft.mintAddress);
          if (
            cachedMintInfo === "nonexistent" ||
            (cachedMintInfo as any).supply === BigInt(0)
          ) {
            currentNftOwnership[nft.mintAddress] = "burned";
            continue;
          }
        }
        try {
          const mintPk = new PublicKey(nft.mintAddress);
          mintPubkeysToQuery.push(mintPk);
          mintAddressMap[mintPk.toBase58()] = nft.mintAddress;
        } catch (e) {
          console.error(`Invalid mint address: ${nft.mintAddress}`, e);
          currentNftOwnership[nft.mintAddress] = "burned";
        }
      }

      if (mintPubkeysToQuery.length > 0) {
        const mintInfos = await connection.getMultipleAccountsInfo(
          mintPubkeysToQuery
        );
        mintInfos.forEach((info, index) => {
          const originalMintAddress =
            mintAddressMap[mintPubkeysToQuery[index].toBase58()];
          if (!info) {
            mintInfoCache.set(originalMintAddress, "nonexistent");
            currentNftOwnership[originalMintAddress] = "burned";
          }
        });
      }
      setNftOwnership((prev) => ({ ...prev, ...currentNftOwnership }));

      const ataPubkeysToQuery: PublicKey[] = [];
      const ataInfoMapping: {
        mintAddress: string;
        type: "escrow" | "user";
        ata: PublicKey;
      }[] = [];

      for (const nft of nfts) {
        if (currentNftOwnership[nft.mintAddress] === "burned") continue;
        try {
          const mintPubkey = new PublicKey(nft.mintAddress);
          if (!program) {
            console.error("Program is null when trying to find escrow PDA");
            continue;
          }
          const [escrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("nft-escrow"), mintPubkey.toBuffer()],
            program.programId
          );
          const escrowAta = await getAssociatedTokenAddress(
            mintPubkey,
            escrowPda,
            true
          );
          ataPubkeysToQuery.push(escrowAta);
          ataInfoMapping.push({
            mintAddress: nft.mintAddress,
            type: "escrow",
            ata: escrowAta,
          });

          if (wallet.publicKey) {
            const userAta = await getAssociatedTokenAddress(
              mintPubkey,
              wallet.publicKey
            );
            ataPubkeysToQuery.push(userAta);
            ataInfoMapping.push({
              mintAddress: nft.mintAddress,
              type: "user",
              ata: userAta,
            });
          }
        } catch (e) {
          console.error(`Error getting ATAs for ${nft.mintAddress}`, e);
          currentNftOwnership[nft.mintAddress] = "other";
        }
      }

      const finalOwnershipUpdate: Record<string, OwnershipStatus> = {};
      if (ataPubkeysToQuery.length > 0) {
        const accountInfos = await connection.getMultipleAccountsInfo(
          ataPubkeysToQuery
        );
        const tempOwnership: Record<
          string,
          { userAmount: bigint; escrowAmount: bigint }
        > = {};

        accountInfos.forEach((info, index) => {
          const mapping = ataInfoMapping[index];
          if (!tempOwnership[mapping.mintAddress]) {
            tempOwnership[mapping.mintAddress] = {
              userAmount: BigInt(0),
              escrowAmount: BigInt(0),
            };
          }
          let amount = BigInt(0);
          if (info) {
            try {
              amount = BigInt(1);
            } catch {
              /* ignore if account doesn't exist or parsing fails */
            }
          }
          if (mapping.type === "user")
            tempOwnership[mapping.mintAddress].userAmount = amount;
          if (mapping.type === "escrow")
            tempOwnership[mapping.mintAddress].escrowAmount = amount;
        });

        for (const mintAddr in tempOwnership) {
          if (currentNftOwnership[mintAddr] === "burned") continue;
          const { userAmount, escrowAmount } = tempOwnership[mintAddr];
          if (userAmount > BigInt(0)) finalOwnershipUpdate[mintAddr] = "user";
          else if (escrowAmount > BigInt(0))
            finalOwnershipUpdate[mintAddr] = "pool";
          else finalOwnershipUpdate[mintAddr] = "other";
        }
      } else {
        nfts.forEach((nft) => {
          if (
            currentNftOwnership[nft.mintAddress] !== "burned" &&
            !finalOwnershipUpdate[nft.mintAddress]
          ) {
            finalOwnershipUpdate[nft.mintAddress] = "other";
          }
        });
      }
      setNftOwnership((prev) => ({
        ...prev,
        ...currentNftOwnership,
        ...finalOwnershipUpdate,
      }));
      setOwnershipLoading(false);
    };
    checkNftOwnershipOptimized();
  }, [nfts, program, wallet.publicKey]);

  // Updated metadata fetching with API route
  useEffect(() => {
    if (!nfts || nfts.length === 0) {
      setMetadataLoading(false);
      return;
    }
    setMetadataLoading(true);

    const fetchAllMetadata = async () => {
      try {
        const results = await fetchMetadataBatch(nfts);

        const newMetadata: Record<string, NFTMetadata> = {};
        results.forEach((result) => {
          if (result && result.mintAddress) {
            newMetadata[result.mintAddress] = result.metadata;
          }
        });

        setNftMetadata((prev) => ({ ...prev, ...newMetadata }));
      } catch (error) {
        console.error("Error fetching all metadata:", error);
      } finally {
        setMetadataLoading(false);
      }
    };

    fetchAllMetadata();
  }, [nfts]);

  const handleImageError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      const target = e.currentTarget as HTMLImageElement;
      const currentSrc = target.src;

      // Prevent infinite loops
      if (currentSrc.includes("defaultNFT.png")) {
        console.warn("Fallback image also failed to load");
        return;
      }
      target.src = "/assets/images/defaultNFT.png";
      target.onerror = null; 
    },
    []
  );

  const formatTimestamp = useCallback((timestamp: number) => {
    if (!timestamp) return "Unknown time";
    try {
      return formatDistanceToNow(new Date(timestamp * 1000), {
        addSuffix: true,
      });
    } catch (err) {
      console.error("Error formatting timestamp:", err);
      return "Invalid date";
    }
  }, []);

  const getNftImageUrl = useCallback(
    (nft: NFT): string => {
      const metadata = nftMetadata[nft.mintAddress];
      const imageUrl = metadata?.image || nft.image;
      if (imageUrl) {
        if (imageUrl.startsWith("ipfs://"))
          return `https://ipfs.io/ipfs/${imageUrl.substring(7)}`;
        if (imageUrl.startsWith("ar://"))
          return `https://arweave.net/${imageUrl.substring(5)}`;
        return imageUrl.startsWith("http")
          ? imageUrl
          : "/assets/images/defaultNFT.png";
      }
      return "/assets/images/defaultNFT.png";
    },
    [nftMetadata]
  );

  const handleSellNftClick = useCallback(
    async (nft: NFT) => {
      const ownership = nftOwnership[nft.mintAddress];
      if (isSelling || isSold(nft.mintAddress) || ownership !== "user") return;
      try {
        const result = await sellNft(nft.mintAddress, poolAddress);
        if (result.success) {
          if (onRefresh) {
            setTimeout(onRefresh, 2000);
          }
        }
      } catch (err) {
        console.error("Error in handleSellNftClick:", err);
      }
    },
    [isSelling, isSold, poolAddress, sellNft, nftOwnership, onRefresh]
  );

  const getActionButtonsDetails = useCallback(
    (nft: NFT) => {
      const ownership = nftOwnership[nft.mintAddress];
      const nftNameForAria =
        nftMetadata[nft.mintAddress]?.name ||
        nft.name ||
        nft.mintAddress.slice(0, 6);
      const currentUserIsMinter =
        nft.minterAddress && nft.minterAddress === wallet.publicKey?.toBase58();
      const hasBeenSoldByCurrentUserViaHook = isSold(nft.mintAddress);

      if (ownership === "loading" || ownershipLoading) {
        return {
          text: "Loading...",
          disabled: true,
          isLoading: true,
          buttonClass: styles.disabledButton,
          onClick: undefined,
          ariaLabel: `Loading actions for ${nftNameForAria}`,
        };
      }
      if (ownership === "burned") {
        return {
          text: "Burned",
          disabled: true,
          isLoading: false,
          buttonClass: styles.disabledButton,
          onClick: undefined,
          ariaLabel: `${nftNameForAria} is burned`,
        };
      }

      if (currentUserIsMinter) {
        if (hasBeenSoldByCurrentUserViaHook) {
          return {
            text: "Sold",
            disabled: true,
            showSuccessIcon: true,
            isLoading: false,
            buttonClass: styles.soldButton,
            onClick: undefined,
            ariaLabel: `${nftNameForAria} Sold by you`,
          };
        }
        if (ownership === "user") {
          return {
            text: "Sell",
            disabled: isSelling,
            isLoading: isSelling,
            buttonClass: styles.sellButton,
            onClick: () => handleSellNftClick(nft),
            ariaLabel: `Sell ${nftNameForAria}`,
          };
        }
      }

      if (ownership === "pool" || ownership === "other") {
        return {
          text: "Buy",
          disabled: true,
          isLoading: false,
          buttonClass: `${styles.buyButton} ${styles.disabledButton}`,
          onClick: undefined,
          ariaLabel: `Buy ${nftNameForAria} (Feature coming soon)`,
        };
      }

      if (ownership === "user" && !currentUserIsMinter) {
        if (hasBeenSoldByCurrentUserViaHook) {
          return {
            text: "Sold",
            disabled: true,
            showSuccessIcon: true,
            isLoading: false,
            buttonClass: styles.soldButton,
            onClick: undefined,
            ariaLabel: `${nftNameForAria} Sold by you`,
          };
        }
        return {
          text: "Sell",
          disabled: isSelling,
          isLoading: isSelling,
          buttonClass: styles.sellButton,
          onClick: () => handleSellNftClick(nft),
          ariaLabel: `Sell ${nftNameForAria}`,
        };
      }

      return {
        text: "N/A",
        disabled: true,
        isLoading: false,
        buttonClass: styles.disabledButton,
        onClick: undefined,
        ariaLabel: `No action available for ${nftNameForAria}`,
      };
    },
    [
      nftOwnership,
      nftMetadata,
      wallet.publicKey,
      isSold,
      isSelling,
      handleSellNftClick,
      ownershipLoading,
    ]
  );

  const showSkeletons =
    isLoading || (nfts.length > 0 && (metadataLoading || ownershipLoading));

  if (showSkeletons && nfts.length === 0 && !error) {
    return (
      <div className={styles.container}>
        <h2 className={`${styles.title} ${styles.skeletonTitle}`}>
          <div
            className={`${styles.skeleton} ${styles.skeletonTextMedium}`}
          ></div>
        </h2>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>S.No.</th>
                <th>Image</th>
                <th>Name</th>
                <th>Symbol</th>
                <th>Price</th>
                <th>Time</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
                <NFTRowSkeleton key={`row-skeleton-${index}`} />
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
            <NFTCardSkeleton key={`card-skeleton-${index}`} />
          ))}
        </div>
      </div>
    );
  }

  if (error)
    return (
      <div className={styles.errorContainer} role="alert">
        <AlertCircle size={24} className={styles.errorIcon} />
        <p>Error loading NFTs: {error}</p>
      </div>
    );
  if (!isLoading && nfts.length === 0)
    return (
      <div className={styles.emptyContainer}>
        <p>No NFTs found in this pool.</p>
      </div>
    );

  return (
    <div
      className={styles.container}
      aria-live="polite"
      aria-busy={isSelling || isBuying || ownershipLoading || metadataLoading}
    >
      <h2 className={styles.title}>Pool NFTs</h2>
      {sellError && (
        <div
          className={`${styles.errorMessage} ${styles.sellErrorMessage}`}
          role="alert"
        >
          <AlertCircle size={16} />
          <span>
            Failed to sell NFT:{" "}
            {typeof sellError === "string"
              ? sellError
              : (sellError as Error)?.message || "Unknown error"}
            . Please try again.
          </span>
        </div>
      )}
      <div className={styles.tableContainer}>
        <table className={`${styles.table} ${styles.enhancedTableDesign}`}>
          <thead>
            <tr>
              <th>S.No.</th>
              <th>Image</th>
              <th>Name</th>
              <th>Symbol</th>
              <th>Price</th>
              <th>Time</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {(isLoading && nfts.length === 0
              ? Array.from({ length: SKELETON_COUNT })
              : nfts
            ).map((nftOrSkeleton, index) => {
              if (isLoading && nfts.length === 0)
                return <NFTRowSkeleton key={`row-skeleton-${index}`} />;
              const nft = nftOrSkeleton as NFT;
              const details = getActionButtonsDetails(nft);
              const nftName =
                nftMetadata[nft.mintAddress]?.name || nft.name || "Unnamed NFT";
              const nftSymbol =
                nftMetadata[nft.mintAddress]?.symbol || nft.symbol || "N/S";
              return (
                <tr key={nft.mintAddress || `skeleton-${index}`}>
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
                        blurDataURL="/assets/images/defaultNFT.png"
                      />
                    </div>
                  </td>
                  <td className={styles.nameCell} title={nftName}>
                    {nftName}
                  </td>
                  <td className={styles.symbolCell} title={nftSymbol}>
                    {nftSymbol}
                  </td>
                  <td className={styles.priceCell}>
                    {nft.price ? `${nft.price.toFixed(4)} SOL` : "N/A"}
                  </td>
                  <td className={styles.timeCell}>
                    {formatTimestamp(nft.timestamp)}
                  </td>
                  <td className={styles.actionsCell}>
                    <button
                      className={`${styles.actionButton} ${
                        details.buttonClass
                      } ${details.disabled ? styles.disabledButton : ""}`}
                      onClick={details.onClick}
                      disabled={details.disabled}
                      aria-label={details.ariaLabel}
                    >
                      {details.isLoading && (
                        <Loader2
                          size={14}
                          className={styles.spinnerIcon}
                          aria-hidden="true"
                        />
                      )}
                      {details.showSuccessIcon && (
                        <CheckCircle
                          size={14}
                          className={styles.checkIcon}
                          aria-hidden="true"
                        />
                      )}
                      {details.text}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={styles.cardsContainer}>
        {(isLoading && nfts.length === 0
          ? Array.from({ length: SKELETON_COUNT })
          : nfts
        ).map((nftOrSkeleton, index) => {
          if (isLoading && nfts.length === 0)
            return <NFTCardSkeleton key={`card-skeleton-${index}`} />;
          const nft = nftOrSkeleton as NFT;
          const details = getActionButtonsDetails(nft);
          const nftName =
            nftMetadata[nft.mintAddress]?.name || nft.name || "Unnamed NFT";
          const nftSymbol =
            nftMetadata[nft.mintAddress]?.symbol || nft.symbol || "N/S";
          return (
            <div
              key={nft.mintAddress || `skeleton-card-${index}`}
              className={styles.card}
              role="listitem"
            >
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
                    blurDataURL="/assets/images/defaultNFT.png"
                  />
                </div>
                <div className={styles.cardInfo}>
                  <div className={styles.cardIndex}>#{index + 1}</div>
                  <h3 className={styles.cardName} title={nftName}>
                    {nftName}
                  </h3>
                  <div className={styles.cardSymbol} title={nftSymbol}>
                    {nftSymbol}
                  </div>
                </div>
              </div>
              <div className={styles.cardDetails}>
                <div className={styles.cardDetail}>
                  <span className={styles.detailLabel}>Price:</span>
                  <span className={styles.detailValue}>
                    {nft.price ? `${nft.price.toFixed(4)} SOL` : "N/A"}
                  </span>
                </div>
                <div className={styles.cardDetail}>
                  <span className={styles.detailLabel}>Time:</span>
                  <span className={styles.detailValue}>
                    {formatTimestamp(nft.timestamp)}
                  </span>
                </div>
              </div>
              <div className={styles.cardActions}>
                <button
                  className={`${styles.actionButton} ${details.buttonClass} ${
                    details.disabled ? styles.disabledButton : ""
                  }`}
                  onClick={details.onClick}
                  disabled={details.disabled}
                  aria-label={details.ariaLabel}
                >
                  {details.isLoading && (
                    <Loader2
                      size={14}
                      className={styles.spinnerIcon}
                      aria-hidden="true"
                    />
                  )}
                  {details.showSuccessIcon && (
                    <CheckCircle
                      size={14}
                      className={styles.checkIcon}
                      aria-hidden="true"
                    />
                  )}
                  {details.text}
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
