// components/NFTCarousel/NFTCarousel.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, TrendingUp, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import styles from "./NFTCarousel.module.scss";
import { useNFTCollections } from "@/hooks/useNFTCollections";

// Define fallback NFTs in case we have no data or API rate limit is reached
const fallbackNfts = [
  { id: 1, title: "Doodles", floor: "3.42 SOL", image: "/nft1.jpeg", trending: true, poolAddress: "", supply: 120 },
  { id: 2, title: "When Two Stars Collide", floor: "1.05 SOL", image: "/nft2.avif", trending: false, poolAddress: "", supply: 85 },
  { id: 3, title: "Letters by Vinnie Hager", floor: "0.4 SOL", image: "/nft3.jpg", trending: false, poolAddress: "", supply: 50 },
  { id: 4, title: "Murakami Flowers", floor: "0.27 SOL", image: "/nft4.jpg", trending: false, poolAddress: "", supply: 200 },
  { id: 5, title: "Crypto Kids", floor: "0.54 SOL", image: "/nft5.png", trending: true, poolAddress: "", supply: 75 },
  { id: 6, title: "Pro Collection", floor: "3.8 SOL", image: "/nft6.webp", trending: true, poolAddress: "", supply: 150 }
];

const NFTCarousel = () => {
  // Fetch dynamic NFT collections
  const { collections, loading, error } = useNFTCollections(6);
  const [isRateLimited, setIsRateLimited] = useState(false);

  useEffect(() => {
    // Check if error message contains rate limit info (429)
    if (error && (error.includes("429") || error.includes("rate limit"))) {
      console.log("API rate limit detected, using fallback data");
      setIsRateLimited(true);
    }
  }, [error]);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    dragFree: true,
    duration: 30,
    align: "center"
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  // Autoplay
  useEffect(() => {
    if (!emblaApi) return;

    const interval = setInterval(() => {
      if (hoveredIndex === null) { // Only autoplay when no slide is being hovered
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
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    target.src = "/defaultNFT.png";
  };

  // Choose which data to display
  // Use collections if available, fallback otherwise
  const displayNfts = (collections.length > 0 && !isRateLimited) ? collections : fallbackNfts;

  // Determine correct number of slides for progress dots
  const slideCount = displayNfts.length;

  return (
    <section className={styles.heroContainer}>
      <div className={styles.glowEffect}></div>

      <div className={styles.carouselContainer}>
        <button
          className={`${styles.arrowButton} ${styles.arrowLeft}`}
          onClick={scrollPrev}
          aria-label="Previous slide"
        >
          <ChevronLeft />
        </button>

        {loading && !isRateLimited ? (
          <div className={styles.loadingContainer}>
            <Loader2 className={styles.loadingSpinner} size={32} />
            <p className={styles.loadingText}>Loading collections...</p>
          </div>
        ) : error && !isRateLimited ? (
          <div className={styles.errorContainer}>
            <p className={styles.errorText}>Failed to load collections</p>
          </div>
        ) : (
          <div className={styles.embla} ref={emblaRef}>
            <div className={styles.emblaContainer}>
              {displayNfts.map((nft, index) => (
                <div
                  className={styles.emblaSlide}
                  key={nft.id}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <div className={styles.card}>
                    <div className={styles.imageWrapper}>
                      <Image
                        src={nft.image}
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
                            <span className={styles.floorPrice}>{nft.floor}</span>
                          </div>
                        </div>

                        {nft.poolAddress ? (
                          <Link href={`/mintstreet/collection/${nft.poolAddress}`} className={styles.viewButton}>
                            <span>View</span>
                            <ExternalLink size={14} />
                          </Link>
                        ) : (
                          <button className={styles.viewButton}>
                            <span>View</span>
                            <ExternalLink size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          className={`${styles.arrowButton} ${styles.arrowRight}`}
          onClick={scrollNext}
          aria-label="Next slide"
        >
          <ChevronRight />
        </button>
      </div>

      <div className={styles.progressIndicator}>
        <div className={styles.progressWrapper}>
          {Array.from({ length: slideCount }).map((_, index) => (
            <button
              key={index}
              onClick={() => emblaApi?.scrollTo(index)}
              className={`${styles.progressDot} ${activeIndex === index ? styles.activeDot : ''}`}
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