"use client";
import styles from "./error.module.scss";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className={styles.container}>
          <div className={styles.card}>
            <div className={styles.iconContainer}>
              <AlertTriangle className={styles.icon} />
            </div>
            <h1 className={styles.title}>Something went wrong!</h1>
            <p className={styles.message}>
              A critical error occurred in the application.
            </p>
            {error.digest && (
              <p className={styles.digest}>
                Error ID: <code>{error.digest}</code>
              </p>
            )}
            <button onClick={reset} className={styles.button}>
              <RefreshCw className={styles.buttonIcon} />
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
