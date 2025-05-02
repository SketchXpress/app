"use client";

import NFTCarousel from '@/components/NFTCarousel/NFTCarousel';
import styles from './page.module.scss';
import TrendingCollections from '@/components/TrendingCollections/TrendingCollections';
import MyNFT from '@/components/MyNFT/MyNFT';

export default function MintStreetPage() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <NFTCarousel />
        <TrendingCollections />
        <MyNFT />
      </main>
    </div>
  );
}