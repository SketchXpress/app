"use client";

import Link from "next/link";
import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight, TrendingUp, ExternalLink } from "lucide-react";
import { useNFTCollections } from "@/hooks/useNFTCollections"; // Assuming this hook handles pagination/efficient loading as per recommendations
import { NFTSkeleton } from "./Utils"; // Assuming Utils.tsx contains NFTSkeleton
import styles from "./NFTCarousel.module.scss";

/**
 * @typedef {object} NFTCollection
 * @property {string} id - Unique identifier for the NFT collection.
 * @property {string} poolAddress - The address of the pool for this collection.
 * @property {string} image - URL of the collection's image.
 * @property {string} title - Title of the collection.
 * @property {boolean} [trending] - Optional flag indicating if the collection is trending.
 * @property {number} [supply] - Optional total supply of NFTs in the collection.
 * @property {string} floor - Floor price or last mint price of the collection.
 */

/**
 * NFTCarousel component displays a rotating carousel of NFT collections.
 * It fetches collection data using the `useNFTCollections` hook and handles loading, error, and empty states.
 * Features autoplay, manual navigation, and optimized image loading with Next.js Image component.
 *
 * @component
 * @returns {React.ReactElement} The rendered NFT carousel section.
 */
const NFTCarousel = () => {
  // Fetch NFT collections. Recommendation: useNFTCollections should ideally support pagination or efficient loading.
  const { collections, loading, error } = useNFTCollections(6);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: false, // Changed to true for a continuous loop, common for carousels
      dragFree: true,
      duration: 30, // Speed of the transition
      align: "center",
    },
    [Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true })] // Autoplay plugin
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [, setHoveredIndex] = useState<number | null>(null);
  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  // Effect to update the active index for pagination dots
  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      setActiveIndex(emblaApi.selectedScrollSnap());
    };

    emblaApi.on("select", onSelect);
    onSelect(); // Initialize activeIndex

    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  /**
   * Handles image loading errors by setting a fallback image.
   * @param {React.SyntheticEvent<HTMLImageElement, Event>} e - The event object.
   */
  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.currentTarget as HTMLImageElement;
    target.src = "/defaultNFT.png"; // Ensure this fallback image exists in /public
    target.onerror = null; // Prevent infinite loop if fallback also fails
  }, []);

  // Memoized skeleton items for loading state to prevent re-creation on each render
  const skeletonItems = useMemo(() =>
    Array.from({ length: 6 }).map((_, index) => ({ id: `skeleton-${index}` })),
    []
  );

  // Determine the number of slides for progress dots
  const slideCount = useMemo(() => loading ? 6 : collections.length || 0, [loading, collections.length]);

  const priceLabel = "Last Mint"; // Or derive dynamically if needed

  if (error) {
    return (
      <section className={styles.heroContainer}>
        <div className={styles.errorContainer}>
          <p className={styles.errorText}>Failed to load collections. Please try refreshing the page.</p>
          {/* Optionally, add a refresh button here */}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.heroContainer} aria-labelledby="carousel-heading">
      <h2 id="carousel-heading" className="sr-only">Featured NFT Collections</h2>
      <div className={styles.glowEffect}></div>

      <div className={styles.carouselContainer}>
        <button
          className={`${styles.arrowButton} ${styles.arrowLeft}`}
          onClick={scrollPrev}
          aria-label="Previous slide"
          disabled={loading || collections.length === 0}
        >
          <ChevronLeft />
        </button>

        <div className={styles.embla} ref={emblaRef}>
          <div className={styles.emblaContainer}>
            {loading ? (
              skeletonItems.map((item) => (
                <div className={styles.emblaSlide} key={item.id}>
                  <NFTSkeleton />
                </div>
              ))
            ) : collections.length > 0 ? (
              collections.map((nft, index) => (
                <div
                  className={styles.emblaSlide}
                  key={nft.id || `nft-${index}`} // Ensure unique key
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${index + 1} of ${collections.length}: ${nft.title}`}
                >
                  <Link href={`/mintstreet/collection/${nft.poolAddress}`} className={styles.cardLink}>
                    <div className={styles.card}>
                      <div className={styles.imageWrapper}>
                        <Image
                          src={nft.image || "/defaultNFT.png"}
                          alt={nft.title || "NFT Collection Image"} // Provide a default alt text
                          fill
                          sizes="(min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 768px) 50vw, 90vw"
                          priority={index < 2} // Prioritize loading for the first two images
                          placeholder="blur" // Added placeholder for better perceived performance
                          blurDataURL={nft.image || "/defaultNFT.png"} // Provide a blurDataURL, can be a small base64 image or same image for simplicity if small
                          className={styles.nftImage}
                          onError={handleImageError}
                        />
                        {nft.trending && (
                          <div className={styles.trendingBadge}>
                            <TrendingUp size={12} />
                            <span>Trending</span>
                          </div>
                        )}
                        {typeof nft.supply === "number" && nft.supply > 0 && (
                          <div className={styles.supplyBadge}>
                            <span>{nft.supply} NFTs</span>
                          </div>
                        )}
                        <div className={styles.infoOverlay}>
                          <div className={styles.infoContent}>
                            <h3 className={styles.nftTitle}>{nft.title}</h3>
                            <div className={styles.floorPriceWrapper}>
                              <span className={styles.floorLabel}>{priceLabel}</span>
                              <span className={styles.floorPrice}>{nft.floor}</span>
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
              ))
            ) : (
              <div className={styles.emptyContainer}>
                <p className={styles.emptyText}>No collections found at the moment.</p>
              </div>
            )}
          </div>
        </div>

        <button
          className={`${styles.arrowButton} ${styles.arrowRight}`}
          onClick={scrollNext}
          aria-label="Next slide"
          disabled={loading || collections.length === 0}
        >
          <ChevronRight />
        </button>
      </div>

      {collections.length > 0 && (
        <div className={styles.progressIndicator} aria-label="Carousel progress">
          <div className={styles.progressWrapper}>
            {Array.from({ length: slideCount }).map((_, index) => (
              <button
                key={`dot-${index}`}
                onClick={() => emblaApi?.scrollTo(index)}
                className={`${styles.progressDot} ${activeIndex === index ? styles.activeDot : ""}`}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={activeIndex === index ? "true" : "false"}
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