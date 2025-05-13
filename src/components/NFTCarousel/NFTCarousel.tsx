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
} from "lucide-react";
import { useNFTCollections } from "@/hooks/useNFTCollections";
import { NFTSkeleton } from "./Utils";
import styles from "./NFTCarousel.module.scss";

interface NFTCarouselProps {
  autoplayDelay?: number;
  maxVisibleSlides?: number;
  showIndicators?: boolean;
  showNavButtons?: boolean;
  enableAutoplay?: boolean; // Added toggle for autoplay
}

/**
 * NFTCarousel component displays a rotating carousel of NFT collections.
 * Features optional autoplay, manual navigation, responsive design, and optimized image loading.
 */
const NFTCarousel: React.FC<NFTCarouselProps> = ({
  maxVisibleSlides = 6,
  showIndicators = true,
  showNavButtons = true, // Disabled by default
}) => {
  // Fetch NFT collections
  const { collections, loading, error } = useNFTCollections(maxVisibleSlides);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: false,
      dragFree: true,
      duration: 30,
      align: "center",
    },
    [Autoplay()]
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
    if (!emblaApi || collections.length === 0) return;

    // Reinitialize carousel with updated loop setting
    emblaApi.reInit({
      loop: false,
      dragFree: false,
      duration: 30,
      align: "center",
      slidesToScroll: 1,
      skipSnaps: false,
    });
  }, [collections.length, emblaApi]);

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

  /**
   * Formats image URLs to handle different protocols (IPFS, Arweave, etc.)
   */
  const formatImageUrl = useCallback((imageUrl: string): string => {
    if (!imageUrl) return "/assets/images/defaultNFT.png";

    // Handle IPFS URLs
    if (imageUrl.startsWith("ipfs://")) {
      return `https://ipfs.io/ipfs/${imageUrl.substring(7)}`;
    }

    // Handle Arweave URLs
    if (imageUrl.startsWith("ar://")) {
      return `https://arweave.net/${imageUrl.substring(5)}`;
    }

    // Handle relative URLs or non-http URLs
    if (!imageUrl.startsWith("http")) {
      if (imageUrl.startsWith("//")) {
        return `https:${imageUrl}`;
      }
      return "/assets/images/defaultNFT.png";
    }

    return imageUrl;
  }, []);

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

  // Memoized skeleton items for loading state
  const skeletonItems = useMemo(
    () =>
      Array.from({ length: Math.min(6, maxVisibleSlides) }).map((_, index) => ({
        id: `skeleton-${index}`,
      })),
    [maxVisibleSlides]
  );

  // Error state with retry option
  if (error && !loading && collections.length === 0) {
    return (
      <section className={styles.heroContainer}>
        <div className={styles.errorContainer}>
          <p className={styles.errorText}>Failed to load collections.</p>
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
        {showNavButtons && collections.length > 0 && (
          <>
            <button
              className={`${styles.arrowButton} ${styles.arrowLeft}`}
              onClick={scrollPrev}
              disabled={!canScrollPrev || loading}
              aria-label="Previous collection"
            >
              <ChevronLeft />
            </button>

            <button
              className={`${styles.arrowButton} ${styles.arrowRight}`}
              onClick={scrollNext}
              disabled={!canScrollNext || loading}
              aria-label="Next collection"
            >
              <ChevronRight />
            </button>
          </>
        )}

        {/* Carousel Container */}
        <div className={styles.embla} ref={emblaRef}>
          <div className={styles.emblaContainer}>
            {loading || collections.length === 0
              ? // Show skeleton when loading OR when no collections available
                skeletonItems.map((item) => (
                  <div className={styles.emblaSlide} key={item.id}>
                    <NFTSkeleton />
                  </div>
                ))
              : // Collection cards - only show when we have actual data
                collections.map((nft, index) => (
                  <div
                    className={styles.emblaSlide}
                    key={nft.id || `nft-${index}`}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${index + 1} of ${collections.length}: ${
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
                            src={formatImageUrl(nft.image)}
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
                              <span>{nft.supply} NFTs</span>
                            </div>
                          )}

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
      {showIndicators && collections.length > 0 && !loading && (
        <div
          className={styles.progressIndicator}
          aria-label="Carousel progress"
        >
          <div className={styles.progressWrapper}>
            {collections.map((_, index) => (
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
    </section>
  );
};

export default React.memo(NFTCarousel);
