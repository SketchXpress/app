// src/components/NFTCarousel/NFTCarousel.tsx - Updated to use shared data
"use client";

import Link from "next/link";
import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ExternalLink,
  Zap,
} from "lucide-react";
import { useCollectionsStore } from "@/stores/collectionsStore";
import { NFTSkeleton } from "./Utils";
import styles from "./NFTCarousel.module.scss";

interface NFTCarouselProps {
  autoplayDelay?: number;
  maxVisibleSlides?: number;
  showIndicators?: boolean;
  showNavButtons?: boolean;
  enableAutoplay?: boolean;
}

interface NFTCollectionDisplay {
  id: string;
  title: string;
  image: string;
  poolAddress: string;
  floor: string;
  supply?: number;
  trending?: boolean;
}

/**
 * NFTCarousel component displays a rotating carousel of NFT collections using shared store data.
 * No additional API calls needed - uses the same data as trending and dropdown.
 */
const NFTCarousel: React.FC<NFTCarouselProps> = ({
  maxVisibleSlides = 6,
  showIndicators = true,
  showNavButtons = true,
  enableAutoplay = true,
}) => {
  // Get data from shared store
  const {
    collections: allCollections,
    pools: allPools,
    poolMetrics,
    connectionState,
    isLoading,
  } = useCollectionsStore();

  // State for loaded images (similar to trending collections)
  const [loadedImages, setLoadedImages] = useState<Map<string, string>>(
    new Map()
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: allPools.length > maxVisibleSlides,
      dragFree: true,
      duration: 30,
      align: "center",
    },
    enableAutoplay ? [Autoplay({ delay: 4000, stopOnInteraction: true })] : []
  );

  // State for carousel controls
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  // Navigation handlers
  const scrollPrev = useCallback(() => {
    if (emblaApi) {
      emblaApi.scrollPrev();
    }
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) {
      emblaApi.scrollNext();
    }
  }, [emblaApi]);

  const scrollTo = useCallback(
    (index: number) => {
      if (emblaApi) {
        emblaApi.scrollTo(index);
      }
    },
    [emblaApi]
  );

  // Update carousel configuration when collections change
  useEffect(() => {
    if (!emblaApi || allPools.length === 0) return;

    emblaApi.reInit({
      loop: allPools.length > maxVisibleSlides,
      dragFree: false,
      duration: 30,
      align: "center",
      slidesToScroll: 1,
      skipSnaps: false,
    });
  }, [allPools.length, emblaApi, maxVisibleSlides]);

  // Update carousel state when Embla API is ready
  const onSelect = useCallback(() => {
    if (!emblaApi) return;

    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  // Set up event listeners
  useEffect(() => {
    if (!emblaApi) return;

    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);

    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  // Function to fetch collection images (same as trending)
  const fetchMetadataImage = useCallback(
    async (uri: string): Promise<string | null> => {
      try {
        if (!uri || uri === "google.com" || uri.length < 10) {
          return null;
        }

        if (!uri.startsWith("http://") && !uri.startsWith("https://")) {
          return null;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(uri, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });

        clearTimeout(timeoutId);

        if (!response.ok) return null;

        const metadata = await response.json();
        return metadata.image || null;
      } catch {
        return null;
      }
    },
    []
  );

  // Fetch images for collections with URIs
  useEffect(() => {
    const fetchImages = async () => {
      const imagesToFetch = allCollections
        .filter(
          (c) =>
            c.uri &&
            !loadedImages.has(c.uri) &&
            c.uri !== "google.com" &&
            c.uri.startsWith("http")
        )
        .slice(0, 5); // Limit concurrent requests

      if (imagesToFetch.length === 0) return;

      const results = await Promise.allSettled(
        imagesToFetch.map(async (collection) => {
          const image = await fetchMetadataImage(collection.uri!);
          return { uri: collection.uri!, image };
        })
      );

      const newImages = new Map(loadedImages);
      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value.image) {
          newImages.set(result.value.uri, result.value.image);
        }
      });

      if (newImages.size > loadedImages.size) {
        setLoadedImages(newImages);
      }
    };

    const timeoutId = setTimeout(fetchImages, 500);
    return () => clearTimeout(timeoutId);
  }, [allCollections, loadedImages, fetchMetadataImage]);

  // Convert store data to carousel format
  const nftCollections = useMemo((): NFTCollectionDisplay[] => {
    // Take the most recent pools (like featured collections)
    const recentPools = allPools
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, maxVisibleSlides);

    return recentPools.map((pool) => {
      // Find matching collection
      const collection = allCollections.find(
        (c) => c.collectionMint === pool.collectionMint
      );

      // Get metrics if available
      const metrics = poolMetrics.get(pool.poolAddress);

      // Determine image source
      let image = "/assets/images/defaultNFT.png";
      if (collection?.uri && loadedImages.has(collection.uri)) {
        image = loadedImages.get(collection.uri)!;
      } else if (collection?.image) {
        image = collection.image;
      } else {
        // Use stable fallback based on pool address
        const hash = pool.poolAddress
          .split("")
          .reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const placeholders = [
          "/assets/images/nft1.jpeg",
          "/assets/images/nft2.avif",
          "/assets/images/nft3.jpg",
          "/assets/images/nft4.jpg",
          "/assets/images/nft5.png",
          "/assets/images/nft6.webp",
        ];
        image = placeholders[hash % placeholders.length];
      }

      // Calculate floor price
      let floor = "0.0001 SOL";
      if (metrics?.lastPrice && metrics.lastPrice > 0) {
        floor = `${metrics.lastPrice.toFixed(4)} SOL`;
      } else if (pool.basePrice) {
        const basePriceSOL = parseFloat(pool.basePrice) / 1e9;
        floor = `${basePriceSOL.toFixed(4)} SOL`;
      }

      return {
        id: pool.poolAddress,
        title:
          collection?.collectionName ||
          pool.collectionName ||
          `Collection ${pool.collectionMint.slice(0, 6)}...`,
        image,
        poolAddress: pool.poolAddress,
        floor,
        supply: metrics?.transactions24h || 0,
        trending: metrics && metrics.volume24h > 0,
      };
    });
  }, [allPools, allCollections, poolMetrics, loadedImages, maxVisibleSlides]);

  /**
   * Handles image loading errors by setting a fallback image.
   */
  const handleImageError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      const target = e.currentTarget as HTMLImageElement;
      if (target.src !== "/assets/images/defaultNFT.png") {
        target.src = "/assets/images/defaultNFT.png";
        target.onerror = null;
      }
    },
    []
  );

  // Show skeleton while loading or if no data
  if (isLoading || nftCollections.length === 0) {
    const skeletonCount = Math.min(6, maxVisibleSlides);
    return (
      <section
        className={styles.heroContainer}
        aria-labelledby="carousel-heading"
      >
        <h2 id="carousel-heading" className="sr-only">
          Featured NFT Collections
        </h2>
        <div className={styles.glowEffect}></div>

        <div className={styles.carouselContainer}>
          <div className={styles.embla}>
            <div className={styles.emblaContainer}>
              {Array.from({ length: skeletonCount }).map((_, index) => (
                <div className={styles.emblaSlide} key={`skeleton-${index}`}>
                  <NFTSkeleton />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={styles.heroContainer}
      aria-labelledby="carousel-heading"
    >
      <h2 id="carousel-heading" className="sr-only">
        Featured NFT Collections
      </h2>
      <div className={styles.glowEffect}></div>

      <div className={styles.carouselContainer}>
        {/* Navigation Buttons */}
        {showNavButtons && nftCollections.length > 1 && (
          <>
            <button
              className={`${styles.arrowButton} ${styles.arrowLeft}`}
              onClick={scrollPrev}
              disabled={!canScrollPrev}
              aria-label="Previous collection"
            >
              <ChevronLeft />
            </button>

            <button
              className={`${styles.arrowButton} ${styles.arrowRight}`}
              onClick={scrollNext}
              disabled={!canScrollNext}
              aria-label="Next collection"
            >
              <ChevronRight />
            </button>
          </>
        )}

        {/* Carousel Container */}
        <div className={styles.embla} ref={emblaRef}>
          <div className={styles.emblaContainer}>
            {nftCollections.map((nft, index) => (
              <div
                className={styles.emblaSlide}
                key={nft.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${nftCollections.length}: ${
                  nft.title
                }`}
              >
                <Link
                  href={`/mintstreet/collection/${nft.poolAddress}`}
                  className={styles.cardLink}
                >
                  <div className={styles.card}>
                    <div className={styles.imageWrapper}>
                      <Image
                        src={nft.image}
                        alt={nft.title || "NFT Collection Image"}
                        fill
                        sizes="(min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 768px) 50vw, 90vw"
                        priority={index < 3}
                        className={styles.nftImage}
                        onError={handleImageError}
                        placeholder="blur"
                        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                        unoptimized
                      />

                      {/* Trending Badge */}
                      {nft.trending && (
                        <div className={styles.trendingBadge}>
                          <TrendingUp size={12} />
                          <span>Trending</span>
                        </div>
                      )}

                      {/* Supply Badge */}
                      {typeof nft.supply === "number" && nft.supply > 0 && (
                        <div className={styles.supplyBadge}>
                          <span>{nft.supply} txns</span>
                        </div>
                      )}

                      {/* New Pool Badge */}
                      <div className={styles.newBadge}>
                        <Zap size={12} />
                        <span>New</span>
                      </div>

                      {/* Info Overlay */}
                      <div className={styles.infoOverlay}>
                        <div className={styles.infoContent}>
                          <h3 className={styles.nftTitle}>{nft.title}</h3>
                          <div className={styles.floorPriceWrapper}>
                            <span className={styles.floorLabel}>
                              Floor Price
                            </span>
                            <span className={styles.floorPrice}>
                              {nft.floor}
                            </span>
                          </div>
                        </div>
                        <div className={styles.viewButton}>
                          <span>View</span>
                          <ExternalLink size={14} />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Progress Indicators */}
      {showIndicators && nftCollections.length > 1 && (
        <div
          className={styles.progressIndicator}
          aria-label="Carousel progress"
        >
          <div className={styles.progressWrapper}>
            {nftCollections.map((_, index) => (
              <button
                key={`dot-${index}`}
                onClick={() => scrollTo(index)}
                className={`${styles.progressDot} ${
                  selectedIndex === index ? styles.activeDot : ""
                }`}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={selectedIndex === index ? "true" : "false"}
              >
                <span className={styles.dotInner} aria-hidden="true"></span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Debug info in development */}
      {process.env.NODE_ENV === "development" && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            fontSize: 12,
            background: "rgba(0,0,0,0.7)",
            color: "white",
            padding: 5,
            borderRadius: 4,
          }}
        >
          {nftCollections.length} collections | {connectionState}
        </div>
      )}
    </section>
  );
};

export default React.memo(NFTCarousel);
