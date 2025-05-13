"use client";

import MyNFT from "@/components/MyNFT/MyNFT";
import NFTCarousel from "@/components/NFTCarousel/NFTCarousel";
import TrendingCollections from "@/components/TrendingCollections/TrendingCollections";

export default function MintStreetPage() {
  return (
    <div>
      <main>
        <NFTCarousel />
        <TrendingCollections />
        <MyNFT />
      </main>
    </div>
  );
}
