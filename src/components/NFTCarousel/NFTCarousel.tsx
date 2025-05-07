// components/NFTCarousel/NFTCarousel.tsx
"use client";

import { useCallback, useEffect, useState } from "react"; // Removed useEffect for isInitialLoad
import useEmblaCarousel from "embla-carousel-react";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import styles from "./NFTCarousel.module.scss";
import { useNFTCollections } from "@/hooks/useNFTCollections";

// Skeleton component for loading state
const NFTSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.imageWrapper}>
      <div className={styles.skeletonImage}></div>
      <div className={styles.infoOverlay}>
        <div className={styles.infoContent}>
          <div className={styles.skeletonTitle}></div>
          <div className={styles.floorPriceWrapper}>
            <div className={styles.skeletonFloor}></div>
          </div>
        </div>
        <div className={styles.skeletonButton}></div>
      </div>
    </div>
  </div>
);

const NFTCarousel = () => {
  // Fetch dynamic NFT collections
  const { collections, loading, error } = useNFTCollections(6);

  // Use the hook's loading state directly
  const isLoading = loading;

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    dragFree: true,
    duration: 30,
    align: "center",
  });

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
    onSelect(); // Initial call

    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  // Handle image load errors
  const handleImageError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      const target = e.target as HTMLImageElement;
      target.src = "/defaultNFT.png";
    },
    []
  );

  // Generate skeleton items for loading state
  const skeletonItems = Array.from({ length: 6 }).map((_, index) => ({
    id: `skeleton-${index}`,
  }));

  // Determine correct number of slides for progress dots
  // If loading, assume 6 skeletons; otherwise, use the actual collection count
  const slideCount = loading ? 6 : collections.length || 0;

  return (
    <section className={styles.heroContainer}>
      <div className={styles.glowEffect}></div>

      <div className={styles.carouselContainer}>
        <button
          className={`${styles.arrowButton} ${styles.arrowLeft}`}
          onClick={scrollPrev}
          aria-label="Previous slide"
          disabled={isLoading} // Disable buttons while loading
        >
          <ChevronLeft />
        </button>

        <div className={styles.embla} ref={emblaRef}>
          <div className={styles.emblaContainer}>
            {isLoading ? (
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

                      {nft.supply && nft.supply > 0 && (
                        <div className={styles.supplyBadge}>
                          <span>{nft.supply} NFTs</span>
                        </div>
                      )}

                      <div className={styles.infoOverlay}>
                        <div className={styles.infoContent}>
                          <h3 className={styles.nftTitle}>{nft.title}</h3>
                          <div className={styles.floorPriceWrapper}>
                            <span className={styles.floorLabel}>Floor</span>
                            <span className={styles.floorPrice}>
                              {nft.floor}
                            </span>
                          </div>
                        </div>

                        {nft.poolAddress ? (
                          <Link
                            href={`/mintstreet/collection/${nft.poolAddress}`}
                            className={styles.viewButton}
                          >
                            <span>View</span>
                            <ExternalLink size={14} />
                          </Link>
                        ) : (
                          // Render a disabled button or null if poolAddress is missing
                          // A button is generally better for accessibility even if disabled
                          <button className={styles.viewButton} disabled>
                            <span>View</span>
                            <ExternalLink size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
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
          disabled={isLoading} // Disable buttons while loading
        >
          <ChevronRight />
        </button>
      </div>

      <div className={styles.progressIndicator}>
        <div className={styles.progressWrapper}>
          {/* Render dots based on loading state or actual collection count */}
          {slideCount > 0 &&
            Array.from({ length: slideCount }).map((_, index) => (
              <button
                key={index}
                onClick={() => emblaApi?.scrollTo(index)} // Allow interaction even if buttons are disabled
                className={`${styles.progressDot} ${
                  activeIndex === index ? styles.activeDot : ""
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
