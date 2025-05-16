import React from "react";
import { Loader2 } from "lucide-react";
import styles from "../page.module.scss";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({
  message = "Loading pool data...",
}: LoadingStateProps) {
  return (
    <div className={styles.loadingContainer}>
      <Loader2 className={styles.loadingSpinner} />
      <p>{message}</p>
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
}

export function ErrorState({
  title = "Error Loading Pool",
  message,
}: ErrorStateProps) {
  return (
    <div className={styles.errorContainer}>
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}

interface InvalidPoolAddressProps {
  poolAddress: string;
}

export function InvalidPoolAddress({ poolAddress }: InvalidPoolAddressProps) {
  return (
    <div className={styles.errorContainer}>
      <h2>Invalid Pool Address</h2>
      <p>
        The provided pool address &quot;{poolAddress}&quot; is invalid. Please
        check the URL and try again.
      </p>
    </div>
  );
}
