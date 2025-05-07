import Link from "next/link";

import styles from "./not-found.module.scss";

import { FileQuestion, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconContainer}>
          <FileQuestion className={styles.icon} />
        </div>
        <h1 className={styles.title}>404</h1>
        <h2 className={styles.subtitle}>Page Not Found</h2>
        <p className={styles.message}>
          The page you are looking for doesn&apos;t exist or has been moved.
        </p>

        <div className={styles.actions}>
          <Link href="/" className={styles.button}>
            <Home className={styles.buttonIcon} />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
