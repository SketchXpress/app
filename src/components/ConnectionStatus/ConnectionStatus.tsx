// src/components/ConnectionStatus/ConnectionStatus.tsx
import React from "react";
import { Wifi, WifiOff, Loader2, AlertCircle } from "lucide-react";
import styles from "./ConnectionStatus.module.scss";

export interface ConnectionStatusProps {
  connectionState: string;
  hasRealtimeData?: boolean;
  lastUpdate?: number;
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Connection status indicator component
 * Shows real-time connection state with appropriate icons and colors
 */
const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  connectionState,
  hasRealtimeData = false,
  lastUpdate,
  className = "",
  showText = true,
  size = "md",
}) => {
  // Get connection details
  const getConnectionDetails = () => {
    switch (connectionState) {
      case "connected":
        return {
          icon: Wifi,
          color: "success",
          text: hasRealtimeData ? "Live" : "Connected",
          pulse: hasRealtimeData,
        };
      case "connecting":
        return {
          icon: Loader2,
          color: "warning",
          text: "Connecting...",
          pulse: false,
          spin: true,
        };
      case "disconnected":
        return {
          icon: WifiOff,
          color: "neutral",
          text: "Offline",
          pulse: false,
        };
      case "error":
        return {
          icon: AlertCircle,
          color: "error",
          text: "Error",
          pulse: false,
        };
      default:
        return {
          icon: WifiOff,
          color: "neutral",
          text: "Unknown",
          pulse: false,
        };
    }
  };

  const details = getConnectionDetails();
  const Icon = details.icon;

  // Format last update time
  const getLastUpdateText = () => {
    if (!lastUpdate) return "";

    const secondsAgo = Math.floor((Date.now() - lastUpdate) / 1000);

    if (secondsAgo < 10) return "Just now";
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
    return `${Math.floor(secondsAgo / 3600)}h ago`;
  };

  const sizeClasses = {
    sm: styles.small,
    md: styles.medium,
    lg: styles.large,
  };

  return (
    <div className={`${styles.container} ${sizeClasses[size]} ${className}`}>
      <div
        className={`${styles.indicator} ${styles[details.color]} ${
          details.pulse ? styles.pulse : ""
        }`}
        title={`Connection: ${details.text}${
          lastUpdate ? ` • ${getLastUpdateText()}` : ""
        }`}
      >
        <Icon
          size={size === "sm" ? 12 : size === "lg" ? 18 : 14}
          className={details.spin ? styles.spin : ""}
        />

        {showText && (
          <span className={styles.text}>
            {details.text}
            {hasRealtimeData && connectionState === "connected" && (
              <span className={styles.badge}>LIVE</span>
            )}
          </span>
        )}
      </div>

      {showText && lastUpdate && (
        <span className={styles.lastUpdate}>{getLastUpdateText()}</span>
      )}
    </div>
  );
};

export default ConnectionStatus;
