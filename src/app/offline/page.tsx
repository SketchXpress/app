"use client";

import Image from 'next/image';
import styles from './offline.module.scss';

export default function Offline() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.logoContainer}>
          <Image
            src="/logo.png"
            alt="SketchXpress Logo"
            width={80}
            height={80}
            className={styles.logo}
          />
        </div>
        <h1 className={styles.title}>You&apos;re Offline</h1>
        <p className={styles.message}>
          Looks like you&apos;ve lost your internet connection.
          Please check your connection and try again.
        </p>
        <button
          className={styles.retryButton}
          onClick={() => window.location.reload()}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}