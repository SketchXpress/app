"use client";

import MyNFT from "@/components/MyNFT/MyNFT";
import NFTCarousel from "@/components/NFTCarousel/NFTCarousel";
import { CollectionsProvider } from "@/providers/CollectionsProvider";
import TrendingCollections from "@/components/TrendingCollections/TrendingCollections";

export default function MintStreetPage() {
  return (
    <div>
      <main>
        <CollectionsProvider>
          <NFTCarousel />
          <TrendingCollections />
          <MyNFT />
        </CollectionsProvider>
      </main>
    </div>
  );
}
