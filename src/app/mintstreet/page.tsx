"use client";

import NFTCarousel from '@/components/NFTCarousel/NFTCarousel';
import styles from './page.module.scss';

export default function MintStreetPage() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <NFTCarousel />
      </main>
    </div>
  );
}