"use client";

import Link from "next/link";
import Image from "next/image";
import { NFTSkeleton } from "./Utils";
import styles from "./NFTCarousel.module.scss";
import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { useNFTCollections } from "@/hooks/useNFTCollections";
import { useCallback, useEffect, useMemo, useState } from "react";

const NFTCarousel = () => {
  const { collections, loading, error } = useNFTCollections(6);
  // Removed console.log that was causing repeated renders

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: false,
      dragFree: true,
      duration: 30,
      align: "center",
    },
    [Autoplay()]
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  // Autoplay
  useEffect(() => {
    if (!emblaApi) return;

    const interval = setInterval(() => {
      if (hoveredIndex === null) {
        // Only autoplay when no slide is being hovered
        emblaApi.scrollNext();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [emblaApi, hoveredIndex]);

  // Track active slide
  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      setActiveIndex(emblaApi.selectedScrollSnap());
    };

    emblaApi.on("select", onSelect);
    onSelect();

    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  // Handle image load errors - updated with better fallback support
  const handleImageError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      // Always use defaultNFT.png which is confirmed to exist
      const target = e.currentTarget as HTMLImageElement;
      target.src = "/defaultNFT.png";

      // Prevent further errors
      target.onerror = null;
    },
    []
  );

  // Generate skeleton items for loading state
  const skeletonItems = useMemo(() =>
    Array.from({ length: 6 }).map((_, index) => ({
      id: `skeleton-${index}`,
    })), []
  );

  // Determine correct number of slides for progress dots
  const slideCount = useMemo(() =>
    loading ? 6 : collections.length || 0,
    [loading, collections.length]
  );

  // Update label for price display
  const priceLabel = "Last Mint";

  return (
    <section className={styles.heroContainer}>
      <div className={styles.glowEffect}></div>

      <div className={styles.carouselContainer}>
        <button
          className={`${styles.arrowButton} ${styles.arrowLeft}`}
          onClick={scrollPrev}
          aria-label="Previous slide"
          disabled={loading} // Disable buttons while loading
        >
          <ChevronLeft />
        </button>

        <div className={styles.embla} ref={emblaRef}>
          <div className={styles.emblaContainer}>
            {loading ? (
              // Show skeleton loaders while loading is true
              skeletonItems.map((item) => (
                <div className={styles.emblaSlide} key={item.id}>
                  <NFTSkeleton />
                </div>
              ))
            ) : error ? (
              // Show error state if loading is false and there's an error
              <div className={styles.errorContainer}>
                <p className={styles.errorText}>Failed to load collections</p>
              </div>
            ) : collections.length > 0 ? (
              // Show actual NFT data if loading is false, no error, and collections are found
              collections.map((nft, index) => (
                <div
                  className={styles.emblaSlide}
                  key={nft.id} // Using id from mapped data
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <Link href={`/mintstreet/collection/${nft.poolAddress}`} className={styles.cardLink}>
                    <div className={styles.card}>
                      <div className={styles.imageWrapper}>
                        <Image
                          src={nft.image || "/defaultNFT.png"}
                          alt={nft.title}
                          fill
                          sizes="(min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 768px) 50vw, 90vw"
                          priority
                          className={styles.nftImage}
                          onError={handleImageError}
                        />

                        {nft.trending && (
                          <div className={styles.trendingBadge}>
                            <TrendingUp size={12} />
                            <span>Trending</span>
                          </div>
                        )}

                        {typeof nft.supply === 'number' && nft.supply > 0 && (
                          <div className={styles.supplyBadge}>
                            <span>{nft.supply} NFTs</span>
                          </div>
                        )}

                        <div className={styles.infoOverlay}>
                          <div className={styles.infoContent}>
                            <h3 className={styles.nftTitle}>{nft.title}</h3>
                            <div className={styles.floorPriceWrapper}>
                              <span className={styles.floorLabel}>{priceLabel}</span>
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
              ))
            ) : (
              // Show empty state if loading is false, no error, and no collections were found
              <div className={styles.emptyContainer}>
                <p className={styles.emptyText}>No collections found</p>
              </div>
            )}
          </div>
        </div>

        <button
          className={`${styles.arrowButton} ${styles.arrowRight}`}
          onClick={scrollNext}
          aria-label="Next slide"
          disabled={loading} // Disable buttons while loading
        >
          <ChevronRight />
        </button>
      </div>

      <div className={styles.progressIndicator}>
        <div className={styles.progressWrapper}>
          {slideCount > 0 &&
            Array.from({ length: slideCount }).map((_, index) => (
              <button
                key={index}
                onClick={() => emblaApi?.scrollTo(index)}
                className={`${styles.progressDot} ${activeIndex === index ? styles.activeDot : ""
                  }`}
                aria-label={`Go to slide ${index + 1}`}
              >
                <span className={styles.dotInner}></span>
              </button>
            ))}
        </div>
      </div>
    </section>
  );
};

export default NFTCarousel;