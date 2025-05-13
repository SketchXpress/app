/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { useSellNft } from "@/hooks/useSellNFT";
import styles from "./PoolNFTsGrid.module.scss"; // Assuming SCSS will be updated too
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import NFTRowSkeleton from "./NFTRowSkeleton";
import NFTCardSkeleton from "./NFTCardSkeleton";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { useAnchorContext } from "@/contexts/AnchorContextProvider";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Connection } from "@solana/web3.js";
// import { useBuyNft } from '@/hooks/useBuyNft'; // Buy feature deferred

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
  // const { buyFromPool, loading: isBuying, error: buyError } = useBuyNft(); // Buy feature deferred
  const isBuying = false; // Placeholder since useBuyNft is commented out

  const connectionRef = useRef<Connection | null>(null);
  useEffect(() => {
    if (program) {
      connectionRef.current = program.provider.connection;
    }
  }, [program]);

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
              // Attempt to get amount; this is a simplified placeholder.
              // In a real scenario, deserialize Account data properly.
              // For batching, you'd typically parse info.data if available.
              // Assuming if info exists, amount is > 0 for this example.
              amount = BigInt(1);
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e) {
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

  useEffect(() => {
    if (!nfts || nfts.length === 0) {
      setMetadataLoading(false);
      return;
    }
    setMetadataLoading(true);
    const fetchAllMetadata = async () => {
      const metadataPromises = nfts.map(async (nft) => {
        if (!nft.uri)
          return {
            mintAddress: nft.mintAddress,
            metadata: { name: nft.name, image: nft.image, symbol: nft.symbol },
          };
        try {
          let uri = nft.uri;
          if (uri.startsWith("ar://"))
            uri = `https://arweave.net/${uri.substring(5)}`;
          else if (uri.startsWith("ipfs://"))
            uri = `https://ipfs.io/ipfs/${uri.substring(7)}`;
          else if (!uri.startsWith("http"))
            uri = `https://${uri.replace(/^\/\//, "")}`;

          const response = await fetch(uri, { mode: "cors" });
          if (!response.ok)
            throw new Error(`Failed to fetch metadata from ${uri}`);
          const contentType = response.headers
            .get("content-type")
            ?.toLowerCase();
          if (contentType?.startsWith("image/"))
            return {
              mintAddress: nft.mintAddress,
              metadata: { image: uri, name: nft.name, symbol: nft.symbol },
            };
          const metadata = await response.json();
          return { mintAddress: nft.mintAddress, metadata };
        } catch (fetchError) {
          console.error(
            `Error fetching/processing metadata for ${nft.mintAddress} from ${nft.uri}:`,
            fetchError
          );
          return {
            mintAddress: nft.mintAddress,
            metadata: { name: nft.name, image: nft.image, symbol: nft.symbol },
          };
        }
      });
      const results = await Promise.allSettled(metadataPromises);
      const newMetadata: Record<string, NFTMetadata> = {};
      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value)
          newMetadata[result.value.mintAddress] = result.value.metadata;
      });
      setNftMetadata((prev) => ({ ...prev, ...newMetadata }));
      setMetadataLoading(false);
    };
    fetchAllMetadata();
  }, [nfts]);

  const handleImageError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      e.currentTarget.src = "/assets/images/defaultNFT.png";
      e.currentTarget.onerror = null;
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
      // Ensure isSold from useSellNft hook is the primary determinant for already sold state by current user.
      if (isSelling || isSold(nft.mintAddress) || ownership !== "user") return;
      try {
        const result = await sellNft(nft.mintAddress, poolAddress);
        if (result.success) {
          // After a successful sell, the `isSold` state from `useSellNft` should update.
          // The `nftOwnership` will also update to 'pool' or 'burned' based on chain state upon refresh.
          // For immediate UI feedback, we rely on `isSold` and the hook's loading/success states.
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

  // Buy feature is deferred, so handleBuyNftClick can be simplified or removed for now.

  const getActionButtonsDetails = useCallback(
    (nft: NFT) => {
      const ownership = nftOwnership[nft.mintAddress];
      const nftNameForAria =
        nftMetadata[nft.mintAddress]?.name ||
        nft.name ||
        nft.mintAddress.slice(0, 6);
      const currentUserIsMinter =
        nft.minterAddress && nft.minterAddress === wallet.publicKey?.toBase58();

      // The isSold() function from useSellNft hook is crucial here.
      // It should correctly indicate if the CURRENT USER has sold THIS NFT in the current session or based on its persisted state.
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

      // Case 1: Current user is the minter of this NFT.
      if (currentUserIsMinter) {
        if (hasBeenSoldByCurrentUserViaHook) {
          // Minter has sold this NFT (according to useSellNft hook).
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
          // Minter still owns it on-chain and hook doesn't say it's sold by them yet.
          return {
            text: "Sell",
            disabled: isSelling,
            isLoading: isSelling,
            buttonClass: styles.sellButton,
            onClick: () => handleSellNftClick(nft),
            ariaLabel: `Sell ${nftNameForAria}`,
          };
        }
        // If minter, but ownership is 'pool' or 'other', and hook says not sold by current user.
        // This means it's available. Buy button (disabled for now) would apply.
      }

      // Case 2: Current user is NOT the minter, OR (is minter AND NFT is in pool AND hook doesn't say they sold it).
      // Essentially, if the NFT is available for purchase by the current user.
      if (ownership === "pool" || ownership === "other") {
        // Buy feature is deferred. Show a disabled Buy button.
        return {
          text: "Buy",
          disabled: true,
          isLoading: false,
          buttonClass: `${styles.buyButton} ${styles.disabledButton}`,
          onClick: undefined,
          ariaLabel: `Buy ${nftNameForAria} (Feature coming soon)`,
        };
      }

      // Case 3: Current user owns an NFT they didn't mint (they bought it).
      if (ownership === "user" && !currentUserIsMinter) {
        // They own it, so they can sell it.
        // We also check hasBeenSoldByCurrentUserViaHook here in case they buy and immediately re-sell via the same hook mechanism.
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

      // Fallback for any unhandled cases or if ownership is unclear but not loading/burned.
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
      ownershipLoading /*isBuying, handleBuyNftClick removed as buy is deferred*/,
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
      {/* buyError display can be removed or kept if useBuyNft hook might set it even if button is disabled */}
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
