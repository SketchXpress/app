// src/components/CollectionDropdown/CollectionDropdown.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  Check,
  RefreshCw,
  AlertCircle,
  Wifi,
  WifiOff,
  Bell,
  Circle,
} from "lucide-react";
import { usePoolStore } from "@/stores/poolStore";
import {
  useRealTimeCollections,
  Pool,
  Collection,
} from "@/hook/api/realtime/useRealTimeCollections";
import { toast } from "react-toastify";
import styles from "./CollectionDropdown.module.scss";

interface CollectionDropdownProps {
  mode: string;
}

const CollectionDropdown: React.FC<CollectionDropdownProps> = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { selectedPool, setSelectedPool } = usePoolStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Use real-time collections hook - Try real data first, fallback to mock
  const {
    pools,
    collections,
    newPoolsCount,
    newCollectionsCount,
    lastUpdate,
    connectionState,
    isLoading,
    error,
    refresh,
    stats,
  } = useRealTimeCollections({
    enableSSE: true,
    fallbackPolling: true,
    newItemExpiry: 5 * 60 * 1000, // 5 minutes
    useMockData: false, // Try real data first
  });

  // Show toast notifications for new items
  useEffect(() => {
    const totalNewItems = newPoolsCount + newCollectionsCount;
    if (totalNewItems > 0) {
      toast.info(
        `${totalNewItems} new item(s) available! ${newCollectionsCount} collections, ${newPoolsCount} pools`,
        {
          position: "bottom-right",
          autoClose: 5000,
          onClick: () => {
            setIsOpen(true);
            refresh();
          },
        }
      );
    }
  }, [newPoolsCount, newCollectionsCount, refresh]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectCollection = (
    poolAddress: string,
    collectionName: string
  ) => {
    setSelectedPool({
      address: poolAddress,
      name: collectionName,
      id: poolAddress,
      type: "custom",
    });
    setIsOpen(false);
    refresh(); // Clear new indicators
    toast.success(`Selected collection: ${collectionName}`, {
      position: "bottom-left",
      autoClose: 2000,
    });
  };

  const getSelectedName = () => {
    return selectedPool?.name || "Select a collection...";
  };

  const isSelected = (poolAddress: string) => {
    return selectedPool?.address === poolAddress;
  };

  // Get display pools with collection names
  const displayPools = pools.map((pool: Pool) => {
    // Find matching collection by mint address
    const collection = collections.find(
      (c: Collection) => c.collectionMint === pool.collectionMint
    );
    return {
      ...pool,
      collectionName:
        collection?.collectionName ||
        pool.collectionName ||
        `Collection ${pool.collectionMint.slice(0, 6)}...`,
      symbol: collection?.symbol,
    };
  });

  // Get connection status display
  const getConnectionStatus = () => {
    switch (connectionState) {
      case "connected":
        return { icon: Wifi, color: "text-green-500", text: "Real-time" };
      case "connecting":
        return {
          icon: WifiOff,
          color: "text-yellow-500",
          text: "Connecting...",
        };
      case "disconnected":
        return { icon: WifiOff, color: "text-gray-500", text: "Offline" };
      case "error":
        return { icon: WifiOff, color: "text-red-500", text: "Error" };
      default:
        return { icon: WifiOff, color: "text-gray-500", text: "Unknown" };
    }
  };

  const { icon: StatusIcon, color, text } = getConnectionStatus();

  return (
    <div className={styles.dropdownContainer} ref={dropdownRef}>
      <button
        className={`${styles.dropdownButton} ${
          !selectedPool ? styles.noSelection : ""
        }`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span
          className={`${styles.buttonText} ${
            !selectedPool ? styles.placeholder : ""
          }`}
        >
          {getSelectedName()}
        </span>

        {/* Real-time indicator and new item badge */}
        <div className={styles.indicators}>
          {/* New items badge */}
          {(newPoolsCount > 0 || newCollectionsCount > 0) && (
            <div className={styles.newItemsBadge}>
              <Bell size={12} />
              <span>{newPoolsCount + newCollectionsCount}</span>
            </div>
          )}

          {/* Connection status */}
          <StatusIcon size={14} className={color} />
        </div>

        {isOpen ? (
          <ChevronUp size={16} className={styles.icon} />
        ) : (
          <ChevronDown size={16} className={styles.icon} />
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdownMenu}>
          <div className={styles.dropdownHeader}>
            <div className={styles.headerLeft}>
              <span>Select Collection</span>
              <div className={styles.statusIndicator}>
                <StatusIcon size={12} className={color} />
                <span className={styles.statusText}>{text}</span>
              </div>
            </div>
            <div className={styles.headerRight}>
              <span className={styles.lastUpdate}>
                {lastUpdate
                  ? `Updated ${Math.floor(
                      (Date.now() - lastUpdate) / 1000
                    )}s ago`
                  : ""}
              </span>
              <span className={styles.itemCount}>
                {stats.totalPools} pool{stats.totalPools !== 1 ? "s" : ""}
              </span>
              <button
                className={styles.refreshButton}
                onClick={refresh}
                type="button"
                aria-label="Refresh collections"
              >
                <RefreshCw
                  size={14}
                  className={isLoading ? styles.rotating : ""}
                />
              </button>
            </div>
          </div>

          {error && (
            <div className={styles.errorMessage}>
              <AlertCircle size={16} />
              <span>Connection error - using cached data</span>
              <small>Error: {error.toString()}</small>
            </div>
          )}

          {isLoading && displayPools.length === 0 ? (
            <div className={styles.loadingItem}>Loading pools...</div>
          ) : (
            <>
              {displayPools.length > 0 ? (
                <div className={styles.poolsList}>
                  {displayPools.map((pool: Pool & { symbol?: string }) => (
                    <div
                      key={pool.poolAddress}
                      className={`${styles.dropdownItem} ${
                        isSelected(pool.poolAddress) ? styles.selected : ""
                      } ${pool.isNew ? styles.newItem : ""}`}
                      onClick={() =>
                        handleSelectCollection(
                          pool.poolAddress,
                          pool.collectionName!
                        )
                      }
                    >
                      <div className={styles.itemContent}>
                        <div className={styles.itemHeader}>
                          <span className={styles.collectionName}>
                            {pool.collectionName}
                            {pool.isNew && (
                              <Circle
                                size={8}
                                className={styles.newIndicator}
                              />
                            )}
                          </span>
                          {pool.symbol && (
                            <span className={styles.symbol}>
                              ({pool.symbol})
                            </span>
                          )}
                        </div>

                        <div className={styles.itemDetails}>
                          <span className={styles.poolAddress}>
                            Pool: {pool.poolAddress.slice(0, 6)}...
                            {pool.poolAddress.slice(-4)}
                          </span>
                          {pool.basePrice && (
                            <span className={styles.price}>
                              Price:{" "}
                              {(parseInt(pool.basePrice) / 1e9).toFixed(4)} SOL
                            </span>
                          )}
                        </div>
                      </div>

                      {isSelected(pool.poolAddress) && (
                        <Check size={16} className={styles.checkIcon} />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyMessage}>
                  <AlertCircle size={20} />
                  <span>No pools available</span>
                  <small>Create a collection pool to mint NFTs</small>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CollectionDropdown;
