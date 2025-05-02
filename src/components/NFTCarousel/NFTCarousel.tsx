"use client";

import React, { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, TrendingUp, ExternalLink } from "lucide-react";
import styles from "./NFTCarousel.module.scss";

interface NFTCollection {
  id: number;
  title: string;
  floor: string;
  image: string;
  trending?: boolean;
}

const nfts: NFTCollection[] = [
  { id: 1, title: "Doodles", floor: "3.42 ETH", image: "/nft1.jpeg", trending: true },
  { id: 2, title: "When Two Stars Collide", floor: "1.05 ETH", image: "/nft2.avif" },
  { id: 3, title: "Letters by Vinnie Hager", floor: "0.4 ETH", image: "/nft3.jpg" },
  { id: 4, title: "Murakami Flowers", floor: "0.27 ETH", image: "/nft4.jpg" },
  { id: 5, title: "Crypto Kids", floor: "0.54 ETH", image: "/nft5.png", trending: true },
  { id: 6, title: "Pro Collection", floor: "3.8 ETH", image: "/nft6.webp", trending: true }
];

const NFTCarousel = () => {
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

        <div className={styles.embla} ref={emblaRef}>
          <div className={styles.emblaContainer}>
            {nfts.map((nft, index) => (
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
                    />

                    {nft.trending && (
                      <div className={styles.trendingBadge}>
                        <TrendingUp size={12} />
                        <span>Trending</span>
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

                      <button className={styles.viewButton}>
                        <span>View</span>
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

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
          {nfts.map((_, index) => (
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